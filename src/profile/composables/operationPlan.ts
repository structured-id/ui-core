/**
 * The time plan of a password operation, so a display shows how much is
 * left: each step takes the share of the gauge its expected duration takes
 * of the whole, the expected durations are what the steps took before on
 * this device (a moving average kept in the browser), and each report says
 * where the current step ends and how long it is expected to last from now.
 * A display then moves at the expected pace between reports instead of
 * jumping at each one.
 */

/**
 * What a password operation is doing, as the user can follow it: confirming
 * the current password (a change that proves it), deriving its request on
 * this device, comparing with previous passwords, proving, and finishing
 * (the client's record and the server's check).
 */
export type PasswordOperationStep =
  "confirm" | "protect" | "compare" | "prove" | "verify";

/** Progress of a password operation, for a gauge that tracks time left. */
export interface PasswordOperationProgress {
  /** The step the operation is in. */
  step?: PasswordOperationStep;
  /** Where the operation is now, 0..1, never moving backwards. */
  fraction: number;
  label: string;
  /** Where the current step ends on the gauge, 0..1. */
  until?: number;
  /** How long the rest of the current step is expected to take, ms. */
  remainingMs?: number;
}

export const STEP_LABEL: Record<PasswordOperationStep, string> = {
  confirm: "Confirming your current password",
  protect: "Protecting your password on this device",
  compare: "Checking it against your previous passwords",
  prove: "Building the proof",
  verify: "Sealing it and checking with the server",
};

/** The steps of installing a password: registration, reset, a change. */
export const INSTALL_STEPS: readonly PasswordOperationStep[] = [
  "protect",
  "compare",
  "prove",
  "verify",
];

/** A change that proves the current password first. */
export const CONFIRMED_CHANGE_STEPS: readonly PasswordOperationStep[] = [
  "confirm",
  ...INSTALL_STEPS,
];

const ALL_STEPS = CONFIRMED_CHANGE_STEPS;

/**
 * Step times (ms) before anything was measured here: a mid-range phone
 * (measured on a 2025 one) with the prover's key already prepared.
 */
export const DEFAULT_STEP_MS: Record<PasswordOperationStep, number> = {
  confirm: 400,
  protect: 150,
  compare: 150,
  prove: 4000,
  verify: 2400,
};

/** Where the measured times live in the browser. */
const STORE_KEY = "sid:password-operation-ms";
/** Weight of the newest measurement in the moving average. */
const ALPHA = 0.4;

/** Clock and storage, replaceable in tests. */
export interface PlanEnvironment {
  now: () => number;
  load: () => string | null;
  save: (value: string) => void;
}

const browser: PlanEnvironment = {
  now: () => performance.now(),
  // Storage can be missing or refuse (private mode): the defaults then apply
  // and nothing is kept, which only costs accuracy.
  load: () => {
    try {
      return globalThis.localStorage?.getItem(STORE_KEY) ?? null;
    } catch {
      return null;
    }
  },
  save: (value) => {
    try {
      globalThis.localStorage?.setItem(STORE_KEY, value);
    } catch {
      // Not kept; the next operation starts from the defaults again.
    }
  },
};

/** The expected step times: measured ones where valid, the defaults otherwise. */
function expected(env: PlanEnvironment): Record<PasswordOperationStep, number> {
  const out = { ...DEFAULT_STEP_MS };
  try {
    const stored = JSON.parse(env.load() ?? "{}") as Record<string, unknown>;
    for (const step of ALL_STEPS) {
      const ms = stored[step];
      if (typeof ms === "number" && Number.isFinite(ms) && ms > 0)
        out[step] = ms;
    }
  } catch {
    // A malformed record is ignored: defaults apply.
  }
  return out;
}

/**
 * One operation's plan over its `steps`: its reports, and what it measured
 * when it ends.
 */
export class OperationPlan {
  private readonly ms: Record<PasswordOperationStep, number>;
  private readonly start: Partial<Record<PasswordOperationStep, number>> = {};
  private readonly width: Partial<Record<PasswordOperationStep, number>> = {};
  private readonly measured: Partial<Record<PasswordOperationStep, number>> =
    {};
  private current: PasswordOperationStep | undefined;
  private enteredAt = 0;
  private last = 0;

  constructor(
    private readonly report?: (p: PasswordOperationProgress) => void,
    steps: readonly PasswordOperationStep[] = INSTALL_STEPS,
    private readonly env: PlanEnvironment = browser,
  ) {
    this.ms = expected(env);
    const total = steps.reduce((sum, s) => sum + this.ms[s], 0);
    let at = 0;
    for (const step of steps) {
      this.start[step] = at;
      this.width[step] = this.ms[step] / total;
      at += this.width[step];
    }
  }

  /** The operation entered `step`. */
  enter(step: PasswordOperationStep): void {
    const now = this.env.now();
    this.close(now);
    this.current = step;
    this.enteredAt = now;
    this.emit(step, 0);
  }

  /** The current step reached `within` (0..1) of its own work. */
  within(within: number): void {
    if (this.current) this.emit(this.current, within);
  }

  /**
   * The operation succeeded: report it complete, and keep what its steps
   * took for the next plan.
   */
  finish(): void {
    this.close(this.env.now());
    if (this.current) {
      // Exactly 1: the summed step shares can fall short of it by rounding.
      this.last = 1;
      this.report?.({
        step: this.current,
        fraction: 1,
        label: STEP_LABEL[this.current],
        until: 1,
        remainingMs: 0,
      });
    }
    const next = { ...this.ms };
    for (const step of ALL_STEPS) {
      const took = this.measured[step];
      if (took !== undefined)
        next[step] = next[step] * (1 - ALPHA) + took * ALPHA;
    }
    this.env.save(JSON.stringify(next));
  }

  private close(now: number): void {
    if (this.current) this.measured[this.current] = now - this.enteredAt;
  }

  private emit(step: PasswordOperationStep, within: number): void {
    const start = this.start[step];
    const width = this.width[step];
    // A step outside this plan is a caller's mistake: it reports nothing
    // rather than a position the gauge does not have.
    if (start === undefined || width === undefined) return;
    const done = Math.min(1, Math.max(0, within));
    const fraction = Math.max(this.last, start + width * done);
    this.last = fraction;
    this.report?.({
      step,
      fraction,
      label: STEP_LABEL[step],
      until: start + width,
      remainingMs: this.ms[step] * (1 - done),
    });
  }
}
