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
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
                const r = ev.results[i];
                if (r.isFinal) {
                    const text = String(r[0]?.transcript || "").trim();
                    if (text) this._handleFinalTranscript(text);
                }
            }
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
        const m = text.match(WAKE_RE);
        if (!m) return; // No wake word → ignore.
        const prompt = (m[1] || "").trim().replace(/^[,.;:!?\-\s]+/, "");
        if (!prompt) return; // Heard the wake word with no follow-up.
        this.onTranscript(prompt);
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
