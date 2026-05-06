/**
 * Voice — TTS + STT for the HUD.
 *
 * Three modes (persisted in localStorage):
 *   off      no speech I/O
 *   passive  only TTS: ATLAS responses are spoken
 *   active   TTS + continuous STT with wake word "JARVIS"
 *
 * Wake-word detection is regex-based on the final transcript. Anything
 * not preceded by "Jarvis" (with or without a leading "hey/ok/oye") is
 * dropped silently. This keeps casual chatter out.
 *
 * Anti-echo: while TTS is speaking we abort recognition and resume on
 * utterance.onend, so JARVIS doesn't transcribe his own voice.
 */

const LS_VOICE_MODE = "openclaw.voiceMode";

// Tolerant of how "JARVIS" gets transcribed in Spanish: jarvis, járvis,
// yarvis (very common from es-ES recognition), charvis, javis…
const WAKE_RE = /^(?:hey\s+|ok\s+|oye\s+)?(?:jarvis|j[aá]rvis|yarvis|charvis|j[aá]vis)\b[\s,.\-:!?]*([^]*)$/i;

// Window after a bare wake word during which the next final transcript is
// taken as a prompt without having to re-say "Jarvis".
const FOLLOWUP_WINDOW_MS = 6500;

const validModes = new Set(["off", "passive", "active"]);

export class Voice {
    /**
     * @param {object} opts
     * @param {(text: string) => void} opts.onTranscript  fired with the
     *     wake-stripped prompt text after a final transcript matches.
     * @param {(state: {mode, listening, speaking}) => void} opts.onState
     * @param {(err: Error|object) => void} opts.onError
     */
    constructor(opts = {}) {
        this.onTranscript = opts.onTranscript || (() => {});
        this.onInterim = opts.onInterim || (() => {});
        this.onState = opts.onState || (() => {});
        this.onError = opts.onError || (() => {});

        this.mode = localStorage.getItem(LS_VOICE_MODE);
        if (!validModes.has(this.mode)) this.mode = "off";

        this.recognition = null;
        this.speaking = false;
        this.listening = false;
        this._wantListening = this.mode === "active";
        this._voicesCache = null;
        this._restartTimer = null;
        this._supportError = null;

        // Bare-wake-word follow-up: the user said "Jarvis" with no payload;
        // accept the next final transcript as a prompt without requiring
        // the wake word again.
        this._followUpUntil = 0;

        // Lazy AudioContext for the wake-ack beep.
        this._audioCtx = null;

        this._initVoices();
        this._initRecognition();

        if (this.mode === "active") this._safeStart();
        this._notify();
    }

    // ─── support detection ─────────────────────────────────────────────

    isTtsSupported() {
        return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
    }

