<template>
  <div
    class="sid-ceremony"
    :class="[`sid-ceremony--${phase}`, { 'sid-ceremony--still': still }]"
    data-test="password-ceremony"
  >
    <!-- The refusal's reason, where the form shows it once the fields are back. -->
    <transition name="sid-ceremony-fade">
      <q-banner
        v-if="phase === 'unfolded'"
        class="bg-negative text-white q-mb-md"
        rounded
        dense
        data-test="ceremony-reason"
      >
        {{ refusedText }}
      </q-banner>
    </transition>

    <!-- One row per password field, in the fields' places: they turn into
         random digits, merge into one line, settle into dots as the
         operation advances, and either close into the orb or unfold back
         into the fields. Nothing of the password but its length is drawn. -->
    <div
      class="sid-ceremony__stage"
      :style="{ height: `${stageHeight}px` }"
      role="progressbar"
      :aria-valuenow="Math.round(fraction * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label"
    >
      <div
        v-for="row in rows"
        :key="row"
        class="sid-ceremony__row"
        :style="[rowStyle(row), { '--sid-ceremony-glyphs': count }]"
        aria-hidden="true"
      >
        <span
          v-for="(glyph, i) in glyphs"
          :key="i"
          class="sid-ceremony__glyph"
          :class="{ 'sid-ceremony__glyph--set': glyph === DOT }"
          >{{ glyph }}</span
        >
      </div>

      <svg
        v-if="phase === 'orb' || phase === 'done'"
        class="sid-ceremony__orb"
        viewBox="0 0 64 64"
        aria-hidden="true"
      >
        <circle cx="32" cy="32" r="28" />
      </svg>
      <q-icon
        v-if="phase === 'done'"
        :name="checked ? 'sym_o_check' : 'sym_o_lock'"
        size="30px"
        color="primary"
        class="sid-ceremony__core"
        :class="{ 'sid-ceremony__core--checked': checked }"
      />
    </div>

    <div class="sid-ceremony__label text-body2 text-center" aria-live="polite">
      <transition name="sid-ceremony-fade" mode="out-in">
        <span :key="label">{{ label }}</span>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type {
  PasswordOperationProgress,
  PasswordOperationStep,
} from "../profile/composables/useAuth";

/** How the operation the ceremony shows ended, while it runs `running`. */
export type CeremonyOutcome = "running" | "accepted" | "refused";

/**
 * What is on screen: the fields' rows of digits, the merged line, the orb
 * closing over a success, the rows back in the fields after a refusal.
 */
type Phase = "split" | "line" | "orb" | "done" | "unfolding" | "unfolded";

const props = withDefaults(
  defineProps<{
    /** The operation's latest report; null before its first. */
    progress: PasswordOperationProgress | null;
    outcome: CeremonyOutcome;
    /** Length of the password, for the rows; capped for layout. */
    length: number;
    /** How many password fields the form shows (new and its confirmation: 2). */
    fields?: number;
    /** What the ceremony says once the server accepted the password. */
    acceptedText?: string;
    /** The refusal's reason, shown while the rows unfold. */
    refusedText?: string;
    /** What it says before the operation's first report. */
    startText?: string;
    /** A step shorter than this never shows its own label (no flicker). */
    labelDelayMs?: number;
    /** Distance between two fields' tops, px (outlined field 56 + gutter 16). */
    fieldPitch?: number;
  }>(),
  {
    fields: 2,
    acceptedText: "Done",
    refusedText: "Not accepted",
    startText: "Protecting your password on this device",
    labelDelayMs: 400,
    fieldPitch: 72,
  },
);

const emit = defineEmits<{
  /** The closing animation finished: the form may move on or come back. */
  settled: [outcome: Exclude<CeremonyOutcome, "running">];
}>();

const MAX_GLYPHS = 20;
const DIGITS = "0123456789";
const DOT = "●";
/** How long each choreography step takes, ms. */
const TIMING = {
  split: 700,
  merge: 600,
  orb: 650,
  lock: 450,
  check: 700,
  unfold: 650,
  reason: 1600,
};

const still =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const rows = computed(() =>
  Array.from({ length: Math.max(1, props.fields) }, (_, i) => i),
);
const stageHeight = computed(
  () => 56 + (rows.value.length - 1) * props.fieldPitch,
);
const count = computed(() => Math.max(1, Math.min(props.length, MAX_GLYPHS)));
const glyphs = ref<string[]>(Array.from({ length: count.value }, () => DOT));

