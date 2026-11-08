import { beforeEach, describe, expect, it } from "vitest";
import { StepUpMethod } from "@structured-id/proto/sid/v1/authn/auth";
import {
  endPendingSignIn,
  holdPendingSignIn,
  pendingSignIn,
  pendingSignInMeta,
} from "./pendingSignIn";

const owing = {
  secondFactors: [StepUpMethod.TOTP],
  enrollableFactors: [],
  browserCsrf: "csrf-1",
};

beforeEach(() => sessionStorage.clear());

describe("pending sign-in", () => {
  // A sign-in owing its second factor is kept with the CSRF token its
  // completion sends; the token is not part of what pages read.
  it("keeps a sign-in that owes a factor", () => {
    expect(holdPendingSignIn(owing)).toEqual({
      secondFactors: [StepUpMethod.TOTP],
      enrollableFactors: [],
    });
    expect(pendingSignIn()).toEqual({
      secondFactors: [StepUpMethod.TOTP],
      enrollableFactors: [],
    });
    expect(pendingSignInMeta()).toEqual({ "x-csrf-token": "csrf-1" });
  });

  // An account that must enroll its first factor is pending too.
  it("keeps a sign-in that must enroll its first factor", () => {
    holdPendingSignIn({
      secondFactors: [],
      enrollableFactors: [StepUpMethod.TOTP],
      browserCsrf: "csrf-2",
    });
    expect(pendingSignIn()?.enrollableFactors).toEqual([StepUpMethod.TOTP]);
    expect(pendingSignInMeta()).toEqual({ "x-csrf-token": "csrf-2" });
  });

  // A complete sign-in replaces an earlier pending one: the earlier token
  // is never sent with the new session.
  it("forgets an earlier pending sign-in when a sign-in completes", () => {
    holdPendingSignIn(owing);
    expect(
      holdPendingSignIn({ secondFactors: [], enrollableFactors: [] }),
    ).toBeNull();
    expect(pendingSignIn()).toBeNull();
    expect(pendingSignInMeta()).toEqual({});
  });

  // Without its CSRF token the browser cannot complete the context; the
  // answer is refused loudly rather than kept unusable.
  it("refuses a pending answer without its CSRF token", () => {
    expect(() =>
      holdPendingSignIn({ ...owing, browserCsrf: undefined }),
    ).toThrow();
    expect(pendingSignIn()).toBeNull();
  });

  it("ends the pending sign-in", () => {
    holdPendingSignIn(owing);
    endPendingSignIn();
    expect(pendingSignIn()).toBeNull();
    expect(pendingSignInMeta()).toEqual({});
  });

  // A record this tab cannot read is no pending sign-in.
  it("reads a corrupt record as none", () => {
    sessionStorage.setItem("sid.pending-sign-in", "{not json");
    expect(pendingSignIn()).toBeNull();
    sessionStorage.setItem(
      "sid.pending-sign-in",
      JSON.stringify({ csrf: 1, secondFactors: [], enrollableFactors: [] }),
    );
    expect(pendingSignIn()).toBeNull();
  });
});
