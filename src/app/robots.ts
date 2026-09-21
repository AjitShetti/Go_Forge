import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Crawlers get the teaching material and nothing else. The disallowed routes are
 * per-learner views (progress, notes, review queue, saved designs) - a crawler
 * signed out sees an empty shell of each, and a pile of near-identical empty pages
 * is a thin-content signal working against the pages that do matter.
 *
 * /engine is deliberately not on this list: it is a real page about running the gc
 * toolchain in the browser, and one of the few things here someone might search for
 * directly.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/auth/", "/dashboard", "/notebook", "/review", "/canvas", "/login"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
