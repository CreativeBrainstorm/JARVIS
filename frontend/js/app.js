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
        neuronList: document.getElementById("neuron-list"),
    };

    let messageCount = 0;
    const neuronEls = {}; // name -> li element

    // ---- Neurons panel ----
    async function loadNeurons() {
        try {
            const res = await fetch("/api/neurons");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            renderNeurons(data.neurons || []);
        } catch (err) {
            console.error("Failed to load neurons", err);
        }
    }

    function renderNeurons(neurons) {
        dom.neuronList.innerHTML = "";
        for (const n of neurons) {
            const item = document.createElement("div");
            item.className = "neuron-item is-idle";
            item.title = n.description || n.display_name;
            const dot = document.createElement("span");
            dot.className = "neuron-dot";
            const label = document.createElement("span");
            label.className = "neuron-name";
            label.textContent = n.display_name || n.name;
            item.appendChild(dot);
            item.appendChild(label);
            dom.neuronList.appendChild(item);
            neuronEls[n.name] = item;
        }
    }

    function setNeuronState(name, state) {
        const el = neuronEls[name];
        if (!el) return;
        el.classList.remove("is-idle", "is-thinking", "is-active");
        el.classList.add(`is-${state}`);
    }

    function setAllNeuronsState(state) {
        for (const name of Object.keys(neuronEls)) {
            setNeuronState(name, state);
        }
    }

    let activeNeuronTimer = null;
    function flashNeuron(name, durationMs = 2500) {
        setAllNeuronsState("idle");
        setNeuronState(name, "active");
        if (activeNeuronTimer) clearTimeout(activeNeuronTimer);
        activeNeuronTimer = setTimeout(() => {
            setNeuronState(name, "idle");
            activeNeuronTimer = null;
        }, durationMs);
    }

    loadNeurons();

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
                appendMessage("jarvis", data.content, data.neuron);
                if (data.neuron && data.neuron !== "error") {
                    flashNeuron(data.neuron);
                } else {
                    setAllNeuronsState("idle");
                }
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
        setAllNeuronsState("thinking");
    }

    dom.sendBtn.addEventListener("click", sendMessage);
    dom.chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ---- Rendering ----
    function appendMessage(role, content, neuron) {
        const row = document.createElement("div");
        row.className = `message message-${role}`;
        if (role === "jarvis" && neuron && neuron !== "error") {
            const tag = document.createElement("div");
            tag.className = "neuron-tag";
            tag.textContent = neuron;
            row.appendChild(tag);
        }
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
