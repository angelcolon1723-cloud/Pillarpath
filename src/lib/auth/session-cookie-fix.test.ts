import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAuthCookiePath } from "./session-cookie-fix.server.ts";

describe("isAuthCookiePath", () => {
  it("covers email sign-in/sign-up (session cookies)", () => {
    assert.equal(isAuthCookiePath("/sign-in/email"), true);
    assert.equal(isAuthCookiePath("/sign-up/email"), true);
  });

  it("covers OAuth initiation endpoints (signed state cookie)", () => {
    // The `state` cookie set here is what the callback checks — a dropped
    // Set-Cookie on initiation surfaces as `state_mismatch` at callback.
    assert.equal(isAuthCookiePath("/sign-in/social"), true);
    assert.equal(isAuthCookiePath("/sign-in/oauth2"), true);
  });

  it("covers OAuth callbacks (social + generic oauth2)", () => {
    assert.equal(isAuthCookiePath("/callback/google"), true);
    assert.equal(isAuthCookiePath("/oauth2/callback/instagram"), true);
  });

  it("ignores unrelated and empty paths", () => {
    assert.equal(isAuthCookiePath("/sign-in"), false);
    assert.equal(isAuthCookiePath("/get-session"), false);
    assert.equal(isAuthCookiePath(undefined), false);
    assert.equal(isAuthCookiePath(""), false);
  });
});
