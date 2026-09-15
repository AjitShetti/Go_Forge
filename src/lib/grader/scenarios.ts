// Scenarios the grader knows. This file is the source of truth; migration
// 20260915000500_scenarios.sql seeds the same rows so designs can point at one
// (tests/unit/grader/scenarios.test.ts keeps the two in sync).
import type { Scenario } from "./types";

export const TICKETING_FLASH_SALE: Scenario = {
  slug: "ticketing-flash-sale",
  title: "Event ticketing: flash sale",
  summary:
    "A stadium tour goes on sale at 10:00:00. Two million people are already on the page. Seats run out in minutes. Everyone who clicks Buy must be treated in arrival order, and no seat may be sold twice.",
  functional: [
    "Browse an event and see seat availability",
    "Join the sale and get a place in line",
    "Hold a seat for 10 minutes while paying",
    "Confirm the purchase, or release the hold when it expires",
  ],
  scale: {
    peakQps: 200_000,
    readWriteRatio: 20,
    notes: [
      { label: "Seats for sale", value: "50,000" },
      { label: "Buyers waiting at open", value: "2,000,000" },
      { label: "Peak arrival", value: "200,000 rps in the first minute" },
      { label: "Reads per write", value: "20 : 1 (availability checks vs. purchase attempts)" },
      { label: "Seat hold", value: "10 minutes" },
    ],
  },
  constraints: [
    { id: "no-oversell", text: "No seat is sold twice. Seat inventory lives in a strongly consistent, persistent store.", rules: ["strong-inventory", "replica-reads"] },
    { id: "survive-node-loss", text: "Losing any single node on the request path does not stop the sale.", rules: ["spof"] },
    { id: "fair-queue", text: "Buyers are admitted in arrival order through a queue. The spike never reaches the inventory store directly.", rules: ["admission-queue", "queue-dlq"] },
    { id: "peak", text: "Absorb 200,000 rps at the on-sale moment without any component over capacity.", rules: ["capacity", "read-heavy-cache", "load-shedding", "queue-backlog"] },
    { id: "fast-ack", text: "p99 of the synchronous path is at most 800 ms, so a buyer learns they are in line quickly.", rules: ["latency-budget", "cross-region-sync"] },
  ],
  params: { readHeavyRatio: 10, p99BudgetMs: 800 },
  rules: [
    { rule: "has-entry" },
    { rule: "client-direct-data", severity: "violation" },
    { rule: "spof" },
    { rule: "capacity" },
    { rule: "strong-inventory" },
    { rule: "admission-queue" },
    { rule: "latency-budget" },
    { rule: "read-heavy-cache" },
    { rule: "queue-dlq" },
    { rule: "unreachable" },
    { rule: "load-shedding" },
    { rule: "queue-backlog" },
    { rule: "replica-reads" },
    { rule: "cross-region-sync" },
  ],
};

export const SCENARIOS: Scenario[] = [TICKETING_FLASH_SALE];

export function scenarioBySlug(slug: string | null | undefined): Scenario | null {
  return SCENARIOS.find((s) => s.slug === slug) ?? null;
}
