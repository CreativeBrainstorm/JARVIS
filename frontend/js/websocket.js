/**
 * JarvisWebSocket — thin wrapper around the browser WebSocket.
 * Handles auto-reconnect with backoff and JSON message framing.
 */
class JarvisWebSocket {
    constructor(url, handlers = {}) {
        this.url = url;
        this.handlers = handlers;  // { onOpen, onMessage, onClose, onError }
        this.ws = null;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 15000;
        this.shouldReconnect = true;
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.reconnectDelay = 1000;
            this.handlers.onOpen?.();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handlers.onMessage?.(data);
            } catch (e) {
                console.error("Failed to parse message", e, event.data);
            }
        };

        this.ws.onclose = () => {
            this.handlers.onClose?.();
            if (this.shouldReconnect) {
                setTimeout(() => this.connect(), this.reconnectDelay);
                this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
            }
        };

        this.ws.onerror = (err) => {
            this.handlers.onError?.(err);
        };
    }

    send(payload) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
            return true;
        }
        return false;
    }

    close() {
        this.shouldReconnect = false;
        this.ws?.close();
    }
}

window.JarvisWebSocket = JarvisWebSocket;
