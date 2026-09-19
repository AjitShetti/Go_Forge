import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "@/lib/auth/auth-errors";

describe("friendlyAuthError", () => {
  it("explains the email rate limit", () => {
    expect(friendlyAuthError({ message: "email rate limit exceeded", code: "over_email_send_rate_limit" })).toMatch(/Wait a minute/);
  });

  it("explains a link opened in another browser", () => {
    const raw = "PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device";
    expect(friendlyAuthError(raw)).toMatch(/different browser/);
    expect(friendlyAuthError(raw)).not.toMatch(/PKCE|SSR/);
  });

  it("explains expired links and codes", () => {
    expect(friendlyAuthError({ message: "Token has expired or is invalid", code: "otp_expired" })).toMatch(/expired or was already used/);
    expect(friendlyAuthError("Email link is invalid or has expired")).toMatch(/expired or was already used/);
  });

  it("does not call a bad email address an expired link", () => {
    expect(friendlyAuthError({ message: 'Email address "x@y" is invalid', code: "email_address_invalid" })).toMatch(/doesn't look right/);
  });

  it("passes other messages through", () => {
    expect(friendlyAuthError("Supabase is not configured")).toBe("Supabase is not configured");
    expect(friendlyAuthError(null)).toBe("Something went wrong. Try again.");
  });
});
