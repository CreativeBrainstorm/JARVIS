/**
 * OpenClawClient — WebSocket client for the OpenClaw gateway.
 *
 * Handles the connect.challenge → connect handshake, request/response
 * correlation, and emits high-level callbacks for assistant streaming.
 *
 * Token & gateway URL are read from URL params on first load (matching
 * OpenClaw's own convention: ?token=...&gatewayUrl=...&session=...) and
 * persisted to localStorage. URL params are stripped after capture.
 *
 * No DOM access — pure transport. Consumers wire callbacks to the state
 * store; rendering happens elsewhere.
 */

const LS_TOKEN = "openclaw.token";
const LS_GATEWAY_URL = "openclaw.gatewayUrl";
const LS_SESSION = "openclaw.sessionKey";
const LS_DEVICE_IDENTITY = "openclaw.deviceIdentity";

export const DEFAULT_GATEWAY_URL = "wss://iabot-openclaw-gateway.slb810.easypanel.host/";
export const DEFAULT_SESSION = "agent:main:main";

function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}

let _edPromise = null;
function getEd() {
    if (!_edPromise) {
        _edPromise = import("https://esm.sh/@noble/ed25519@2.1.0");
    }
    return _edPromise;
}

function bytesToHex(bytes) {
    let s = "";
    for (const b of bytes) s += b.toString(16).padStart(2, "0");
    return s;
}

