/**
 * App entry — wires the WebSocket client, the state store, the
 * renderer and the input UI. Almost all logic is data flow:
 * gateway events feed state, state changes drive the renderer.
 */
import { OpenClawClient, getToken } from "./openclaw.js";
import {
    state,
    subscribe,
    update,
    pushMessage,
    updateMessage,
    setNeurons,
    setAllNeuronStates,
    pushEvent,
} from "./state.js";
import { renderAll } from "./render.js";
import { mountMolecule } from "./molecule.js";
import { NEURONS } from "./neurons.config.js";
import "./animations.js";

mountMolecule(document.getElementById("molecule"));

// Seed neuron states from config (all idle).
setNeurons(NEURONS);

subscribe((s, patch) => renderAll(s, patch));

renderAll(state, {
    wsStatus: state.wsStatus,
    agentState: state.agentState,
    messages: state.messages,
    messageCount: state.messageCount,
    neuronStates: state.neuronStates,
});

let streamingId = null;

if (!getToken()) {
    pushMessage({
        role: "system",
        text:
            "No gateway token configured. Open this URL once with " +
            "?token=<your-gateway-token> appended (it will be saved and removed from the URL).",
    });
    update({ wsStatus: "auth_error" });
} else {
    const client = new OpenClawClient({
        handlers: {
            onConnect: (info) => {
                update({ wsStatus: "connected" });
                pushEvent({ kind: "info", label: `gateway online · protocol ${info?.protocol ?? "?"}` });
                pushMessage({
                    role: "system",
                    text: `Gateway online (protocol ${info?.protocol ?? "?"}). Talking to ATLAS.`,
                });
            },
            onDisconnect: () => {
                update({ wsStatus: "disconnected" });
                pushEvent({ kind: "error", label: "gateway disconnected" });
            },
            onAuthError: (kind, err) => {
                update({ wsStatus: "auth_error" });
                pushEvent({ kind: "error", label: `auth rejected · ${err?.message || kind}` });
                pushMessage({
                    role: "system",
                    text:
                        kind === "missing_token"
                            ? "Missing gateway token."
                            : `Auth rejected: ${err?.message || kind}. Reset token via ?token=...`,
                });
            },
            onError: (err) => {
                console.error("OpenClaw error", err);
                pushEvent({ kind: "error", label: `error · ${err?.message || "see console"}` });
            },
            onAssistantStart: () => {
                update({ agentState: "streaming" });
                setAllNeuronStates("idle");
                pushEvent({ kind: "tool", label: "atlas: stream start" });
                const m = pushMessage({ role: "assistant", text: "" });
                streamingId = m.id;
            },
            onAssistantDelta: (_delta, fullText) => {
                if (!streamingId) {
                    const m = pushMessage({ role: "assistant", text: fullText });
                    streamingId = m.id;
                } else {
                    updateMessage(streamingId, { text: fullText });
                }
            },
            onAssistantFinal: () => {
                streamingId = null;
                update({ agentState: "idle" });
                pushEvent({ kind: "tool", label: "atlas: stream end" });
            },
            onToolEvent: (kind, info) => {
                const name = info?.name || kind;
                if (info?.phase === "end") {
                    const ok = info.status === "completed" || info.status === "ok";
                    const dur = info.durationMs != null ? ` · ${info.durationMs}ms` : "";
                    pushEvent({ kind: ok ? "tool" : "error", label: `${kind}: ${name} ${ok ? "✓" : "✗"}${dur}` });
                } else if (info?.phase === "start") {
                    pushEvent({ kind: "tool", label: `${kind}: ${name} ▸` });
                }
            },
        },
    });

    update({ wsStatus: "connecting" });
    pushEvent({ kind: "info", label: "gateway connecting…" });
    client.connect();

    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        if (state.wsStatus !== "connected") {
            pushMessage({ role: "system", text: "Not connected to gateway yet. Wait for handshake or reload." });
            return;
        }
        if (!client.sendMessage(text)) {
            pushMessage({ role: "system", text: "Failed to send message." });
            return;
        }
        pushMessage({ role: "user", text });
        pushEvent({ kind: "info", label: `→ user · ${text.length} chars` });
        chatInput.value = "";
        update({ agentState: "thinking" });
        setAllNeuronStates("thinking");
    }

    sendBtn.addEventListener("click", sendMessage);
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// ---- Clock ----
const clockEl = document.getElementById("hud-clock");
const dateEl = document.getElementById("hud-date");
const pad = (n) => String(n).padStart(2, "0");

function tickClock() {
    const now = new Date();
    if (clockEl) clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    if (dateEl) dateEl.textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
}
tickClock();
setInterval(tickClock, 1000);
