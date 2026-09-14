import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <PlaceholderPage fig="FIG_020 · Mistake ledger" title="Review" milestone="P4">
      <p>This page will bring back the concepts you predicted wrong, weighted by how recently and how often you missed them. Nothing is scheduled yet.</p>
    </PlaceholderPage>
  );
}
