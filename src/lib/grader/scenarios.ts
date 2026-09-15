// Scenarios the grader knows. This file is the source of truth; migration
// 20260915000600_scenarios_p7.sql seeds the same rows so designs can point at one
// (tests/unit/grader/grade.test.ts keeps the two in sync).
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
    { id: "fair-queue", text: "Buyers are admitted in arrival order through a queue. The spike never reaches the inventory store directly.", rules: ["admission-queue", "client-direct-data", "queue-dlq"] },
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
  why: {
    "strong-inventory": "Two buyers can both see and take the last seat.",
    "replica-reads": "A seat can show as free after it sold; the final check before a sale has to read the primary.",
    "queue-backlog": "That is the point of the queue: buyers wait in line instead of hitting inventory.",
  },
};

export const URL_SHORTENER: Scenario = {
  slug: "url-shortener",
  title: "URL shortener",
  summary:
    "A link shortener behind a large social app. People create 100 million short links a month, and each link is opened about 100 times, mostly on its first day. A redirect has to feel instant, and a short code must never point at two different URLs.",
  functional: ["Create a short link for a long URL", "Redirect a short link to its URL", "Optionally choose a custom alias", "Expire links after five years"],
  scale: {
    peakQps: 40_400,
    readWriteRatio: 100,
    notes: [
      { label: "New links", value: "100 million a month (400 per second at peak)" },
      { label: "Redirects at peak", value: "40,000 rps" },
      { label: "Reads per write", value: "100 : 1 (redirects vs. creates)" },
      { label: "Code", value: "7 characters of base62: 3.5 trillion codes" },
      { label: "Kept for", value: "5 years: 6 billion links, about 3 TB" },
    ],
  },
  constraints: [
    { id: "unique-codes", text: "A short code maps to exactly one URL: codes are allocated in a strongly consistent, persistent store.", rules: ["strong-inventory", "replica-reads"] },
    { id: "fast-redirect", text: "p99 of a redirect is at most 100 ms.", rules: ["latency-budget", "cross-region-sync"] },
    { id: "read-path", text: "Redirects outnumber creates 100 to 1; most redirects are answered without touching the database.", rules: ["read-heavy-cache", "load-shedding"] },
    { id: "survive-node-loss", text: "Losing any single node on the request path does not stop redirects.", rules: ["spof"] },
    { id: "peak", text: "Absorb 40,400 rps at peak without any component over capacity.", rules: ["capacity", "client-direct-data"] },
  ],
  params: { readHeavyRatio: 10, p99BudgetMs: 100 },
  rules: [
    { rule: "has-entry" },
    { rule: "client-direct-data", severity: "violation" },
    { rule: "spof" },
    { rule: "capacity" },
    { rule: "strong-inventory" },
    { rule: "latency-budget" },
    { rule: "read-heavy-cache" },
    { rule: "unreachable" },
    { rule: "load-shedding" },
    { rule: "replica-reads" },
    { rule: "cross-region-sync" },
  ],
  why: {
    "strong-inventory": "Two creates can be handed the same code, and one person's link silently opens someone else's URL.",
    "replica-reads": "A link created a moment ago can return not-found from a lagging replica; read a code you just wrote from the primary.",
  },
};

export const NEWS_FEED_FANOUT: Scenario = {
  slug: "news-feed-fanout",
  title: "News feed fan-out",
  summary:
    "The home feed of a social app with 300 million daily users. When someone posts, each follower should see it within a few seconds, and posting must return quickly even for an account with 30 million followers.",
  functional: ["Publish a post", "Read your home feed, newest first", "Follow and unfollow accounts", "Deliver a post to every follower's feed"],
  scale: {
    peakQps: 150_000,
    readWriteRatio: 29,
    notes: [
      { label: "Daily users", value: "300,000,000" },
      { label: "Feed reads at peak", value: "145,000 rps" },
      { label: "Posts at peak", value: "5,000 per second" },
      { label: "Followers", value: "median 200, largest account 30,000,000" },
      { label: "Delivery target", value: "in followers' feeds within 5 s" },
    ],
  },
  constraints: [
    { id: "fast-post", text: "Posting returns within 300 ms at p99 whatever the author's follower count: fan-out happens after the response, through a Pub/Sub topic or queue.", rules: ["async-fanout", "latency-budget", "cross-region-sync"] },
    { id: "fanout-lag", text: "Fan-out lag is visible, and a delivery that keeps failing lands in a dead-letter queue instead of blocking the rest.", rules: ["queue-backlog", "queue-dlq"] },
    { id: "feed-read", text: "Feeds are read 29 times for every post; reads come from a cache or a precomputed feed store, not from joining the follow graph per request.", rules: ["read-heavy-cache", "load-shedding", "replica-reads"] },
    { id: "survive-node-loss", text: "Losing any single node on the request path does not stop posting or reading.", rules: ["spof"] },
    { id: "peak", text: "Absorb 150,000 rps at peak, including the writes fan-out generates, without any component over capacity.", rules: ["capacity", "client-direct-data"] },
  ],
  params: { readHeavyRatio: 10, p99BudgetMs: 300 },
  rules: [
    { rule: "has-entry" },
    { rule: "client-direct-data", severity: "violation" },
    { rule: "spof" },
    { rule: "capacity" },
    { rule: "async-fanout" },
    { rule: "latency-budget" },
    { rule: "read-heavy-cache" },
    { rule: "queue-dlq" },
    { rule: "unreachable" },
    { rule: "load-shedding" },
    { rule: "queue-backlog" },
    { rule: "replica-reads" },
    { rule: "cross-region-sync" },
  ],
  why: {
    "async-fanout": "An author with 30,000,000 followers would hold the request open for 30,000,000 feed writes.",
    "queue-backlog": "That backlog is fan-out lag: followers see the post late by however long the line takes to clear.",
  },
};

