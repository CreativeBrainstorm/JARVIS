/**
 * OpenClawClient — WebSocket client for the OpenClaw gateway.
 *
 * Handles the connect.challenge → connect handshake, request/response
 * correlation, and emits high-level callbacks for assistant streaming.
 *
 * Token & gateway URL are read from URL params on first load (matching
 * OpenClaw's own convention: ?token=...&gatewayUrl=...&session=...) and
 * persisted to localStorage. URL params are stripped after capture.
 */
(function () {
    "use strict";

    const LS_TOKEN = "openclaw.token";
    const LS_GATEWAY_URL = "openclaw.gatewayUrl";
    const LS_SESSION = "openclaw.sessionKey";

    const DEFAULT_GATEWAY_URL = "wss://iabot-openclaw-gateway.slb810.easypanel.host/";
    const DEFAULT_SESSION = "agent:main:main";

    function uuid() {
        if (crypto.randomUUID) return crypto.randomUUID();
        // RFC4122 v4 fallback
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
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

    function getToken() {
        return localStorage.getItem(LS_TOKEN) || "";
    }

    function getGatewayUrl() {
        return localStorage.getItem(LS_GATEWAY_URL) || DEFAULT_GATEWAY_URL;
    }

    function getSessionKey() {
        return localStorage.getItem(LS_SESSION) || DEFAULT_SESSION;
    }

    function setToken(token) {
        if (token) localStorage.setItem(LS_TOKEN, token);
        else localStorage.removeItem(LS_TOKEN);
    }

    class OpenClawClient {
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
                // health, tick, etc. — ignored for now
            }
        }

        async _sendConnect() {
            const params = {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                    id: "jarvis-hud",
                    version: "0.1.0",
                    platform: navigator.platform || "web",
                    mode: "webchat",
                    instanceId: uuid(),
                },
                role: "operator",
                scopes: ["operator.read", "operator.write"],
                caps: [],
                auth: { token: this.token },
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
            // Reject pending requests
            for (const [id, p] of this.pending) {
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

    // Capture credentials from URL on first paint, then expose API
    captureUrlParamsToLocalStorage();

    window.OpenClaw = {
        Client: OpenClawClient,
        getToken,
        setToken,
        getGatewayUrl,
        getSessionKey,
        DEFAULT_GATEWAY_URL,
        DEFAULT_SESSION,
    };
})();
