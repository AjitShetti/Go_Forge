import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Notebook" };

export default function NotebookPage() {
  return (
    <PlaceholderPage fig="FIG_040 · Notebook" title="Notebook" milestone="P2+">
      <p>Your stretch submissions and notes will collect here. Stretch answers are saved from lessons; this page to browse them does not exist yet.</p>
    </PlaceholderPage>
  );
}
