/**
 * Molecule renderer: 1 core + N satellites laid out on an orbit.
 * Cyan-only, label-less. Each satellite reacts to its own state in
 * `state.neuronStates[neuron.id]`; the core mirrors `state.agentState`.
 */
import { state, subscribe } from "./state.js";
import { CORE, NEURONS } from "./neurons.config.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const VIEW_W = 280;
const VIEW_H = 280;
const CENTER_X = VIEW_W / 2;
const CENTER_Y = VIEW_H / 2;
const CORE_R = 28;
const SAT_R = 12;
const ORBIT_R = 110;

function el(name, attrs = {}, parent = null) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
}

function satellitePosition(index, total) {
    const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
    return {
        x: CENTER_X + Math.cos(angle) * ORBIT_R,
        y: CENTER_Y + Math.sin(angle) * ORBIT_R,
    };
}

export function mountMolecule(container) {
    if (!container) return;
    container.innerHTML = "";

    const svg = el(
        "svg",
        {
            viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
            class: "molecule-svg",
            xmlns: SVG_NS,
        },
        container,
    );

    // Bonds (lines core → satellite). One per neuron, indexed by id.
    const bondById = new Map();
    NEURONS.forEach((n, i) => {
        const pos = satellitePosition(i, NEURONS.length);
        const line = el(
            "line",
            {
                x1: CENTER_X,
                y1: CENTER_Y,
                x2: pos.x,
                y2: pos.y,
                class: "mol-bond",
                "data-id": n.id,
            },
            svg,
        );
        bondById.set(n.id, line);
    });

    // Core
    const coreGroup = el("g", { class: "mol-core" }, svg);
    el(
        "circle",
        {
            cx: CENTER_X,
            cy: CENTER_Y,
            r: CORE_R + 9,
            class: "mol-core-ring",
        },
        coreGroup,
    );
    const coreCircle = el(
        "circle",
        {
            cx: CENTER_X,
            cy: CENTER_Y,
            r: CORE_R,
            class: "mol-core-circle",
        },
        coreGroup,
    );

    // Satellites
    const satById = new Map();
    NEURONS.forEach((n, i) => {
        const pos = satellitePosition(i, NEURONS.length);
        const g = el("g", { class: "mol-sat is-idle", "data-id": n.id }, svg);
        el(
            "circle",
            {
                cx: pos.x,
                cy: pos.y,
                r: SAT_R + 5,
                class: "mol-sat-ring",
            },
            g,
        );
        el(
            "circle",
            {
                cx: pos.x,
                cy: pos.y,
                r: SAT_R,
                class: "mol-sat-dot",
            },
            g,
        );
        const title = el("title", {}, g);
        title.textContent = `${n.label} — ${n.description}`;
        satById.set(n.id, g);
    });

    function applyCoreState(agentState) {
        coreCircle.classList.remove("is-idle", "is-thinking", "is-streaming");
        coreCircle.classList.add(`is-${agentState || "idle"}`);
    }

    function applyNeuronStates(neuronStates) {
        for (const [id, sat] of satById) {
            const s = neuronStates[id] || "idle";
            sat.classList.remove("is-idle", "is-thinking", "is-active");
            sat.classList.add(`is-${s}`);
            const bond = bondById.get(id);
            if (bond) {
                bond.classList.remove("is-idle", "is-thinking", "is-active");
                bond.classList.add(`is-${s}`);
            }
        }
    }

    applyCoreState(state.agentState);
    applyNeuronStates(state.neuronStates);

    subscribe((s, patch) => {
        if ("agentState" in patch) applyCoreState(s.agentState);
        if ("neuronStates" in patch) applyNeuronStates(s.neuronStates);
    });
}
