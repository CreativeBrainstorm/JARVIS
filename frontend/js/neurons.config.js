/**
 * Knowledge domains represented as satellite neurons in the HUD.
 * Add or remove entries here — the molecule and any future inspector
 * read from this list, no other file needs editing.
 *
 *   id          stable internal id (used for state, routing later)
 *   label       short HUD label (≤12 chars, uppercase looks best)
 *   hue         HSL hue 0–360 — drives the node's color
 *   description tooltip text
 */

export const CORE = {
    id: "core",
    label: "ATLAS",
    hue: 195,
};

export const NEURONS = [
    { id: "tech",      label: "TECH",      hue: 195, description: "Producción técnica general" },
    { id: "lights",    label: "LIGHTS",    hue: 50,  description: "Iluminación: focos, mesas, fixtures" },
    { id: "sound",     label: "SOUND",     hue: 280, description: "Sonido: altavoces, mezcladoras, micros" },
    { id: "video",     label: "VIDEO",     hue: 320, description: "Video: LED, proyectores, cámaras, broadcast" },
    { id: "logistics", label: "LOGISTICS", hue: 130, description: "Producción operativa: hoteles, logística, proveedores" },
    { id: "registry",  label: "REGISTRY",  hue: 30,  description: "Base de datos: clientes, proveedores, venues" },
];
