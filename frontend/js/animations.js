/**
 * Ambient HUD visuals: particle background canvas + neural-activity
 * graph. Both self-instantiate on import. The neural graph reads
 * `agentState` from the store so its activity tracks what the
 * agent is doing.
 */
import { state, subscribe } from "./state.js";

class ParticleBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext("2d");
        this.particles = [];
        this.particleCount = 80;
        this.maxDistance = 150;
        this.animationId = null;

        this._resize();
        window.addEventListener("resize", () => this._resize());
        this._initParticles();
        this.animate();
    }

    _resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    _initParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 1.5 + 0.5,
                opacity: Math.random() * 0.5 + 0.2,
            });
        }
    }

    animate() {
        const { ctx, canvas, particles, maxDistance } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 212, 255, ${p.opacity})`;
            ctx.fill();
        }

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < maxDistance) {
                    const opacity = (1 - dist / maxDistance) * 0.15;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }
}

class NeuralActivityGraph {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext("2d");
        this.data = new Array(100).fill(0);
        this.isActive = false;
        this.animationId = null;
        this.baseLevel = 0.15;

        subscribe((s, patch) => {
            if ("agentState" in patch) {
                this.isActive = s.agentState === "thinking" || s.agentState === "streaming";
            }
        });

        this._loop();
    }

    _loop() {
        const draw = () => {
            this.data.shift();
            const value = this.isActive
                ? 0.3 + Math.random() * 0.6 + Math.sin(Date.now() / 100) * 0.15
                : this.baseLevel + Math.sin(Date.now() / 800) * 0.08 + Math.random() * 0.05;
            this.data.push(Math.min(1, Math.max(0, value)));

            const w = this.canvas.width;
            const h = this.canvas.height;
            const ctx = this.ctx;
            ctx.clearRect(0, 0, w, h);

            ctx.strokeStyle = "rgba(0, 212, 255, 0.05)";
            ctx.lineWidth = 0.5;
            for (let y = 0; y < h; y += 20) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }

            const gradient = ctx.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0, "rgba(0, 212, 255, 0.4)");
            gradient.addColorStop(1, "rgba(0, 212, 255, 0)");

            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let i = 0; i < this.data.length; i++) {
                const x = (i / this.data.length) * w;
                const y = h - this.data[i] * h * 0.8 - 5;
                if (i === 0) {
                    ctx.lineTo(x, y);
                } else {
                    const prevX = ((i - 1) / this.data.length) * w;
                    const prevY = h - this.data[i - 1] * h * 0.8 - 5;
                    const cpX = (prevX + x) / 2;
                    ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
                }
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.beginPath();
            for (let i = 0; i < this.data.length; i++) {
                const x = (i / this.data.length) * w;
                const y = h - this.data[i] * h * 0.8 - 5;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = this.isActive
                ? "rgba(0, 255, 136, 0.8)"
                : "rgba(0, 212, 255, 0.6)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            this.animationId = requestAnimationFrame(draw);
        };
        draw();
    }
}

new ParticleBackground("bg-canvas");
new NeuralActivityGraph("neural-canvas");

// Reference state to silence "unused import" linters when no patch yet exists.
void state;
