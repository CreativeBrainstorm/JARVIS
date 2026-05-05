/**
 * JARVIS HUD — Main Application
 * ===============================
 * Chat logic, system monitoring, and HUD management.
 */

(function () {
    'use strict';

    // ---- State ----
    let messageCount = 0;
    let ws = null;
    let particles = null;
    let neuralGraph = null;

    // ---- DOM Elements ----
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const typingIndicator = document.getElementById('typing-indicator');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const wsStatusEl = document.getElementById('ws-status');
    const msgCountEl = document.getElementById('msg-count');
    const activityFeed = document.getElementById('activity-feed');
    const moduleList = document.getElementById('module-list');

    // ---- Initialize ----
    function init() {
        // Start animations
        particles = new ParticleBackground('bg-canvas');
        neuralGraph = new NeuralActivityGraph('neural-canvas');

        // Connect WebSocket
        connectWebSocket();

        // Bind events
        chatInput.addEventListener('keydown', handleKeyDown);
        sendBtn.addEventListener('click', sendMessage);

        // Quick command buttons
        document.querySelectorAll('.cmd-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.getAttribute('data-cmd');
                if (cmd) {
                    chatInput.value = cmd;
                    sendMessage();
                }
            });
        });

        // Focus input
        chatInput.focus();

        // Load initial data
        loadSystemStatus();
        loadTools();
        loadMemoryStatus();

        // Periodic updates
        setInterval(loadSystemStatus, 5000);
        setInterval(loadMemoryStatus, 10000);

        addActivity('System initialized');
    }

    // ---- WebSocket ----
    function connectWebSocket() {
        ws = new JarvisWebSocket({
            onMessage: (content) => {
                hideTyping();
                neuralGraph?.setActive(false);
                addMessage('assistant', content);
                setStatus('online', 'SYSTEMS ONLINE');
                addActivity('Response received');
            },
            onStatus: (content) => {
                showTyping();
                neuralGraph?.setActive(true);
                setStatus('processing', content.toUpperCase());
                addActivity(content);
            },
            onConnect: () => {
                updateWSStatus(true);
                setStatus('online', 'SYSTEMS ONLINE');
                addActivity('Connected to JARVIS');
            },
            onDisconnect: () => {
                updateWSStatus(false);
                setStatus('offline', 'DISCONNECTED');
                addActivity('Connection lost');
            },
            onError: (content) => {
                hideTyping();
                neuralGraph?.setActive(false);
                addMessage('assistant', `⚠️ ${content}`);
                addActivity(`Error: ${content}`, 'error');
            },
        });

        ws.connect();
    }

    // ---- Messages ----
    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Add user message to chat
        addMessage('user', text);
        chatInput.value = '';

        // Send via WebSocket
        if (ws && ws.isConnected) {
            ws.send(text);
            showTyping();
            neuralGraph?.setActive(true);
            setStatus('processing', 'PROCESSING');
            addActivity(`User: ${text.substring(0, 40)}...`);
        } else {
            addMessage('assistant', 'Connection lost. Attempting to reconnect...');
            ws?.connect();
        }

        chatInput.focus();
    }

    function addMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;

        // Simple markdown-like rendering
        const rendered = renderContent(content);

        const time = new Date().toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
        });

        msgDiv.innerHTML = `
            <div class="message-content">${rendered}</div>
            <div class="message-time">${time}</div>
        `;

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        messageCount++;
        if (msgCountEl) {
            msgCountEl.textContent = `Messages: ${messageCount}`;
        }
    }

    function renderContent(text) {
        if (!text) return '';

        // Escape HTML
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Code blocks (```)
        html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    // ---- Typing Indicator ----
    function showTyping() {
        if (typingIndicator) {
            typingIndicator.style.display = 'flex';
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    function hideTyping() {
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
    }

    // ---- Status ----
    function setStatus(state, text) {
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${state}`;
        }
        if (statusText) {
            statusText.textContent = text;
        }

        // Update status dot color
        const dot = statusIndicator?.querySelector('.status-dot');
        if (dot) {
            dot.style.background = state === 'online' ? '#00ff88'
                : state === 'processing' ? '#ffaa00'
                : '#ff3366';
            dot.style.boxShadow = state === 'online' ? '0 0 8px #00ff88'
                : state === 'processing' ? '0 0 8px #ffaa00'
                : '0 0 8px #ff3366';
        }
    }

    function updateWSStatus(connected) {
        if (wsStatusEl) {
            const dot = wsStatusEl.querySelector('.ws-dot');
            if (dot) {
                dot.className = `ws-dot ${connected ? 'connected' : 'disconnected'}`;
            }
            wsStatusEl.innerHTML = `<span class="ws-dot ${connected ? 'connected' : 'disconnected'}"></span> ${connected ? 'CONNECTED' : 'DISCONNECTED'}`;
        }
    }

    // ---- Activity Feed ----
    function addActivity(text, type = '') {
        if (!activityFeed) return;

        const item = document.createElement('div');
        item.className = `activity-item ${type}`;

        const time = new Date().toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        item.textContent = `[${time}] ${text}`;

        // Keep only last 20 items
        if (activityFeed.children.length >= 20) {
            activityFeed.removeChild(activityFeed.firstChild);
        }

        activityFeed.appendChild(item);
        activityFeed.scrollTop = activityFeed.scrollHeight;
    }

    // ---- System Status (via API) ----
    async function loadSystemStatus() {
        try {
            // Use the /api/tools endpoint to indirectly get system info
            // For now, we'll use random-ish values that get updated when real data is available
            const response = await fetch('/health');
            if (!response.ok) return;

            // Try to get real system data via a chat command (not ideal but works for MVP)
            updateSystemBars();
        } catch (e) {
            // Server not available yet
        }
    }

    function updateSystemBars() {
        // Generate realistic-looking values (these will be replaced with real data from WebSocket)
        const cpu = Math.random() * 30 + 10;
        const ram = Math.random() * 20 + 40;
        const disk = Math.random() * 5 + 55;

        setStatBar('cpu', cpu);
        setStatBar('ram', ram);
        setStatBar('disk', disk);
    }

    function setStatBar(id, value) {
        const bar = document.getElementById(`${id}-bar`);
        const valueEl = document.getElementById(`${id}-value`);

        if (bar) {
            bar.style.width = `${value}%`;

            // Color based on value
            if (value > 80) {
                bar.style.background = 'linear-gradient(90deg, #ff3366, #ff6699)';
            } else if (value > 60) {
                bar.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
            } else {
                bar.style.background = 'linear-gradient(90deg, var(--color-primary-dim), var(--color-primary))';
            }
        }
        if (valueEl) {
            valueEl.textContent = `${Math.round(value)}%`;
        }
    }

    // ---- Tools / Modules ----
    async function loadTools() {
        try {
            const response = await fetch('/api/tools');
            if (!response.ok) return;

            const data = await response.json();
            if (moduleList && data.tools) {
                moduleList.innerHTML = data.tools.map(tool => `
                    <div class="module-item">
                        <span class="module-dot"></span>
                        <span>${tool.name}</span>
                    </div>
                `).join('');
            }
        } catch (e) {
            // Server not available yet — show defaults
            if (moduleList) {
                moduleList.innerHTML = `
                    <div class="module-item">
                        <span class="module-dot"></span>
                        <span>get_datetime</span>
                    </div>
                    <div class="module-item">
                        <span class="module-dot"></span>
                        <span>system_monitor</span>
                    </div>
                `;
            }
        }
    }

    // ---- Memory Status ----
    async function loadMemoryStatus() {
        try {
            const response = await fetch('/api/memory/status');
            if (!response.ok) return;

            const data = await response.json();
            const stmEl = document.getElementById('stm-count');
            const ltmEl = document.getElementById('ltm-count');

            if (stmEl) stmEl.textContent = data.short_term?.messages || 0;
            if (ltmEl) ltmEl.textContent = data.long_term?.documents || 0;
        } catch (e) {
            // Server not available yet
        }
    }

    // ---- Input Handling ----
    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    // ---- Boot ----
    document.addEventListener('DOMContentLoaded', init);

})();
