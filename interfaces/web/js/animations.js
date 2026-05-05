/**
 * JARVIS HUD — Animations Engine
 * ================================
 * Particle background, neural activity graph,
 * and HUD visual effects.
 */

// ---- Particle Background ----
class ParticleBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.connections = [];
        this.particleCount = 80;
        this.maxDistance = 150;
        this.animationId = null;

        this._resize();
        window.addEventListener('resize', () => this._resize());
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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;

            // Wrap around edges
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;

            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(0, 212, 255, ${p.opacity})`;
            this.ctx.fill();
        }

        // Draw connections
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < this.maxDistance) {
                    const opacity = (1 - dist / this.maxDistance) * 0.15;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}


// ---- Neural Activity Graph ----
class NeuralActivityGraph {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.data = new Array(100).fill(0);
        this.isActive = false;
        this.animationId = null;
        this.baseLevel = 0.15;

        this._startIdleAnimation();
    }

    _startIdleAnimation() {
        const draw = () => {
            // Shift data left
            this.data.shift();

            // Add new data point
            let value;
            if (this.isActive) {
                // Active: high frequency, larger amplitude
                value = 0.3 + Math.random() * 0.6 + Math.sin(Date.now() / 100) * 0.15;
            } else {
                // Idle: gentle wave
                value = this.baseLevel + Math.sin(Date.now() / 800) * 0.08 + Math.random() * 0.05;
            }
            this.data.push(Math.min(1, Math.max(0, value)));

            // Clear
            const w = this.canvas.width;
            const h = this.canvas.height;
            this.ctx.clearRect(0, 0, w, h);

            // Draw grid
            this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.05)';
            this.ctx.lineWidth = 0.5;
            for (let y = 0; y < h; y += 20) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(w, y);
                this.ctx.stroke();
            }

            // Draw wave
            const gradient = this.ctx.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0, 'rgba(0, 212, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');

            this.ctx.beginPath();
            this.ctx.moveTo(0, h);

            for (let i = 0; i < this.data.length; i++) {
                const x = (i / this.data.length) * w;
                const y = h - (this.data[i] * h * 0.8) - 5;
                if (i === 0) {
                    this.ctx.lineTo(x, y);
                } else {
                    // Smooth curve
                    const prevX = ((i - 1) / this.data.length) * w;
                    const prevY = h - (this.data[i - 1] * h * 0.8) - 5;
                    const cpX = (prevX + x) / 2;
                    this.ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
                }
            }

            this.ctx.lineTo(w, h);
            this.ctx.closePath();
            this.ctx.fillStyle = gradient;
            this.ctx.fill();

            // Draw line on top
            this.ctx.beginPath();
            for (let i = 0; i < this.data.length; i++) {
                const x = (i / this.data.length) * w;
                const y = h - (this.data[i] * h * 0.8) - 5;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            this.ctx.strokeStyle = this.isActive ? 'rgba(0, 255, 136, 0.8)' : 'rgba(0, 212, 255, 0.6)';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();

            this.animationId = requestAnimationFrame(draw);
        };

        draw();
    }

    setActive(active) {
        this.isActive = active;
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}


// ---- Clock ----
function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('hud-clock');
    const dateEl = document.getElementById('hud-date');

    if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    }
}

// Start clock
setInterval(updateClock, 1000);
updateClock();
