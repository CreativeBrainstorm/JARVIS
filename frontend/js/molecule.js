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
    // Two concentric halo rings expanding outwards on a loop — energy field
    el("circle", { cx: CENTER_X, cy: CENTER_Y, r: CORE_R, class: "mol-core-halo halo-a" }, coreGroup);
    el("circle", { cx: CENTER_X, cy: CENTER_Y, r: CORE_R, class: "mol-core-halo halo-b" }, coreGroup);
    el("circle", { cx: CENTER_X, cy: CENTER_Y, r: CORE_R, class: "mol-core-halo halo-c" }, coreGroup);
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
        const v = agentState || "idle";
        coreCircle.classList.remove("is-idle", "is-thinking", "is-streaming");
        coreCircle.classList.add(`is-${v}`);
        svg.classList.remove("is-agent-idle", "is-agent-thinking", "is-agent-streaming");
        svg.classList.add(`is-agent-${v}`);
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

    // Organic drift — each satellite has its own pair of sine/cosine
    // frequencies and phases, so the layout breathes and floats instead
    // of being pinned to a circle. Bond endpoints follow in every frame.
    const drifters = NEURONS.map((n, i) => {
        const base = satellitePosition(i, NEURONS.length);
        const sat = satById.get(n.id);
        const bond = bondById.get(n.id);
        return {
            id: n.id,
            base,
            sat,
            bond,
            satCircles: sat ? Array.from(sat.querySelectorAll("circle")) : [],
            fx: 0.00028 + i * 0.00007,   // X frequency (rad/ms)
            fy: 0.00037 + i * 0.00009,   // Y frequency
            ax: 5 + (i % 3) * 1.4,        // X amplitude (px in viewBox)
            ay: 4 + ((i + 1) % 3) * 1.6, // Y amplitude
            phx: i * 1.7,                // X phase
            phy: i * 0.93,               // Y phase
        };
    });

    let baseT = performance.now();
    function tick(now) {
        const t = now - baseT;
        for (const d of drifters) {
            const dx = Math.sin(t * d.fx + d.phx) * d.ax;
            const dy = Math.cos(t * d.fy + d.phy) * d.ay;
            const x = d.base.x + dx;
            const y = d.base.y + dy;
            for (const c of d.satCircles) {
                c.setAttribute("cx", x.toFixed(2));
                c.setAttribute("cy", y.toFixed(2));
            }
            if (d.bond) {
                d.bond.setAttribute("x2", x.toFixed(2));
                d.bond.setAttribute("y2", y.toFixed(2));
            }
        }
        rafId = requestAnimationFrame(tick);
    }
    let rafId = requestAnimationFrame(tick);

    // If the molecule is ever unmounted, stop the loop. Best-effort, since
    // the page itself owns the SVG for now.
    container.__moleculeStop = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
    };
}
