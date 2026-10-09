import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import SidPasswordCeremony from "./SidPasswordCeremony.vue";
import type { PasswordOperationProgress } from "../profile/composables/useAuth";

const stubs = {
  "q-icon": {
    props: ["name"],
    template: '<i class="icon" :data-name="name" />',
  },
  "q-banner": { template: '<div class="reason"><slot /></div>' },
};

const at = (
  step: PasswordOperationProgress["step"],
  fraction: number,
  label: string,
): PasswordOperationProgress => ({ step, fraction, label });

function mountCeremony(props: Record<string, unknown> = {}) {
  return mount(SidPasswordCeremony, {
    props: { progress: null, outcome: "running", length: 12, ...props },
    global: { stubs },
  });
}

type Ceremony = ReturnType<typeof mountCeremony>;
const rows = (w: Ceremony) => w.findAll(".sid-ceremony__row");
const glyphs = (w: Ceremony) =>
  rows(w)[0]
    .findAll(".sid-ceremony__glyph")
    .map((g) => g.text());
const label = (w: Ceremony) => w.find(".sid-ceremony__label").text();
const phase = (w: Ceremony) =>
  w
    .classes()
    .find((c) => c.startsWith("sid-ceremony--") && c !== "sid-ceremony--still");

/** Past the opening: the rows have turned into digits and merged. */
async function merged() {
  await vi.advanceTimersByTimeAsync(1300);
}

