/**
 * Whether a password change of this session must prove the current password,
 * kept current without polling: the server says how long until it must, by
 * its own clock, and a timer of exactly that length turns it on. Comparing
 * wall clocks would be wrong whenever the device's clock is off.
 */
import { onScopeDispose, readonly, ref } from "vue";
import { passwordChangeRequirementMs } from "./useAuthApi";
import { ErrorReason } from "@structured-id/proto/sid/v1/common/errors";
import { rpcRefusal } from "../../utils/rpcRefusal";
import { WrongCurrentPasswordError } from "./useAuth";

/** Whether `err` refused a change because it did not prove the current password. */
export function isCurrentPasswordRequired(err: unknown): boolean {
  const refusal = rpcRefusal(err);
  return (
    refusal?.reasonCode === ErrorReason.STEP_UP_REQUIRED &&
    refusal.metadata.continuation === "current_password"
  );
}

/**
 * Whether `err` refused a change for a wrong current password: on this
 * device, or by the server for a finalization that did not verify.
 */
export function isWrongCurrentPassword(err: unknown): boolean {
  return (
    err instanceof WrongCurrentPasswordError ||
    rpcRefusal(err)?.reasonCode === ErrorReason.AUTHENTICATION_FAILED
  );
}

/**
 * The requirement of the signed-in session. `required` starts true: until
 * the server answers, asking for the current password is the safe side,
 * since a change that proves it is always accepted.
 */
export function useCurrentPasswordRequirement(
  requiredInMs: () => Promise<number> = passwordChangeRequirementMs,
) {
  const required = ref(true);
  const known = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Bumped by every question and refusal; an older answer is dropped. */
  let generations = 0;

  function stop(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  /** Ask the server and arm the timer for the moment it becomes required. */
  async function refresh(): Promise<void> {
    // The server counted from its answer, which took part of the request's
    // time to arrive: the whole request time is taken off, so the timer
    // fires early rather than late. Measured on the monotonic clock, which a
    // wall clock change does not move.
    const asked = performance.now();
    const generation = ++generations;
    const ms = (await requiredInMs()) - (performance.now() - asked);
    // A refusal, or a newer answer, came while this one was on its way.
    if (generation !== generations) return;
    stop();
    known.value = true;
    required.value = ms <= 0;
    if (ms > 0) {
      timer = setTimeout(() => {
        timer = undefined;
        required.value = true;
      }, ms);
    }
  }

  /** The server refused a change for lack of it: required from now on. */
  function requireNow(): void {
    generations++;
    stop();
    known.value = true;
    required.value = true;
  }

  // An answer still on its way when the owner goes away is dropped like a
  // stale one, so it arms no timer that would outlive the owner.
  onScopeDispose(() => {
    generations++;
    stop();
  });

  return {
    required: readonly(required),
    known: readonly(known),
    refresh,
    requireNow,
  };
}
