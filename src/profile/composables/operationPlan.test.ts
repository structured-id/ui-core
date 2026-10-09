import { describe, expect, it } from "vitest";
import {
  CONFIRMED_CHANGE_STEPS,
  DEFAULT_STEP_MS,
  INSTALL_STEPS,
  OperationPlan,
  type PasswordOperationProgress,
  type PasswordOperationStep,
  type PlanEnvironment,
} from "./operationPlan";

/** A clock moved by hand and a store kept in a variable. */
function environment(stored: string | null = null) {
  const env = {
    t: 0,
    stored,
    now: () => env.t,
    load: () => env.stored,
    save: (value: string) => {
      env.stored = value;
    },
  };
  return env satisfies PlanEnvironment;
}

function planWith(
  stored: string | null = null,
  steps: readonly PasswordOperationStep[] = INSTALL_STEPS,
) {
  const env = environment(stored);
  const seen: PasswordOperationProgress[] = [];
  const plan = new OperationPlan((p) => seen.push(p), steps, env);
  return { env, seen, plan };
}

const total = INSTALL_STEPS.reduce((a, s) => a + DEFAULT_STEP_MS[s], 0);

describe("OperationPlan", () => {
  // Each step takes the gauge share its expected time takes of the whole,
  // and a report says where the step ends and how long it should take.
  it("gives each step its share of the expected time", () => {
    const { seen, plan } = planWith();
    plan.enter("protect");
    plan.enter("compare");
    const protect = DEFAULT_STEP_MS.protect / total;
    expect(seen[0]).toMatchObject({
      step: "protect",
      fraction: 0,
      remainingMs: DEFAULT_STEP_MS.protect,
    });
    expect(seen[0].until).toBeCloseTo(protect, 10);
    expect(seen[1].fraction).toBeCloseTo(protect, 10);
  });

  // The prover's progress fills the proof's share, and what is left of the
  // step's time shrinks with it.
  it("fills a step with its own progress", () => {
    const { seen, plan } = planWith();
    plan.enter("prove");
    plan.within(0.5);
    const start = (DEFAULT_STEP_MS.protect + DEFAULT_STEP_MS.compare) / total;
    const width = DEFAULT_STEP_MS.prove / total;
    expect(seen[1].fraction).toBeCloseTo(start + width / 2, 10);
    expect(seen[1].remainingMs).toBe(DEFAULT_STEP_MS.prove / 2);
  });

  it("never moves backwards", () => {
    const { seen, plan } = planWith();
    plan.enter("prove");
    plan.within(0.6);
    plan.within(0.2);
    expect(seen[2].fraction).toBe(seen[1].fraction);
  });

  // A finished operation keeps what its steps took, as a moving average, and
  // the next plan on this device starts from it.
  it("learns the device's step times", () => {
    const { env, plan } = planWith();
    plan.enter("protect");
    env.t = 600;
    plan.enter("compare");
    env.t = 1100;
    plan.enter("prove");
    env.t = 12_100; // a slow phone: 11 s of proving
    plan.enter("verify");
    env.t = 14_100;
    plan.finish();
    const learned = JSON.parse(env.stored ?? "{}");
    expect(learned.prove).toBeCloseTo(
      DEFAULT_STEP_MS.prove * 0.6 + 11_000 * 0.4,
      6,
    );
    expect(learned.verify).toBeCloseTo(
      DEFAULT_STEP_MS.verify * 0.6 + 2000 * 0.4,
      6,
    );

    const next = planWith(env.stored);
    next.plan.enter("prove");
    expect(next.seen[0].remainingMs).toBeCloseTo(learned.prove, 6);
  });

  // A finished operation reports itself complete, so every progress
  // consumer ends at the full gauge rather than where verification began.
  it("reports completion when it finishes", () => {
    const { seen, plan } = planWith();
    plan.enter("verify");
    plan.finish();
    expect(seen.at(-1)).toMatchObject({
      step: "verify",
      fraction: 1,
      until: 1,
      remainingMs: 0,
    });
  });

  // A change that confirms the current password gives that step its share
  // first; an operation without it never reports it and keeps its gauge.
  it("adds the confirmation only to the plan that has it", () => {
    const withConfirm = planWith(null, CONFIRMED_CHANGE_STEPS);
    withConfirm.plan.enter("confirm");
    withConfirm.plan.enter("protect");
    const all = total + DEFAULT_STEP_MS.confirm;
    expect(withConfirm.seen[0]).toMatchObject({ step: "confirm", fraction: 0 });
    expect(withConfirm.seen[0].until).toBeCloseTo(
      DEFAULT_STEP_MS.confirm / all,
      10,
    );
    expect(withConfirm.seen[1].fraction).toBeCloseTo(
      DEFAULT_STEP_MS.confirm / all,
      10,
    );

    const without = planWith();
    without.plan.enter("confirm");
    without.plan.enter("protect");
    expect(without.seen).toHaveLength(1);
    expect(without.seen[0]).toMatchObject({ step: "protect", fraction: 0 });
  });

  // A refused operation teaches nothing; an unreadable record is ignored.
  it("ignores a malformed record and learns only from a finished operation", () => {
    const { env, seen, plan } = planWith("{not json");
    plan.enter("protect");
    expect(seen[0].remainingMs).toBe(DEFAULT_STEP_MS.protect);
    env.t = 5000;
    plan.enter("compare");
    expect(env.stored).toBe("{not json");
    const bad = planWith(JSON.stringify({ prove: -1, verify: "x" }));
    bad.plan.enter("prove");
    expect(bad.seen[0].remainingMs).toBe(DEFAULT_STEP_MS.prove);
  });
});