describe("SidPasswordCeremony", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // One row per password field, each as long as the password (capped);
  // the rows are digits, never the password's characters.
  it("turns each field into a row of digits", async () => {
    const w = mountCeremony({ fields: 2, length: 15 });
    await vi.advanceTimersByTimeAsync(320);
    expect(rows(w)).toHaveLength(2);
    expect(glyphs(w)).toHaveLength(15);
    expect(glyphs(w).some((g) => /^[0-9]$/.test(g))).toBe(true);
    expect(glyphs(w).every((g) => /^[0-9●]$/.test(g))).toBe(true);
    expect(glyphs(mountCeremony({ length: 80 }))).toHaveLength(20);
  });

  // The rows start in the fields' places and merge into one centre line.
  it("merges the rows into one line", async () => {
    const w = mountCeremony({ fields: 2 });
    expect(phase(w)).toBe("sid-ceremony--split");
    expect(rows(w)[1].attributes("style")).toContain("translateY(72px)");
    await merged();
    expect(phase(w)).toBe("sid-ceremony--line");
    expect(rows(w)[0].attributes("style")).toContain("translateY(36px)");
    expect(rows(w)[1].attributes("style")).toContain("translateY(36px)");
  });

  // The digits settle into dots from the left as far as the operation went.
  it("settles digits into dots as the operation advances", async () => {
    const w = mountCeremony({ length: 10 });
    await merged();
    await w.setProps({ progress: at("prove", 0.5, "Building the proof") });
    await vi.advanceTimersByTimeAsync(200);
    expect(glyphs(w).slice(0, 5)).toEqual(["●", "●", "●", "●", "●"]);
    expect(w.find("[role=progressbar]").attributes("aria-valuenow")).toBe("50");
  });

  // Between reports the line moves at the pace the report expects for the
  // rest of its step, so it shows the time left; it stops short of the
  // step's end until the step reports done, and never moves back.
  it("moves at the expected pace between reports", async () => {
    const w = mountCeremony();
    const now = () =>
      Number(w.find("[role=progressbar]").attributes("aria-valuenow"));
    await w.setProps({
      progress: {
        step: "prove",
        fraction: 0.2,
        label: "Building the proof",
        until: 0.6,
        remainingMs: 2000,
      },
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(now()).toBeGreaterThanOrEqual(39);
    expect(now()).toBeLessThanOrEqual(41);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(now(), "short of the step's end").toBe(58);
    await w.setProps({
      progress: {
        step: "prove",
        fraction: 0.3,
        label: "Building the proof",
        until: 0.6,
        remainingMs: 1500,
      },
    });
    await vi.advanceTimersByTimeAsync(40);
    expect(now(), "a late report never moves it back").toBe(58);
  });

  // A prover still at its first stage keeps reporting the step's start; the
  // line goes on at the expected pace instead of restarting from it.
  it("is not held back by reports that lag behind it", async () => {
    const w = mountCeremony();
    const now = () =>
      Number(w.find("[role=progressbar]").attributes("aria-valuenow"));
    const lagging = {
      step: "prove" as const,
      fraction: 0.2,
      label: "Building the proof",
      until: 0.6,
      remainingMs: 4000,
    };
    await w.setProps({ progress: lagging });
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(200);
      await w.setProps({ progress: { ...lagging } });
    }
    // 2 s of a 4 s step: about halfway from 0.2 to 0.6.
    expect(now()).toBeGreaterThanOrEqual(36);
  });

  // A short step never replaces the label on screen; a lasting one does.
  it("shows a step's label only once the step has lasted", async () => {
    const w = mountCeremony();
    expect(label(w)).toBe("Protecting your password on this device");
    await w.setProps({ progress: at("protect", 0, "Protecting") });
    expect(label(w)).toBe("Protecting");
    await w.setProps({ progress: at("compare", 0.08, "Comparing") });
    await vi.advanceTimersByTimeAsync(100);
    await w.setProps({ progress: at("prove", 0.2, "Building the proof") });
    await vi.advanceTimersByTimeAsync(100);
    expect(label(w)).toBe("Protecting");
    await vi.advanceTimersByTimeAsync(400);
    expect(label(w)).toBe("Building the proof");
  });

  // Success: the line closes into the orb, the lock appears, then the
  // check; only then is the form told.
  it("closes into the orb, then the lock, then the check", async () => {
    const w = mountCeremony({ acceptedText: "Password changed" });
    await merged();
    await w.setProps({ outcome: "accepted" });
    expect(phase(w)).toBe("sid-ceremony--orb");
    expect(w.find(".sid-ceremony__orb").exists()).toBe(true);
    expect(w.find(".icon").exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(650);
    expect(w.find(".icon").attributes("data-name")).toBe("sym_o_lock");
    expect(label(w)).toBe("Password changed");
    await vi.advanceTimersByTimeAsync(450);
    expect(w.find(".icon").attributes("data-name")).toBe("sym_o_check");
    expect(w.emitted("settled")).toBeUndefined();
    await vi.advanceTimersByTimeAsync(700);
    expect(w.emitted("settled")).toEqual([["accepted"]]);
  });

  // Refusal: no orb ever forms; the line unfolds back into the fields as
  // dots, the reason shows above them, then the form takes over.
  it("unfolds back into the fields after a refusal", async () => {
    const w = mountCeremony({ fields: 2, refusedText: "Used before" });
    await merged();
    await w.setProps({ outcome: "refused" });
    expect(w.find(".sid-ceremony__orb").exists()).toBe(false);
    expect(phase(w)).toBe("sid-ceremony--unfolding");
    expect(rows(w)[1].attributes("style")).toContain("translateY(72px)");
    expect(glyphs(w).every((g) => g === "●")).toBe(true);
    await vi.advanceTimersByTimeAsync(650);
    expect(w.find(".reason").text()).toBe("Used before");
    expect(w.emitted("settled")).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1600);
    expect(w.emitted("settled")).toEqual([["refused"]]);
    expect(w.find(".sid-ceremony__orb").exists()).toBe(false);
  });

  // An outcome that arrives while the rows are still merging waits for the
  // line, so the choreography is never cut short, and runs once.
  it("lets the rows merge before an early outcome", async () => {
    const w = mountCeremony();
    await w.setProps({ outcome: "refused" });
    expect(phase(w)).toBe("sid-ceremony--split");
    await merged();
    expect(phase(w)).toBe("sid-ceremony--unfolding");
    await vi.advanceTimersByTimeAsync(5000);
    expect(w.emitted("settled")).toEqual([["refused"]]);
  });

  // With reduced motion nothing churns and every step lands at once.
  it("does not animate under reduced motion", async () => {
    // jsdom has no matchMedia: the browser's answer is given here.
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({ matches: query.includes("reduce") }) as MediaQueryList,
    );
    const w = mountCeremony();
    expect(w.classes()).toContain("sid-ceremony--still");
    await vi.advanceTimersByTimeAsync(0);
    expect(glyphs(w).every((g) => g === "●")).toBe(true);
    await w.setProps({ outcome: "accepted" });
    await vi.runAllTimersAsync();
    expect(w.emitted("settled")).toEqual([["accepted"]]);
  });
});
