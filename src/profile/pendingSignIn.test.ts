import { beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  endPendingSignIn();
  sessionStorage.clear();
});

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

  // Regression: with tab storage denied by browser policy, reading
  // `sessionStorage` threw, so even a complete sign-in failed. A complete
  // sign-in needs no storage, and a pending one is still held for the
  // completion this page load sends.
  it("works without tab storage", () => {
    const denied = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
    try {
      expect(
        holdPendingSignIn({ secondFactors: [], enrollableFactors: [] }),
      ).toBeNull();
      holdPendingSignIn(owing);
      expect(pendingSignIn()?.secondFactors).toEqual([StepUpMethod.TOTP]);
      expect(pendingSignInMeta()).toEqual({ "x-csrf-token": "csrf-1" });
      endPendingSignIn();
      expect(pendingSignIn()).toBeNull();
    } finally {
      Object.defineProperty(window, "sessionStorage", denied!);
    }
  });

  // A reload completes the sign-in from the tab's copy of the record.
  it("is completed after a reload from the tab's copy", async () => {
    holdPendingSignIn(owing);
    const reloaded = await freshLoad();
    expect(reloaded.pendingSignIn()?.secondFactors).toEqual([
      StepUpMethod.TOTP,
    ]);
    expect(reloaded.pendingSignInMeta()).toEqual({ "x-csrf-token": "csrf-1" });
  });

  // A copy the reloaded page cannot read is no pending sign-in.
  it("reads a corrupt copy as none", async () => {
    sessionStorage.setItem("sid.pending-sign-in", "{not json");
    expect((await freshLoad()).pendingSignIn()).toBeNull();
    sessionStorage.setItem(
      "sid.pending-sign-in",
      JSON.stringify({ csrf: 1, secondFactors: [], enrollableFactors: [] }),
    );
    expect((await freshLoad()).pendingSignIn()).toBeNull();
  });
});

/** The module as a new page load finds it: nothing held, only the tab's copy. */
async function freshLoad(): Promise<typeof import("./pendingSignIn")> {
  vi.resetModules();
  return import("./pendingSignIn");
}
