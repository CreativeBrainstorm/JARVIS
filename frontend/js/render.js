/**
 * Pure render functions. Each takes the current state and a patch
 * (the partial object emitted by state.update) and updates only
 * the DOM affected by that patch.
 */

const ASSISTANT_NAME = "ATLAS";

const dom = {
    chatMessages: document.getElementById("chat-messages"),
    typingIndicator: document.getElementById("typing-indicator"),
    wsStatus: document.getElementById("ws-status"),
    statusIndicator: document.getElementById("status-indicator"),
    statusText: document.getElementById("status-text"),
    msgCount: document.getElementById("msg-count"),
    neuronList: document.getElementById("neuron-list"),
};

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

function renderSkills(state, patch) {
    if ("skills" in patch) {
        dom.neuronList.innerHTML = "";
        if (state.skills.length === 0) {
            const empty = document.createElement("div");
            empty.className = "neuron-item is-idle";
            empty.style.opacity = "0.5";
            empty.textContent = "(no skills loaded)";
            dom.neuronList.appendChild(empty);
        } else {
            for (const t of state.skills) {
                const item = document.createElement("div");
                item.className = "neuron-item is-idle";
                item.dataset.name = t.name;
                item.title = t.description || t.displayName || t.name;
                const dot = document.createElement("span");
                dot.className = "neuron-dot";
                const label = document.createElement("span");
                label.className = "neuron-name";
                label.textContent = t.displayName || t.name;
                item.appendChild(dot);
                item.appendChild(label);
                dom.neuronList.appendChild(item);
            }
        }
    }
    if ("skillStates" in patch) {
        for (const item of dom.neuronList.querySelectorAll("[data-name]")) {
            const s = state.skillStates[item.dataset.name] || "idle";
            item.classList.remove("is-idle", "is-thinking", "is-active");
            item.classList.add(`is-${s}`);
        }
    }
}

export function renderAll(state, patch) {
    renderTopbar(state, patch);
    renderConnectionStatus(state, patch);
    renderTyping(state, patch);
    renderMsgCount(state, patch);
    renderMessages(state, patch);
    renderSkills(state, patch);
}