export const RATE_LIMITED_API: Scenario = {
  slug: "rate-limited-public-api",
  title: "Rate-limited public API",
  summary:
    "A public REST API used by 50,000 developer keys. Each key may make 100 requests a second, and a few misbehaving clients send far more than that. Paying customers must not feel a noisy neighbour, and the limit has to mean the same thing however many servers enforce it.",
  functional: ["Authenticate each request by API key", "Enforce 100 requests per second per key", "Return 429 with a Retry-After header when over the limit", "Serve reads and writes for the API's resources"],
  scale: {
    peakQps: 120_000,
    readWriteRatio: 4,
    notes: [
      { label: "API keys", value: "50,000" },
      { label: "Limit", value: "100 rps per key" },
      { label: "Peak arrival", value: "120,000 rps, most of it from a few abusive keys" },
      { label: "Legitimate traffic", value: "about 20,000 rps" },
      { label: "Reads per write", value: "4 : 1" },
    ],
  },
  constraints: [
    { id: "limit-first", text: "Every request passes a rate limiter before it reaches an API server or a data store.", rules: ["rate-limit-entry", "client-direct-data"] },
    { id: "one-limit", text: "A key's limit holds across the whole fleet: limiter replicas share their counters, so ten replicas don't allow ten times the limit.", rules: ["limiter-shared-state"] },
    { id: "protect-backend", text: "What the limiter admits fits the API tier and its store at peak, and the rejected share is stated.", rules: ["capacity", "load-shedding", "replica-reads"] },
    { id: "fast-check", text: "Checking the limit adds little: p99 of the whole synchronous path is at most 150 ms.", rules: ["latency-budget", "cross-region-sync"] },
    { id: "survive-node-loss", text: "Losing any single node on the request path does not stop the API or turn the limiter off.", rules: ["spof"] },
  ],
  params: { readHeavyRatio: 10, p99BudgetMs: 150, perKeyLimitRps: 100 },
  rules: [
    { rule: "has-entry" },
    { rule: "client-direct-data", severity: "violation" },
    { rule: "spof" },
    { rule: "capacity" },
    { rule: "rate-limit-entry" },
    { rule: "limiter-shared-state" },
    { rule: "latency-budget" },
    { rule: "unreachable" },
    { rule: "load-shedding" },
    { rule: "replica-reads" },
    { rule: "cross-region-sync" },
  ],
  why: {
    "load-shedding": "Rejected callers should get 429 with Retry-After, not a timeout.",
  },
};

