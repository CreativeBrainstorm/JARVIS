/**
 * Pure render functions. Each takes the current state and a patch
 * (the partial object emitted by state.update) and updates only
 * the DOM affected by that patch.
 */
import { NEURONS } from "./neurons.config.js";

const ASSISTANT_NAME = "ATLAS";

const dom = {
    chatMessages: document.getElementById("chat-messages"),
    typingIndicator: document.getElementById("typing-indicator"),
    wsStatus: document.getElementById("ws-status"),
    statusIndicator: document.getElementById("status-indicator"),
    statusText: document.getElementById("status-text"),
    msgCount: document.getElementById("msg-count"),
    neuronList: document.getElementById("neuron-list"),
    activityFeed: document.getElementById("activity-feed"),
    micBtn: document.getElementById("mic-btn"),
};

const pad2 = (n) => String(n).padStart(2, "0");

function fmtTime(ts) {
    const d = new Date(ts);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

// Map of message id → bubble element, so streaming updates don't rebuild.
const messageNodes = new Map();

function scrollChatToBottom() {
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

function renderTopbar(state, patch) {
    if (!("wsStatus" in patch)) return;
    if (state.wsStatus === "connected") {
        dom.statusIndicator.classList.remove("offline");
        dom.statusIndicator.classList.add("online");
        dom.statusText.textContent = "SYSTEMS ONLINE";
    } else if (state.wsStatus === "auth_error") {
        dom.statusIndicator.classList.remove("online");
        dom.statusIndicator.classList.add("offline");
        dom.statusText.textContent = "AUTH ERROR";
    } else {
        dom.statusIndicator.classList.remove("online");
        dom.statusIndicator.classList.add("offline");
        dom.statusText.textContent = state.wsStatus === "connecting" ? "CONNECTING" : "RECONNECTING";
    }
}

function renderConnectionStatus(state, patch) {
    if (!("wsStatus" in patch)) return;
    const connected = state.wsStatus === "connected";
    dom.wsStatus.innerHTML = connected
        ? '<span class="ws-dot connected"></span> CONNECTED'
        : '<span class="ws-dot disconnected"></span> DISCONNECTED';
}

function renderTyping(state, patch) {
    if (!("agentState" in patch)) return;
    dom.typingIndicator.style.display = state.agentState === "thinking" ? "" : "none";
}

function renderMsgCount(state, patch) {
    if (!("messageCount" in patch)) return;
    dom.msgCount.textContent = `Messages: ${state.messageCount}`;
}

function renderMessages(_state, patch) {
    if (patch._pushed) {
        const m = patch._pushed;
        const row = document.createElement("div");
        if (m.role === "user") {
            row.className = "message message-user";
            const bubble = document.createElement("div");
            bubble.className = "message-bubble";
            bubble.textContent = m.text || "";
            row.appendChild(bubble);
            messageNodes.set(m.id, bubble);
        } else if (m.role === "assistant") {
            row.className = "message message-jarvis";
            const tag = document.createElement("div");
            tag.className = "neuron-tag";
            tag.textContent = m.neuron || ASSISTANT_NAME;
            row.appendChild(tag);
            const bubble = document.createElement("div");
            bubble.className = "message-bubble";
            bubble.textContent = m.text || "";
            row.appendChild(bubble);
            messageNodes.set(m.id, bubble);
        } else {
            row.className = "message message-system";
            row.textContent = m.text || "";
        }
        dom.chatMessages.appendChild(row);
        scrollChatToBottom();
    }
    if (patch._updated) {
        const bubble = messageNodes.get(patch._updated.id);
        if (bubble) {
            bubble.textContent = patch._updated.text || "";
            scrollChatToBottom();
        }
    }
}

// Build the static neurons list once. State changes only toggle classes.
function mountNeuronsList() {
    if (!dom.neuronList || dom.neuronList.dataset.mounted === "1") return;
    dom.neuronList.innerHTML = "";
    for (const n of NEURONS) {
        const item = document.createElement("div");
        item.className = "neuron-item is-idle";
        item.dataset.id = n.id;
        item.title = n.description || n.label;
        const dot = document.createElement("span");
        dot.className = "neuron-dot";
        const label = document.createElement("span");
        label.className = "neuron-name";
        label.textContent = n.label;
        item.appendChild(dot);
        item.appendChild(label);
        dom.neuronList.appendChild(item);
    }
    dom.neuronList.dataset.mounted = "1";
}

function renderNeurons(state, patch) {
    mountNeuronsList();
    if (!("neuronStates" in patch)) return;
    for (const item of dom.neuronList.querySelectorAll("[data-id]")) {
        const s = state.neuronStates[item.dataset.id] || "idle";
        item.classList.remove("is-idle", "is-thinking", "is-active");
        item.classList.add(`is-${s}`);
    }
}

function renderVoice(state, patch) {
    if (!dom.micBtn) return;
    if (!("voiceMode" in patch || "voiceListening" in patch || "voiceSpeaking" in patch)) return;
    const mode = state.voiceMode || "off";
    dom.micBtn.classList.remove("is-off", "is-passive", "is-active");
    dom.micBtn.classList.add(`is-${mode}`);
    dom.micBtn.classList.toggle("is-listening", !!state.voiceListening);
    dom.micBtn.classList.toggle("is-speaking", !!state.voiceSpeaking);
    const titleByMode = {
        off: "Voice: OFF — click to enable (passive read-aloud)",
        passive: "Voice: PASSIVE — ATLAS reads replies. Click for ACTIVE",
        active: "Voice: ACTIVE — say 'Jarvis …' to talk. Click to turn OFF",
    };
    dom.micBtn.title = titleByMode[mode] || "";
}

function renderActivity(_state, patch) {
    if (!patch._newEvent || !dom.activityFeed) return;
    const evt = patch._newEvent;
    const item = document.createElement("div");
    item.className = `activity-item ${evt.kind || ""}`.trim();
    item.textContent = `${fmtTime(evt.ts)}  ${evt.label}`;
    dom.activityFeed.appendChild(item);
    while (dom.activityFeed.children.length > 50) {
        dom.activityFeed.removeChild(dom.activityFeed.firstChild);
    }
    dom.activityFeed.scrollTop = dom.activityFeed.scrollHeight;
}

export function renderAll(state, patch) {
    renderTopbar(state, patch);
    renderConnectionStatus(state, patch);
    renderTyping(state, patch);
    renderMsgCount(state, patch);
    renderMessages(state, patch);
    renderNeurons(state, patch);
    renderVoice(state, patch);
    renderActivity(state, patch);
}
