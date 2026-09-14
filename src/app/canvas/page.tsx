import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Design canvas" };

export default function CanvasPage() {
  return (
    <PlaceholderPage fig="FIG_030 · System design canvas" title="Canvas" milestone="P5–P6">
      <p>Drag components, wire them, and get graded by a deterministic rule engine against scenario constraints. The first scenario will be the event-ticketing flash sale.</p>
    </PlaceholderPage>
  );
}