    isSttSupported() {
        return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    // ─── voices ────────────────────────────────────────────────────────

    _initVoices() {
        if (!this.isTtsSupported()) return;
        const synth = window.speechSynthesis;
        const load = () => {
            this._voicesCache = synth.getVoices();
        };
        load();
        // Some browsers populate voices async.
        if (typeof synth.addEventListener === "function") {
            synth.addEventListener("voiceschanged", load);
        } else {
            synth.onvoiceschanged = load;
        }
    }

    pickVoice() {
        const voices = this._voicesCache && this._voicesCache.length
            ? this._voicesCache
            : (this.isTtsSupported() ? window.speechSynthesis.getVoices() : []);
        if (!voices.length) return null;

        const score = (v) => {
            let s = 0;
            const lang = String(v.lang || "").toLowerCase();
            if (lang === "es-es") s += 100;
            else if (lang.startsWith("es")) s += 60;
            else if (lang.startsWith("en")) s += 5;
            const name = String(v.name || "").toLowerCase();
            if (/neural|online|natural/.test(name)) s += 50;
            if (/helena|elvira|mónica|monica|sabina|laura|lucia|lucía|paulina|sofia|sofía|álvaro|alvaro/i.test(name)) s += 20;
            // Prefer non-default if everything else is equal — defaults
            // tend to be cheaper formant voices.
            if (v.default) s -= 2;
            return s;
        };

        return [...voices].sort((a, b) => score(b) - score(a))[0] || null;
    }

    // ─── recognition ───────────────────────────────────────────────────

    _initRecognition() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            this._supportError = new Error("SpeechRecognition not supported in this browser");
            return;
        }
        const rec = new SR();
        rec.lang = "es-ES";
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
            this.listening = true;
            this._notify();
        };
        rec.onend = () => {
            this.listening = false;
            this._notify();
            // Auto-restart while we still want to listen (active mode + not speaking).
            if (this._wantListening && !this.speaking) {
                clearTimeout(this._restartTimer);
                this._restartTimer = setTimeout(() => this._safeStart(), 250);
            }
        };
        rec.onerror = (ev) => {
            // 'no-speech', 'aborted' are routine — don't surface them.
            if (ev?.error && ev.error !== "no-speech" && ev.error !== "aborted") {
                this.onError(ev);
            }
        };
        rec.onresult = (ev) => {
            // Also feed interim results to the UI so the user sees what the
            // browser is hearing in real time.
            let interim = "";
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
                const r = ev.results[i];
                if (r.isFinal) {
                    const text = String(r[0]?.transcript || "").trim();
                    if (text) this._handleFinalTranscript(text);
                } else {
                    interim += String(r[0]?.transcript || "");
                }
            }
            this.onInterim(interim.trim());
        };

        this.recognition = rec;
    }

    _safeStart() {
        if (!this.recognition || this.listening || this.speaking) return;
        try {
            this.recognition.start();
        } catch (_) {
            // "already started" is benign.
        }
    }

    _safeStop() {
        if (!this.recognition || !this.listening) return;
        try {
            this.recognition.abort();
        } catch (_) {}
    }

    _handleFinalTranscript(text) {
        // Clear any leftover interim string in the UI now that we have a
        // committed transcript.
        this.onInterim("");

        const m = text.match(WAKE_RE);
        if (m) {
            const prompt = (m[1] || "").trim().replace(/^[,.;:!?\-\s]+/, "");
            if (prompt) {
                this._followUpUntil = 0;
                this.onTranscript(prompt);
                return;
            }
            // Bare wake word: ack with a beep and open a follow-up window.
            this._beepAck();
            this._followUpUntil = Date.now() + FOLLOWUP_WINDOW_MS;
            return;
        }

        // No wake word — but if we just heard "Jarvis" and the follow-up
        // window is still open, accept this transcript as the prompt.
        if (Date.now() < this._followUpUntil) {
            this._followUpUntil = 0;
            const prompt = text.replace(/^[,.;:!?\-\s]+/, "").trim();
            if (prompt) this.onTranscript(prompt);
        }
        // Otherwise: idle chatter, drop silently.
    }

    _beepAck() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            if (!this._audioCtx) this._audioCtx = new Ctx();
            const ctx = this._audioCtx;
            // Resume if suspended (autoplay policy after a tab gesture).
            if (ctx.state === "suspended") ctx.resume?.();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1320, now + 0.09);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.13);
        } catch (_) {
            // Audio is best-effort; never let a beep failure break STT.
        }
    }

    // ─── synthesis ─────────────────────────────────────────────────────

    speak(text) {
        if (!text || this.mode === "off" || !this.isTtsSupported()) return;
        const synth = window.speechSynthesis;

        // Stop anything queued and pause listening so we don't transcribe
        // our own voice.
        synth.cancel();
        const wasListening = this.listening;
        if (wasListening) this._safeStop();

        const utt = new SpeechSynthesisUtterance(text);
        const voice = this.pickVoice();
        if (voice) utt.voice = voice;
        utt.lang = voice?.lang || "es-ES";
        utt.rate = 1.05;
        utt.pitch = 1.0;
        utt.volume = 1.0;

        utt.onstart = () => {
            this.speaking = true;
            this._notify();
        };
        const finish = () => {
            this.speaking = false;
            this._notify();
            if (this.mode === "active") {
                clearTimeout(this._restartTimer);
                this._restartTimer = setTimeout(() => this._safeStart(), 200);
            }
        };
        utt.onend = finish;
        utt.onerror = finish;

        synth.speak(utt);
    }

    cancelSpeech() {
        if (this.isTtsSupported()) window.speechSynthesis.cancel();
        this.speaking = false;
        this._notify();
    }

    // ─── mode control ──────────────────────────────────────────────────

    setMode(mode) {
        if (!validModes.has(mode)) return;
        if (mode === this.mode) return;
        this.mode = mode;
        localStorage.setItem(LS_VOICE_MODE, mode);
        if (mode === "active") {
            this._wantListening = true;
            if (!this.speaking) this._safeStart();
        } else {
            this._wantListening = false;
            this._safeStop();
            if (mode === "off") this.cancelSpeech();
        }
        this._notify();
    }

    cycleMode() {
        const order = ["off", "passive", "active"];
        let i = (order.indexOf(this.mode) + 1) % order.length;
        // If STT isn't available, skip "active".
        if (order[i] === "active" && !this.isSttSupported()) {
            i = (i + 1) % order.length;
        }
        this.setMode(order[i]);
    }

    // ─── state plumbing ────────────────────────────────────────────────

    _notify() {
        this.onState({
            mode: this.mode,
            listening: this.listening,
            speaking: this.speaking,
            supportError: this._supportError ? this._supportError.message : null,
        });
    }
}
