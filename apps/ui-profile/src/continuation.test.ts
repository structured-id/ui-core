import { describe, expect, it } from "vitest";
import { withContinuation } from "./continuation";

describe("withContinuation", () => {
  // Regression: moving between sign-in and registration dropped `rd`, so a
  // registration started from an application's authorization request ended
  // in the account pages instead of back at that request.
  it("carries the authorization continuation to the next page", () => {
    const rd =
      "https://sid.example.com/oauth2/authorize?client_id=a&request_uri=urn%3Ax";
    expect(withContinuation("/account/register", { rd })).toBe(
      `/account/register?rd=${encodeURIComponent(rd)}`,
    );
  });

  // Without a continuation the link stays bare; the page that follows it
  // validates any `rd` again before using it.
  it("leaves the link bare without one", () => {
    expect(withContinuation("/account/login", {})).toBe("/account/login");
    expect(withContinuation("/account/login", { rd: ["a", "b"] })).toBe(
      "/account/login",
    );
  });
});
