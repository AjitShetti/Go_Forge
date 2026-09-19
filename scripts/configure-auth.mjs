#!/usr/bin/env node
/**
 * Applies Go Forge's Supabase Auth settings through the Management API, so they
 * live in the repo instead of only in the dashboard.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_…  node scripts/configure-auth.mjs            # dry run: prints the diff
 *   SUPABASE_ACCESS_TOKEN=sbp_…  node scripts/configure-auth.mjs --apply
 *
 * Always set:
 *   - Site URL and redirect allow-list.
 *   - Email templates whose link uses token_hash (works in any browser, unlike PKCE
 *     ?code= links) and that also show the one-time code for typing in.
 * Set only when the env vars are present (secrets never live in the repo):
 *   - Custom SMTP: SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM [SMTP_SENDER_NAME] [EMAIL_RATE_PER_HOUR]
 *   - GitHub sign-in: GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET
 *
 * The access token is a personal one from supabase.com/dashboard/account/tokens.
 * Revoke it after running.
 */

const REF = "qevyjanefkagxnxxbvns";
const SITE = "https://go-forge.vercel.app";
const env = process.env;
const apply = process.argv.includes("--apply");

if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error("Set SUPABASE_ACCESS_TOKEN (supabase.com/dashboard/account/tokens).");
  process.exit(1);
}

const link = "{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email";
const template = (heading, action) => `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 16px">${heading}</h2>
  <p>${action}</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#00add8;color:#0b0b0b;padding:12px 20px;text-decoration:none;font-weight:600;display:inline-block">Sign in to Go Forge</a></p>
  <p>Or type this code on the sign-in page:</p>
  <p style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:28px;letter-spacing:6px;margin:8px 0 24px"><strong>{{ .Token }}</strong></p>
  <p style="color:#666;font-size:13px">The link and code expire in one hour and work once. If you didn't ask to sign in, ignore this email.</p>
</div>`;

const body = {
  site_url: SITE,
  uri_allow_list: [`${SITE}/**`, "http://localhost:3000/**"].join(","),
  mailer_subjects_magic_link: "Your Go Forge sign-in link",
  mailer_templates_magic_link_content: template("Sign in to Go Forge", "Tap the button to sign in. It works in any browser."),
  mailer_subjects_confirmation: "Welcome to Go Forge: confirm your email",
  mailer_templates_confirmation_content: template("Welcome to Go Forge", "Tap the button to confirm your email and sign in. It works in any browser."),
};

if (env.SMTP_HOST) {
  for (const k of ["SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"]) {
    if (!env[k]) throw new Error(`SMTP_HOST is set but ${k} is missing`);
  }
  Object.assign(body, {
    smtp_host: env.SMTP_HOST,
    smtp_port: Number(env.SMTP_PORT),
    smtp_user: env.SMTP_USER,
    smtp_pass: env.SMTP_PASS,
    smtp_admin_email: env.SMTP_FROM,
    smtp_sender_name: env.SMTP_SENDER_NAME ?? "Go Forge",
    rate_limit_email_sent: Number(env.EMAIL_RATE_PER_HOUR ?? 60),
  });
}

if (env.GITHUB_CLIENT_ID) {
  if (!env.GITHUB_CLIENT_SECRET) throw new Error("GITHUB_CLIENT_ID is set but GITHUB_CLIENT_SECRET is missing");
  Object.assign(body, {
    external_github_enabled: true,
    external_github_client_id: env.GITHUB_CLIENT_ID,
    external_github_secret: env.GITHUB_CLIENT_SECRET,
  });
}

const api = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
const headers = { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" };

const current = await fetch(api, { headers });
if (!current.ok) throw new Error(`GET config/auth: ${current.status} ${await current.text()}`);
const before = await current.json();

const secret = (k) => /pass|secret/.test(k);
const show = (k, v) => (secret(k) ? (v ? "(set)" : "(empty)") : typeof v === "string" && v.length > 70 ? `${v.slice(0, 67)}…` : JSON.stringify(v));
for (const [k, v] of Object.entries(body)) {
  if (secret(k) || before[k] !== v) console.log(`${k}\n  now:  ${show(k, before[k])}\n  want: ${show(k, v)}`);
}
console.log(`\nSMTP: ${env.SMTP_HOST ? "custom" : before.smtp_host ? `custom (${before.smtp_host}, unchanged)` : "built-in, 2 emails/hour for the whole project"}`);
console.log(`GitHub sign-in: ${env.GITHUB_CLIENT_ID ? "enabling" : before.external_github_enabled ? "on (unchanged)" : "off"}`);

if (!apply) {
  console.log("\nDry run. Re-run with --apply to write these settings.");
  process.exit(0);
}
const res = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(body) });
if (!res.ok) throw new Error(`PATCH config/auth: ${res.status} ${await res.text()}`);
console.log("\nApplied.");
