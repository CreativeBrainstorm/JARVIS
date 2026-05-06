/**
 * JARVIS HUD — talks directly to the OpenClaw gateway over WebSocket.
 *
 * No backend of our own — the gateway is the single source of truth.
 * Token + gatewayUrl + session are persisted to localStorage; first time
 * the user opens the page they should append `?token=...` to the URL.
 */
(function () {
    "use strict";

    const ASSISTANT_NAME = "ATLAS";

    const dom = {
        chatMessages: document.getElementById("chat-messages"),
        chatInput: document.getElementById("chat-input"),
        sendBtn: document.getElementById("send-btn"),
        typingIndicator: document.getElementById("typing-indicator"),
        wsStatus: document.getElementById("ws-status"),
        statusIndicator: document.getElementById("status-indicator"),
        statusText: document.getElementById("status-text"),
        msgCount: document.getElementById("msg-count"),
        clock: document.getElementById("hud-clock"),
        date: document.getElementById("hud-date"),
        neuronList: document.getElementById("neuron-list"),
    };

    let messageCount = 0;
    const skillEls = {}; // skill name -> item element
    let activeBubble = null; // streaming target

    // ---- Skills panel ----
    function renderSkills(catalog) {
        const tools = (catalog && (catalog.tools || catalog.skills || catalog)) || [];
        const list = Array.isArray(tools) ? tools : [];
        dom.neuronList.innerHTML = "";
        for (const t of list) {
            const name = t.name || t.id || "?";
            const display = t.displayName || t.title || name;
            const item = document.createElement("div");
            item.className = "neuron-item is-idle";
            item.title = t.description || display;
            const dot = document.createElement("span");
            dot.className = "neuron-dot";
            const label = document.createElement("span");
            label.className = "neuron-name";
            label.textContent = display;
            item.appendChild(dot);
            item.appendChild(label);
            dom.neuronList.appendChild(item);
            skillEls[name] = item;
        }
        if (!list.length) {
            const empty = document.createElement("div");
            empty.className = "neuron-item is-idle";
            empty.style.opacity = "0.5";
            empty.textContent = "(no skills loaded)";
            dom.neuronList.appendChild(empty);
        }
    }

    function setAllSkillsState(state) {
        for (const el of Object.values(skillEls)) {
            el.classList.remove("is-idle", "is-thinking", "is-active");
            el.classList.add(`is-${state}`);
        }
    }

    // ---- Rendering ----
    function appendUserMessage(text) {
        const row = document.createElement("div");
        row.className = "message message-user";
        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.textContent = text;
        row.appendChild(bubble);
        dom.chatMessages.appendChild(row);
        scrollToBottom();
        bumpCount();
    }

    function startAssistantBubble() {
        const row = document.createElement("div");
        row.className = "message message-jarvis";
        const tag = document.createElement("div");
        tag.className = "neuron-tag";
        tag.textContent = ASSISTANT_NAME;
        row.appendChild(tag);
        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.textContent = "";
        row.appendChild(bubble);
        dom.chatMessages.appendChild(row);
        scrollToBottom();
        bumpCount();
        return bubble;
    }

    function appendSystemMessage(content) {
        const row = document.createElement("div");
        row.className = "message message-system";
        row.textContent = content;
        dom.chatMessages.appendChild(row);
        scrollToBottom();
    }

    function scrollToBottom() {
        dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    }

    function bumpCount() {
        messageCount++;
        dom.msgCount.textContent = `Messages: ${messageCount}`;
    }

    function showTyping() {
        dom.typingIndicator.style.display = "";
    }

    function hideTyping() {
        dom.typingIndicator.style.display = "none";
    }

    function setWsStatus(connected) {
        if (connected) {
            dom.wsStatus.innerHTML = '<span class="ws-dot connected"></span> CONNECTED';
            dom.statusIndicator.classList.remove("offline");
            dom.statusIndicator.classList.add("online");
            dom.statusText.textContent = "SYSTEMS ONLINE";
        } else {
            dom.wsStatus.innerHTML = '<span class="ws-dot disconnected"></span> DISCONNECTED';
            dom.statusIndicator.classList.remove("online");
            dom.statusIndicator.classList.add("offline");
            dom.statusText.textContent = "RECONNECTING";
        }
    }

    // ---- Client wiring ----
    if (!OpenClaw.getToken()) {
        appendSystemMessage(
            "No gateway token configured. Open this URL once with " +
            "?token=<your-gateway-token> appended (it will be saved and removed from the URL)."
        );
        setWsStatus(false);
        return;
    }

    const client = new OpenClaw.Client({
        handlers: {
            onConnect: (info) => {
                setWsStatus(true);
                appendSystemMessage(`Gateway online (protocol ${info?.protocol ?? "?"}). Talking to ${ASSISTANT_NAME}.`);
            },
            onDisconnect: () => setWsStatus(false),
            onAuthError: (kind, err) => {
                setWsStatus(false);
                if (kind === "missing_token") {
                    appendSystemMessage("Missing gateway token.");
                } else {
                    appendSystemMessage(`Auth rejected: ${err?.message || kind}. Reset token via ?token=...`);
                }
            },
            onError: (err) => {
                console.error("OpenClaw error", err);
            },
            onTools: (catalog) => {
                renderSkills(catalog);
            },
            onAssistantStart: () => {
                hideTyping();
                setAllSkillsState("idle");
                activeBubble = startAssistantBubble();
            },
            onAssistantDelta: (_delta, fullText) => {
                if (!activeBubble) activeBubble = startAssistantBubble();
                activeBubble.textContent = fullText;
                scrollToBottom();
            },
            onAssistantFinal: () => {
                activeBubble = null;
            },
        },
    });
    client.connect();

    // ---- UI events ----
    function sendMessage() {
        const text = dom.chatInput.value.trim();
        if (!text) return;
        if (!client.connected) {
            appendSystemMessage("Not connected to gateway yet. Wait for handshake or reload.");
            return;
        }
        if (!client.sendMessage(text)) {
            appendSystemMessage("Failed to send message.");
            return;
        }
        appendUserMessage(text);
        dom.chatInput.value = "";
        showTyping();
        setAllSkillsState("thinking");
    }

    dom.sendBtn.addEventListener("click", sendMessage);
    dom.chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ---- Quick commands (placeholder, send as text) ----
    document.querySelectorAll(".cmd-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            dom.chatInput.value = btn.dataset.cmd;
            sendMessage();
        });
    });

    // ---- Clock ----
    function tickClock() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        dom.clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        dom.date.textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
    }
    tickClock();
    setInterval(tickClock, 1000);
})();
