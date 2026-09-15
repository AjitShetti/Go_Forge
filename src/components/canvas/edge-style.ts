import type { EdgeKind } from "@/lib/canvas/catalog";

// Each edge kind differs in dash pattern AND weight AND colour, so the kinds
// stay distinguishable in greyscale and for colour-blind readers. Replication
// is a double rail (a wide stroke with a paper-coloured core).
export type EdgeLook = { color: string; width: number; dash?: string; rail?: boolean; arrow: "closed" | "open" };

export const EDGE_LOOK: Record<EdgeKind, EdgeLook> = {
  sync: { color: "#121212", width: 1.6, arrow: "closed" },
  async: { color: "#3d4df0", width: 1.6, dash: "7 5", arrow: "open" },
  replication: { color: "#177a3b", width: 5, rail: true, arrow: "closed" },
  cache_read: { color: "#9a6700", width: 1.8, dash: "10 4 2 4", arrow: "open" },
  batch: { color: "#55534d", width: 3.2, dash: "14 7", arrow: "closed" },
};
