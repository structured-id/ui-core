import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { RpcError } from "@protobuf-ts/runtime-rpc";
import { base64encode } from "@protobuf-ts/runtime";
import { Any } from "@structured-id/proto/google/protobuf/any";
import { Status } from "@structured-id/proto/google/rpc/status";
import { ErrorInfo } from "@structured-id/proto/google/rpc/error_details";
import {
  isCurrentPasswordRequired,
  isWrongCurrentPassword,
  useCurrentPasswordRequirement,
} from "./useCurrentPasswordRequirement";

/** A refusal with `reason` and `metadata` in its ErrorInfo. */
function refused(reason: string, metadata: Record<string, string>): RpcError {
  const info = Any.pack(
    ErrorInfo.create({ reason, domain: "structured.id", metadata }),
    ErrorInfo,
  );
  const status = Status.create({ code: 9, message: "", details: [info] });
  return new RpcError("", "FAILED_PRECONDITION", {
    "grpc-status-details-bin": base64encode(Status.toBinary(status)),
  });
}

/** The composable inside a scope the test can end, with the server's answer given. */
function requirement(ms: number) {
  const scope = effectScope();
  const r = scope.run(() => useCurrentPasswordRequirement(async () => ms))!;
  return { ...r, scope };
}

describe("useCurrentPasswordRequirement", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // Until the server answers, the current password is asked for: a change
  // that proves it is never refused.
  it("requires the current password until the server answers", () => {
    const r = requirement(180_000);
    expect(r.required.value).toBe(true);
    expect(r.known.value).toBe(false);
  });

  // The field appears exactly when the server's countdown ends, with no
  // further request.
  it("turns on when the server's countdown ends", async () => {
    const r = requirement(180_000);
    await r.refresh();
    expect(r.required.value).toBe(false);
    expect(r.known.value).toBe(true);
    vi.advanceTimersByTime(179_999);
    expect(r.required.value).toBe(false);
    vi.advanceTimersByTime(1);
    expect(r.required.value).toBe(true);
  });

  // The server counted from when it answered; the answer took time to
  // arrive, so the timer is shortened by the request's own time and never
  // fires after the server already requires the password.
  it("subtracts the request's time from the countdown", async () => {
    const scope = effectScope();
    const r = scope.run(() =>
      useCurrentPasswordRequirement(
        () =>
          new Promise<number>((resolve) =>
            setTimeout(() => resolve(10_000), 400),
          ),
      ),
    )!;
    const refreshed = r.refresh();
    await vi.advanceTimersByTimeAsync(400);
    await refreshed;
    expect(r.required.value).toBe(false);
    await vi.advanceTimersByTimeAsync(9_599);
    expect(r.required.value).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(r.required.value).toBe(true);
    scope.stop();
  });

  it("is required at once when the server says zero", async () => {
    const r = requirement(0);
    await r.refresh();
    expect(r.required.value).toBe(true);
  });

  // A refusal for lack of it wins over a countdown that has not ended (the
  // clocks disagreed): the timer is dropped and the field stays.
  it("requires it after a refusal, dropping the countdown", async () => {
    const r = requirement(180_000);
    await r.refresh();
    r.requireNow();
    expect(r.required.value).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops its timer when its owner goes away", async () => {
    const r = requirement(180_000);
    await r.refresh();
    r.scope.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("isCurrentPasswordRequired", () => {
  // Only the step-up whose continuation is the current password counts; a
  // step-up for a second factor needs another prompt.
  it("recognizes only the current-password continuation", () => {
    expect(
      isCurrentPasswordRequired(
        refused("STEP_UP_REQUIRED", { continuation: "current_password" }),
      ),
    ).toBe(true);
    expect(
      isCurrentPasswordRequired(
        refused("STEP_UP_REQUIRED", { continuation: "step_up" }),
      ),
    ).toBe(false);
    expect(
      isCurrentPasswordRequired(
        refused("PASSWORD_REUSED", { continuation: "current_password" }),
      ),
    ).toBe(false);
    expect(isCurrentPasswordRequired(new Error("offline"))).toBe(false);
  });
});

describe("isWrongCurrentPassword", () => {
  // A change that proved a wrong current password is refused as a wrong
  // sign-in; any other refusal is not that.
  it("recognizes the refused sign-in", () => {
    expect(isWrongCurrentPassword(refused("AUTHENTICATION_FAILED", {}))).toBe(
      true,
    );
    expect(isWrongCurrentPassword(refused("PASSWORD_REUSED", {}))).toBe(false);
  });
});
