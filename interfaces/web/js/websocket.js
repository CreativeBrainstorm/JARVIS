/**
 * JARVIS HUD — WebSocket Manager
 * ================================
 * Handles the WebSocket connection to the JARVIS backend.
 */

class JarvisWebSocket {
    constructor(options = {}) {
        this.url = options.url || `ws://${window.location.host}/api/ws/chat`;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 2000;
        this.isConnected = false;

        // Event callbacks
        this.onMessage = options.onMessage || (() => {});
        this.onStatus = options.onStatus || (() => {});
        this.onConnect = options.onConnect || (() => {});
        this.onDisconnect = options.onDisconnect || (() => {});
        this.onError = options.onError || (() => {});
    }

    connect() {
        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('[WS] Connected to JARVIS');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.onConnect();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch (data.type) {
                        case 'response':
                            this.onMessage(data.content);
                            break;
                        case 'status':
                            this.onStatus(data.content);
                            break;
                        case 'error':
                            this.onError(data.content);
                            break;
                        default:
                            console.warn('[WS] Unknown message type:', data.type);
                    }
                } catch (e) {
                    console.error('[WS] Failed to parse message:', e);
                }
            };

            this.ws.onclose = (event) => {
                console.log('[WS] Connection closed:', event.code, event.reason);
                this.isConnected = false;
                this.onDisconnect();
                this._attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('[WS] Error:', error);
                this.onError('Connection error');
            };

        } catch (e) {
            console.error('[WS] Failed to create WebSocket:', e);
            this._attemptReconnect();
        }
    }

    send(message) {
        if (!this.isConnected || !this.ws) {
            console.warn('[WS] Not connected — cannot send message');
            return false;
        }

        try {
            this.ws.send(JSON.stringify({ message }));
            return true;
        } catch (e) {
            console.error('[WS] Failed to send:', e);
            return false;
        }
    }

    disconnect() {
        this.maxReconnectAttempts = 0; // Prevent reconnection
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
        }
    }

    _attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[WS] Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
        
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, delay);
    }
}
