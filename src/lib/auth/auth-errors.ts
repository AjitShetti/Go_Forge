/**
 * Supabase auth errors, rewritten for someone signing in. The raw messages
 * ("PKCE code verifier not found in storage…") are for developers.
 */
export function friendlyAuthError(raw: { message?: string | null; code?: string | null } | string | null | undefined): string {
  const message = typeof raw === "string" ? raw : (raw?.message ?? "");
  const code = typeof raw === "string" ? "" : (raw?.code ?? "");
  const text = `${code} ${message}`.toLowerCase();

  if (text.includes("rate limit") || code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return "Too many sign-in emails were requested just now. Wait a minute and try again.";
  }
  if (text.includes("code verifier") || text.includes("pkce") || code === "bad_code_verifier" || code === "flow_state_not_found") {
    return "That link was opened in a different browser from the one you asked for it in. Enter the code from the email instead, or request a new link and open it in this browser.";
  }
  if (code === "email_address_invalid" || (text.includes("email address") && text.includes("invalid"))) {
    return "That email address doesn't look right.";
  }
  if (code === "otp_expired" || text.includes("expired") || text.includes("invalid") || text.includes("not found")) {
    return "That link or code has expired or was already used. Request a new one.";
  }
  return message || "Something went wrong. Try again.";
}
