/**
 * Local voice commands — intercepted in app.js BEFORE forwarding the
 * transcript to the agent. If a command matches, it runs and the
 * utterance does NOT reach ATLAS. Useful for trivial controls
 * ("Jarvis, calla", "Jarvis, limpia el chat") that shouldn't burn a
 * model turn.
 *
 * Each command:
 *   id       short identifier (logging / debugging)
 *   pattern  regex against the wake-stripped transcript
 *   run      ({ ctx }) => string|null   — the optional ack will be
 *            spoken back. Return null for silent commands.
 */

export const COMMANDS = [
    {
        id: "stop-speech",
        pattern: /^(?:c[aá]llate|callate|para(?:\s+(?:de hablar|ya))?|silencio|stop|shut up|cierra el pico)\b/i,
        run: ({ voice }) => {
            voice.cancelSpeech();
            return null; // silent — speech is what's being stopped
        },
    },
    {
        id: "clear-chat",
        pattern: /^(?:limpia|limpiar|borra|borrar|clear)(?:\s+(?:el\s+)?(?:chat|conversaci[oó]n|mensajes|todo|hist[oó]rico))?\b/i,
        run: ({ clearMessages }) => {
            clearMessages();
            return null;
        },
    },
    {
        id: "mode-off",
        pattern: /^(?:modo\s+(?:off|apagado|mute)|c[aá]llate del todo|silencio total)\b/i,
        run: ({ voice }) => {
            voice.setMode("off");
            return null;
        },
    },
    {
        id: "mode-passive",
        pattern: /^(?:modo\s+pasivo|s[oó]lo\s+(?:escuchas|escucha)|deja\s+de\s+escucharme)\b/i,
        run: ({ voice }) => {
            voice.setMode("passive");
            return "Modo pasivo.";
        },
    },
    {
        id: "mode-active",
        pattern: /^modo\s+activo\b/i,
        run: ({ voice }) => {
            voice.setMode("active");
            return "Te escucho.";
        },
    },
];

export function matchCommand(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    for (const cmd of COMMANDS) {
        if (cmd.pattern.test(t)) return cmd;
    }
    return null;
}