export const FILE_STORAGE_CDN: Scenario = {
  slug: "file-storage-cdn",
  title: "File storage with CDN",
  summary:
    "A photo and document sharing service. People upload files of about 5 MB and share links to them; a popular file can be downloaded millions of times. Files must never be lost, and downloads should come from close to the viewer.",
  functional: ["Upload a file", "Download or preview a file by link", "Share a file with other people or make it public", "List and delete your files"],
  scale: {
    peakQps: 50_000,
    readWriteRatio: 49,
    notes: [
      { label: "Uploads at peak", value: "1,000 per second" },
      { label: "Downloads at peak", value: "49,000 rps" },
      { label: "Average file", value: "5 MB" },
      { label: "New files", value: "2 million a day" },
      { label: "Storage after 3 years", value: "11 PB (11,000,000 GB)" },
    ],
  },
  constraints: [
    { id: "durable", text: "Files are never lost: they live in persistent object storage sized for three years of uploads (11 PB).", rules: ["storage-capacity"] },
    { id: "direct-bytes", text: "File bytes don't stream through API servers: clients upload to and download from storage directly, using signed URLs the API hands out.", rules: ["blob-through-app", "client-direct-data"] },
    { id: "edge-downloads", text: "Downloads are served through a CDN in front of the object store.", rules: ["cdn-for-blobs", "read-heavy-cache", "load-shedding"] },
    { id: "metadata", text: "File metadata (owner, name, sharing) lives in a strongly consistent store, and the API answers within 400 ms at p99.", rules: ["strong-inventory", "replica-reads", "latency-budget", "cross-region-sync"] },
    { id: "peak", text: "Survive the loss of any single node and absorb 50,000 rps at peak without any component over capacity.", rules: ["spof", "capacity"] },
  ],
  params: { readHeavyRatio: 10, p99BudgetMs: 400, avgObjectMb: 5, storage: { kinds: ["object_store"], requiredGb: 11_000_000, what: "three years of files" } },
  rules: [
    { rule: "has-entry" },
    { rule: "client-direct-data", severity: "violation" },
    { rule: "spof" },
    { rule: "capacity" },
    { rule: "storage-capacity" },
    { rule: "blob-through-app", severity: "violation" },
    { rule: "cdn-for-blobs" },
    { rule: "strong-inventory" },
    { rule: "latency-budget" },
    { rule: "read-heavy-cache" },
    { rule: "unreachable" },
    { rule: "load-shedding" },
    { rule: "replica-reads" },
    { rule: "cross-region-sync" },
  ],
  why: {
    "strong-inventory": "A share and a delete can interleave, leaving a deleted file still shared or a private file public.",
    "replica-reads": "A file made private a second ago can still look public on a lagging replica; permission checks read the primary.",
  },
};

export const CHAT_PRESENCE: Scenario = {
  slug: "chat-presence",
  title: "Chat with presence",
  summary:
    "A team chat app with 20 million people connected at once. A message should reach everyone in the channel within a second, and everyone sees who is online. Messages are kept forever; online status is not.",
  functional: ["Send a message to a channel", "Receive channel messages in real time", "See who is online, updated within 30 seconds", "Load channel history"],
  scale: {
    peakQps: 800_000,
    readWriteRatio: 1,
    notes: [
      { label: "Connected at once", value: "20,000,000" },
      { label: "Presence heartbeats", value: "one per client every 30 s: about 670,000 per second" },
      { label: "Messages at peak", value: "100,000 per second" },
      { label: "Peak arrival", value: "800,000 rps, mostly heartbeats" },
      { label: "Average channel", value: "40 members online" },
    ],
  },
  constraints: [
    { id: "realtime", text: "A sender gets an acknowledgment within 200 ms at p99, and delivery to channel members fans out asynchronously through Pub/Sub.", rules: ["async-fanout", "latency-budget", "cross-region-sync"] },
    { id: "durable", text: "An acknowledged message is never lost: it is written to a persistent store before the acknowledgment.", rules: ["durable-store", "replica-reads"] },
    { id: "presence", text: "Online status is ephemeral: heartbeats go to an in-memory store labelled “presence”, never to durable storage.", rules: ["presence-store"] },
    { id: "survive-node-loss", text: "Losing any single node on the request path does not disconnect everyone or stop delivery.", rules: ["spof"] },
    { id: "peak", text: "Hold 800,000 rps at peak with no component over capacity.", rules: ["capacity", "load-shedding", "client-direct-data"] },
  ],
  params: { readHeavyRatio: 10, p99BudgetMs: 200 },
  rules: [
    { rule: "has-entry" },
    { rule: "client-direct-data", severity: "violation" },
    { rule: "spof" },
    { rule: "capacity" },
    { rule: "async-fanout" },
    { rule: "durable-store" },
    { rule: "presence-store" },
    { rule: "latency-budget" },
    { rule: "unreachable" },
    { rule: "load-shedding" },
    { rule: "replica-reads" },
    { rule: "cross-region-sync" },
  ],
  why: {
    "async-fanout": "A channel with 40 members online means 40 deliveries per message; the sender should not wait for the slowest of them.",
  },
};

export const SCENARIOS: Scenario[] = [TICKETING_FLASH_SALE, URL_SHORTENER, NEWS_FEED_FANOUT, RATE_LIMITED_API, FILE_STORAGE_CDN, CHAT_PRESENCE];

export function scenarioBySlug(slug: string | null | undefined): Scenario | null {
  return SCENARIOS.find((s) => s.slug === slug) ?? null;
}
