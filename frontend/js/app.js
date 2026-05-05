/**
 * JARVIS HUD — main app logic (Sprint 1: chat only).
 */
(function () {
    "use strict";

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
    };

    let messageCount = 0;

    // ---- WebSocket ----
    const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws/chat`;
    const ws = new JarvisWebSocket(wsUrl, {
        onOpen: () => {
            setWsStatus(true);
            appendSystemMessage("Connection established. JARVIS is online.");
        },
        onMessage: (data) => {
            if (data.type === "response") {
                hideTyping();
                appendMessage("jarvis", data.content);
            }
        },
        onClose: () => {
            setWsStatus(false);
        },
        onError: (err) => {
            console.error("WebSocket error", err);
        },
    });
    ws.connect();

    // ---- UI events ----
    function sendMessage() {
        const text = dom.chatInput.value.trim();
        if (!text) return;
        if (!ws.send({ message: text })) {
            appendSystemMessage("Not connected. Trying to reconnect...");
            return;
        }
        appendMessage("user", text);
        dom.chatInput.value = "";
        showTyping();
    }

    dom.sendBtn.addEventListener("click", sendMessage);
    dom.chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ---- Rendering ----
    function appendMessage(role, content) {
        const row = document.createElement("div");
        row.className = `message message-${role}`;
        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.textContent = content;
        row.appendChild(bubble);
        dom.chatMessages.appendChild(row);
        dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
        messageCount++;
        dom.msgCount.textContent = `Messages: ${messageCount}`;
    }

    function appendSystemMessage(content) {
        const row = document.createElement("div");
        row.className = "message message-system";
        row.textContent = content;
        dom.chatMessages.appendChild(row);
        dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
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

    // ---- Clock ----
    function tickClock() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        dom.clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        dom.date.textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
    }
    tickClock();
    setInterval(tickClock, 1000);

    // ---- Quick commands (placeholder, send as text) ----
    document.querySelectorAll(".cmd-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            dom.chatInput.value = btn.dataset.cmd;
            sendMessage();
        });
    });
})();