const phase = ref<Phase>("split");
const checked = ref(false);
const step = computed<PasswordOperationStep | undefined>(
  () => props.progress?.step,
);
/**
 * Where the line is, 0..1. Between reports it moves at the pace the report
 * expects for the rest of its step, so it shows the time left rather than
 * jumping at each report; it stops short of the step's end until the step
 * reports done, and never moves back.
 */
const fraction = ref(0);
// Each report re-aims the line from where it already is: toward the step's
// end over the time the report says is left. A report that lags behind the
// line (a prover still at its first stage) does not hold it back.
let anchor = 0;
let reportedAt = Date.now();
watch(
  () => props.progress,
  (p) => {
    anchor = Math.max(fraction.value, p?.fraction ?? 0);
    reportedAt = Date.now();
  },
  // A report present at mount counts like a later one.
  { immediate: true },
);
function pace() {
  if (props.outcome === "accepted") {
    fraction.value = 1;
    return;
  }
  const p = props.progress;
  if (!p) return;
  let target = anchor;
  if (p.until !== undefined && p.until > anchor && p.remainingMs) {
    const share = Math.min(0.95, (Date.now() - reportedAt) / p.remainingMs);
    target = anchor + (p.until - anchor) * share;
  }
  fraction.value = Math.max(fraction.value, target);
}

/** Where row `i` stands: its field's place, or the merged centre line. */
function rowStyle(i: number) {
  const own = i * props.fieldPitch;
  const centre = ((rows.value.length - 1) * props.fieldPitch) / 2;
  const merged =
    phase.value === "line" || phase.value === "orb" || phase.value === "done";
  const top = merged ? centre : own;
  return {
    transform: `translateY(${top}px) scaleX(${phase.value === "orb" || phase.value === "done" ? 0.08 : 1})`,
    opacity: merged && i > 0 ? 0 : phase.value === "done" ? 0 : 1,
  };
}

// A step's label shows once the step has lasted `labelDelayMs`.
const visibleStep = ref<PasswordOperationStep | undefined>(undefined);
const visibleLabel = ref("");
let labelTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  step,
  (now) => {
    clearTimeout(labelTimer);
    if (!now) return;
    if (visibleStep.value === undefined) {
      visibleStep.value = now;
      return;
    }
    labelTimer = setTimeout(
      () => (visibleStep.value = now),
      props.labelDelayMs,
    );
  },
  { immediate: true },
);
watch(
  () => [visibleStep.value, props.progress?.label] as const,
  ([shownStep, text]) => {
    if (shownStep === step.value && text) visibleLabel.value = text;
  },
  { immediate: true },
);
const label = computed(() => {
  if (phase.value === "done") return props.acceptedText;
  if (phase.value === "unfolding" || phase.value === "unfolded") return "";
  return visibleLabel.value || props.startText;
});

/**
 * Turn the digits into dots left to right as the operation advances; the
 * rest keep changing, a few at a time.
 */
let ticks = 0;
function tick() {
  pace();
  const settledUpTo = Math.floor(fraction.value * count.value);
  // The open digits change every fourth frame (about six times a second);
  // the line itself follows the pace every frame.
  const churning = !still && ticks++ % 4 === 0;
  glyphs.value = glyphs.value.map((glyph, i) => {
    if (i < settledUpTo) return DOT;
    if (!churning) return still ? DOT : glyph;
    // A calm churn: about a third of the open digits change at a time.
    if (glyph !== DOT && Math.random() > 0.35) return glyph;
    return DIGITS[Math.floor(Math.random() * DIGITS.length)];
  });
}

const timers: ReturnType<typeof setTimeout>[] = [];
function after(ms: number, then: () => void) {
  timers.push(setTimeout(then, still ? 0 : ms));
}

let churn: ReturnType<typeof setInterval> | undefined;
function stopChurn() {
  clearInterval(churn);
  churn = undefined;
}

/** The success: the line closes into the orb, the lock, then the check. */
function close() {
  stopChurn();
  fraction.value = 1;
  glyphs.value = glyphs.value.map(() => DOT);
  phase.value = "orb";
  after(TIMING.orb, () => {
    phase.value = "done";
    after(TIMING.lock, () => {
      checked.value = true;
      after(TIMING.check, () => emit("settled", "accepted"));
    });
  });
}

