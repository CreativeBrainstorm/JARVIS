/**
 * Tiny pub/sub store. Single source of UI truth.
 * Mutations go through update() / push helpers; everything that
 * paints subscribes and re-renders on change.
 */

export const state = {
    wsStatus: "disconnected",   // disconnected | connecting | connected | auth_error
    agentState: "idle",         // idle | thinking | streaming
    activityLevel: 0,           // 0..1, drives ambient animations

    skills: [],                 // [{name, displayName, description}]
    skillStates: {},            // { skillName: idle | thinking | active }

    messages: [],               // [{id, role, text, neuron?, ts}]
    messageCount: 0,
};

const subscribers = new Set();

export function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

function notify(patch) {
    for (const fn of subscribers) fn(state, patch);
}

export function update(patch) {
    Object.assign(state, patch);
    notify(patch);
}

let _idCounter = 0;
const nextId = () => `m${++_idCounter}`;

export function pushMessage(msg) {
    const full = { id: nextId(), ts: Date.now(), ...msg };
    state.messages.push(full);
    state.messageCount = state.messages.length;
    notify({ messages: state.messages, messageCount: state.messageCount, _pushed: full });
    return full;
}

export function updateMessage(id, patch) {
    const m = state.messages.find((x) => x.id === id);
    if (!m) return;
    Object.assign(m, patch);
    notify({ _updated: m });
}

export function setSkills(skills) {
    state.skills = skills;
    const next = {};
    for (const s of skills) next[s.name] = state.skillStates[s.name] || "idle";
    state.skillStates = next;
    notify({ skills, skillStates: state.skillStates });
}

export function setAllSkillStates(value) {
    const next = {};
    for (const s of state.skills) next[s.name] = value;
    state.skillStates = next;
    notify({ skillStates: state.skillStates });
}
