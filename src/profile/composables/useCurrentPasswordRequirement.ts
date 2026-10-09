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

/** Whether `err` refused a change because it did not prove the current password. */
export function isCurrentPasswordRequired(err: unknown): boolean {
  const refusal = rpcRefusal(err);
  return (
    refusal?.reasonCode === ErrorReason.STEP_UP_REQUIRED &&
    refusal.metadata.continuation === "current_password"
  );
}

/** Whether `err` refused a change that proved a wrong current password. */
export function isWrongCurrentPassword(err: unknown): boolean {
  return rpcRefusal(err)?.reasonCode === ErrorReason.AUTHENTICATION_FAILED;
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

  function stop(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  /** Ask the server and arm the timer for the moment it becomes required. */
  async function refresh(): Promise<void> {
    // The server counted from its answer, which took part of the request's
    // time to arrive: the whole request time is taken off, so the timer
    // fires early rather than late.
    const asked = Date.now();
    const ms = (await requiredInMs()) - (Date.now() - asked);
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
    stop();
    known.value = true;
    required.value = true;
  }

  onScopeDispose(stop);

  return {
    required: readonly(required),
    known: readonly(known),
    refresh,
    requireNow,
  };
}