/** The refusal: the line unfolds back into the fields, as dots, with the reason. */
function unfold() {
  stopChurn();
  glyphs.value = glyphs.value.map(() => DOT);
  phase.value = "unfolding";
  after(TIMING.unfold, () => {
    phase.value = "unfolded";
    after(TIMING.reason, () => emit("settled", "refused"));
  });
}

/** The rows have merged; an outcome now runs at once. */
let merged = false;
let concluded = false;

/** Run the outcome once, after the rows have merged: the choreography is never cut. */
function conclude(outcome: CeremonyOutcome) {
  if (outcome === "running" || !merged || concluded) return;
  concluded = true;
  if (outcome === "accepted") close();
  else unfold();
}

watch(() => props.outcome, conclude);

onMounted(() => {
  tick();
  churn = setInterval(tick, 40);
  after(TIMING.split, () => {
    phase.value = "line";
    after(TIMING.merge, () => {
      merged = true;
      // An outcome that arrived while the rows were merging runs now.
      conclude(props.outcome);
    });
  });
});

onBeforeUnmount(() => {
  stopChurn();
  timers.forEach(clearTimeout);
  clearTimeout(labelTimer);
});
</script>

<style scoped>
.sid-ceremony__stage {
  position: relative;
  /* The rows size their glyphs to the stage's width (cqi below). */
  container-type: inline-size;
}
.sid-ceremony__row {
  position: absolute;
  inset: 0 0 auto 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0, 0, 0, 0.24);
  border-radius: 4px;
  font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
  /* Each glyph is 0.9em wide; a long password on a narrow card shrinks its
     glyphs to fit the row rather than spill out of it. */
  font-size: min(1.5rem, calc(96cqi / (var(--sid-ceremony-glyphs, 20) * 0.9)));
  transform-origin: center;
  transition:
    transform 600ms cubic-bezier(0.65, 0, 0.35, 1),
    opacity 400ms ease,
    border-color 400ms ease;
}
/* While the operation runs the rows are a line, not fields. */
.sid-ceremony--line .sid-ceremony__row,
.sid-ceremony--orb .sid-ceremony__row,
.sid-ceremony--done .sid-ceremony__row {
  border-color: transparent;
}
.sid-ceremony__glyph {
  display: inline-block;
  width: 0.9em;
  text-align: center;
  color: var(--q-primary);
  opacity: 0.45;
  transition:
    opacity 250ms ease,
    transform 250ms ease;
}
.sid-ceremony__glyph--set {
  opacity: 1;
  transform: scale(0.6);
}
.sid-ceremony__orb {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 64px;
  height: 64px;
  margin: -32px 0 0 -32px;
}
.sid-ceremony__orb circle {
  fill: none;
  stroke: var(--q-primary);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 176;
  stroke-dashoffset: 176;
  transform: rotate(-90deg);
  transform-origin: center;
  animation: sid-ceremony-draw 600ms ease-out forwards;
}
@keyframes sid-ceremony-draw {
  to {
    stroke-dashoffset: 0;
  }
}
.sid-ceremony__core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1);
  animation: sid-ceremony-pop 300ms cubic-bezier(0.2, 1.4, 0.4, 1);
}
.sid-ceremony__core--checked {
  animation: sid-ceremony-pop 350ms cubic-bezier(0.2, 1.6, 0.4, 1);
}
@keyframes sid-ceremony-pop {
  from {
    transform: translate(-50%, -50%) scale(0.3);
    opacity: 0;
  }
}
.sid-ceremony__label {
  min-height: 1.5em;
  margin-top: 20px;
}
.sid-ceremony-fade-enter-active,
.sid-ceremony-fade-leave-active {
  transition:
    opacity 250ms ease,
    transform 250ms ease;
}
.sid-ceremony-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.sid-ceremony-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.sid-ceremony--still .sid-ceremony__row,
.sid-ceremony--still .sid-ceremony__glyph,
.sid-ceremony--still .sid-ceremony-fade-enter-active,
.sid-ceremony--still .sid-ceremony-fade-leave-active {
  transition: none;
}
.sid-ceremony--still .sid-ceremony-fade-enter-from,
.sid-ceremony--still .sid-ceremony-fade-leave-to {
  transform: none;
}
.sid-ceremony--still .sid-ceremony__orb circle {
  animation: none;
  stroke-dashoffset: 0;
}
.sid-ceremony--still .sid-ceremony__core {
  animation: none;
}
</style>