function bytesToB64url(bytes) {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function b64urlToBytes(s) {
    const t = s.replaceAll("-", "+").replaceAll("_", "/");
    const padded = t + "=".repeat((4 - (t.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

async function loadOrGenerateDeviceIdentity() {
    const raw = localStorage.getItem(LS_DEVICE_IDENTITY);
    if (raw) {
        try {
            const stored = JSON.parse(raw);
            if (
                stored?.version === 1 &&
                typeof stored.deviceId === "string" &&
                typeof stored.publicKey === "string" &&
                typeof stored.privateKey === "string"
            ) {
                return stored;
            }
        } catch (_) {}
    }
    const ed = await getEd();
    const priv = (ed.utils.randomSecretKey || ed.utils.randomPrivateKey)();
    const pub = await ed.getPublicKeyAsync(priv);
    const idHashBuf = await crypto.subtle.digest("SHA-256", pub.slice().buffer);
    const deviceId = bytesToHex(new Uint8Array(idHashBuf));
    const identity = {
        version: 1,
        deviceId,
        publicKey: bytesToB64url(pub),
        privateKey: bytesToB64url(priv),
        createdAt: Date.now(),
    };
    localStorage.setItem(LS_DEVICE_IDENTITY, JSON.stringify(identity));
    return identity;
}

function captureUrlParamsToLocalStorage() {
    const url = new URL(window.location.href);
    const sp = url.searchParams;
    let touched = false;
    const token = sp.get("token");
    if (token) {
        localStorage.setItem(LS_TOKEN, token.trim());
        sp.delete("token");
        touched = true;
    }
    const gw = sp.get("gatewayUrl");
    if (gw) {
        localStorage.setItem(LS_GATEWAY_URL, gw.trim());
        sp.delete("gatewayUrl");
        touched = true;
    }
    const session = sp.get("session");
    if (session) {
        localStorage.setItem(LS_SESSION, session.trim());
        sp.delete("session");
        touched = true;
    }
    if (touched) {
        const cleaned = url.pathname + (sp.toString() ? `?${sp}` : "") + url.hash;
        window.history.replaceState({}, "", cleaned);
    }
}

export function getToken() {
    return localStorage.getItem(LS_TOKEN) || "";
}

export function getGatewayUrl() {
    return localStorage.getItem(LS_GATEWAY_URL) || DEFAULT_GATEWAY_URL;
}

export function getSessionKey() {
    return localStorage.getItem(LS_SESSION) || DEFAULT_SESSION;
}

export function setToken(token) {
    if (token) localStorage.setItem(LS_TOKEN, token);
    else localStorage.removeItem(LS_TOKEN);
}

// Capture credentials from URL on module load.
captureUrlParamsToLocalStorage();

export class OpenClawClient {
    /**
     * @param {object} opts
     * @param {string} [opts.url]         override gateway URL
     * @param {string} [opts.token]       override token
     * @param {string} [opts.sessionKey]  override session key
     * @param {object} [opts.handlers]    callbacks: onConnect, onDisconnect,
     *   onAssistantStart, onAssistantDelta, onAssistantFinal,
     *   onChatFinal, onAuthError, onError, onTools
     */
    constructor(opts = {}) {
        this.url = opts.url || getGatewayUrl();
        this.token = opts.token || getToken();
        this.sessionKey = opts.sessionKey || getSessionKey();
        this.handlers = opts.handlers || {};

        this.ws = null;
        this.connected = false;
        this.shouldReconnect = true;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 15000;
        this.pending = new Map(); // id -> {resolve, reject}
        this.currentRunId = null;
    }

    connect() {
        if (!this.token) {
            this.handlers.onAuthError?.("missing_token");
            return;
        }
        try {
            this.ws = new WebSocket(this.url);
        } catch (e) {
            this.handlers.onError?.(e);
            return;
        }
        this.ws.onopen = () => {};
        this.ws.onmessage = (ev) => this._onMessage(ev.data);
        this.ws.onclose = () => this._onClose();
        this.ws.onerror = (err) => this.handlers.onError?.(err);
    }

    async _onMessage(raw) {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch (_) {
            return;
        }

        if (msg.type === "res") {
            const p = this.pending.get(msg.id);
            if (p) {
                this.pending.delete(msg.id);
                p.resolve(msg);
            }
            return;
        }

        if (msg.type === "event") {
            if (msg.event === "connect.challenge") {
                this.connectNonce = msg.payload?.nonce ?? "";
                await this._sendConnect();
                return;
            }
            if (msg.event === "agent") {
                this._onAgentEvent(msg.payload);
                return;
            }
            if (msg.event === "chat") {
                this._onChatEvent(msg.payload);
                return;
            }
            if (typeof msg.event === "string" && (msg.event.startsWith("tool.") || msg.event.startsWith("tools.") || msg.event.startsWith("skill."))) {
                this.handlers.onToolEvent?.(msg.event, msg.payload);
                return;
            }
            // health, tick, etc. — ignored for now
        }
    }

    async _sendConnect() {
        const clientId = "openclaw-control-ui";
        const clientMode = "webchat";
        const role = "operator";
        const scopes = ["operator.read", "operator.write"];

        let device;
        try {
            const identity = await loadOrGenerateDeviceIdentity();
            const ed = await getEd();
            const signedAtMs = Date.now();
            const nonce = this.connectNonce ?? "";
            const canonical = [
                "v2",
                identity.deviceId,
                clientId,
                clientMode,
                role,
                scopes.join(","),
                String(signedAtMs),
                this.token,
                nonce,
            ].join("|");
            const sig = await ed.signAsync(
                new TextEncoder().encode(canonical),
                b64urlToBytes(identity.privateKey)
            );
            device = {
                id: identity.deviceId,
                publicKey: identity.publicKey,
                signature: bytesToB64url(sig),
                signedAt: signedAtMs,
                nonce,
            };
        } catch (e) {
            this.handlers.onError?.(e);
            return;
        }

        const params = {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
                id: clientId,
                version: "0.1.0",
                platform: navigator.platform || "web",
                mode: clientMode,
                instanceId: uuid(),
            },
            role,
            scopes,
            caps: [],
            auth: { token: this.token },
            device,
            userAgent: navigator.userAgent,
            locale: navigator.language || "es-ES",
        };
        try {
            const res = await this._request("connect", params, 15000);
            if (!res.ok) {
                const code = res.error?.code;
                if (code === "INVALID_REQUEST" && /token/i.test(res.error?.message || "")) {
                    this.handlers.onAuthError?.("bad_token", res.error);
                    this.shouldReconnect = false;
                } else {
                    this.handlers.onError?.(res.error);
                }
                return;
            }
            this.connected = true;
            this.reconnectDelay = 1000;
            this.handlers.onConnect?.(res.payload);
            // Best-effort: ask for available tools/skills
            this._request("tools.catalog", {}, 5000)
                .then((r) => r.ok && this.handlers.onTools?.(r.payload))
                .catch(() => {});
        } catch (e) {
            this.handlers.onError?.(e);
        }
    }

    _onAgentEvent(payload) {
        if (!payload) return;
        if (payload.stream === "lifecycle") {
            if (payload.data?.phase === "start") {
                this.currentRunId = payload.runId;
                this.handlers.onAssistantStart?.(payload);
            } else if (payload.data?.phase === "end") {
                this.handlers.onAssistantFinal?.(payload);
                this.currentRunId = null;
            }
        } else if (payload.stream === "assistant") {
            this.handlers.onAssistantDelta?.(payload.data?.delta || "", payload.data?.text || "", payload);
        } else if (payload.stream === "item") {
            const d = payload.data || {};
            const isTool = d.kind === "tool" || (typeof d.itemId === "string" && d.itemId.startsWith("tool:"));
            const isCmd = d.kind === "command" || (typeof d.itemId === "string" && d.itemId.startsWith("command:"));
            if (isTool || isCmd) {
                this.handlers.onToolEvent?.(isTool ? "tool" : "command", {
                    name: d.name || d.title || (isCmd ? "command" : "tool"),
                    phase: d.phase,
                    status: d.status,
                    durationMs: d.endedAt && d.startedAt ? d.endedAt - d.startedAt : undefined,
                });
            }
        }
    }

    _onChatEvent(payload) {
        if (!payload) return;
        if (payload.state === "final") {
            this.handlers.onChatFinal?.(payload);
        }
    }

    _onClose() {
        const wasConnected = this.connected;
        this.connected = false;
        for (const [, p] of this.pending) {
            p.reject(new Error("socket closed"));
        }
        this.pending.clear();
        this.handlers.onDisconnect?.();
        if (wasConnected && this.shouldReconnect) {
            setTimeout(() => this.connect(), this.reconnectDelay);
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        }
    }

    _request(method, params, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            if (this.ws?.readyState !== WebSocket.OPEN) {
                reject(new Error("not connected"));
                return;
            }
            const id = uuid();
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ type: "req", id, method, params }));
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`timeout: ${method}`));
                }
            }, timeoutMs);
        });
    }

    sendMessage(text) {
        if (!this.connected) return false;
        const params = {
            sessionKey: this.sessionKey,
            message: text,
            idempotencyKey: uuid(),
        };
        this._request("chat.send", params, 15000)
            .then((res) => {
                if (!res.ok) this.handlers.onError?.(res.error);
            })
            .catch((err) => this.handlers.onError?.(err));
        return true;
    }

    close() {
        this.shouldReconnect = false;
        this.ws?.close();
    }
}
