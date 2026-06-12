import { useSyncExternalStore } from "react";

/** UI preferences (theme palette + graph style), persisted in localStorage. */

const KEY = "noxilith.prefs.v1";
if (
  localStorage.getItem(KEY) === null &&
  localStorage.getItem("mindgarden.prefs.v1") !== null
) {
  localStorage.setItem(
    KEY,
    localStorage.getItem("mindgarden.prefs.v1") as string,
  );
}

export interface Prefs {
  palette: string;
  graphStyle: string;
}

export const PALETTES = [
  {
    id: "default",
    name: "Фиолетовый сад",
    swatch: ["#7c3aed", "#241f33", "#e9e4f5"],
  },
  {
    id: "aurora",
    name: "Северное сияние",
    swatch: ["#34d3a6", "#0e2230", "#dff2ec"],
  },
  { id: "sunset", name: "Закат", swatch: ["#f0824f", "#2a1d18", "#f8e8dc"] },
  { id: "sakura", name: "Сакура", swatch: ["#e87aa4", "#2a1c24", "#f9e6ee"] },
  {
    id: "ocean",
    name: "Глубокий океан",
    swatch: ["#54a9f0", "#101c30", "#dfeaf7"],
  },
  {
    id: "amber",
    name: "Графит и янтарь",
    swatch: ["#e3a83b", "#1f1e1c", "#f4ecdd"],
  },
] as const;

export const GRAPH_STYLES = [
  { id: "classic", name: "Классика" },
  { id: "crystal", name: "Осколки кристалла" },
  { id: "neon", name: "Неон" },
  { id: "stars", name: "Созвездие" },
  { id: "hex", name: "Соты" },
] as const;

const DEFAULTS: Prefs = { palette: "default", graphStyle: "classic" };

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

let state: Prefs = load();
const listeners = new Set<() => void>();

export function applyPalette(palette: string): void {
  const el = document.documentElement;
  if (palette === "default") delete el.dataset.theme;
  else el.dataset.theme = palette;
}

// Apply persisted palette as early as possible (module load).
if (typeof document !== "undefined") applyPalette(state.palette);

export function setPrefs(patch: Partial<Prefs>): void {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  if (patch.palette !== undefined) applyPalette(state.palette);
  for (const l of listeners) l();
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
