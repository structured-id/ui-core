import { describe, expect, it } from "vitest";
import {
  DEFAULT_STEP_MS,
  OperationPlan,
  type PasswordOperationProgress,
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

function planWith(stored: string | null = null) {
  const env = environment(stored);
  const seen: PasswordOperationProgress[] = [];
  const plan = new OperationPlan((p) => seen.push(p), env);
  return { env, seen, plan };
}

const total = Object.values(DEFAULT_STEP_MS).reduce((a, b) => a + b, 0);

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
