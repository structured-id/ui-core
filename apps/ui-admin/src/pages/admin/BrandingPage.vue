<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none">Branding Editor</h5>
        <p class="text-caption text-grey q-mb-none">
          Customize login page appearance with design tokens, assets, and text.
        </p>
      </div>
      <div class="col-auto q-gutter-sm">
        <q-btn
          v-if="config && isDirty"
          label="Reset"
          flat
          color="grey"
          icon="sym_o_undo"
          @click="resetForm"
        />
        <q-btn
          label="Save"
          color="primary"
          icon="sym_o_save"
          :loading="store.saving"
          :disable="!isDirty"
          @click="handleSave"
        />
      </div>
    </div>

    <q-banner v-if="store.error" type="negative" class="q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <div v-if="store.loading" class="text-center q-pa-xl">
      <q-spinner size="xl" color="primary" />
    </div>

    <div v-else class="row q-col-gutter-lg">
      <!-- ═══ Editor Panel ═══ -->
      <div class="col-12 col-md-5">
        <!-- Assets -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Assets</div>
            <div class="q-gutter-sm">
              <q-input
                v-model="form.logoUrl"
                label="Logo URL (light)"
                hint="SVG, PNG, WebP — max 200 KB, recommended 200×60px"
                dense
                outlined
              >
                <template #prepend>
                  <q-icon name="sym_o_image" />
                </template>
              </q-input>
              <q-input
                v-model="form.logoDarkUrl"
                label="Logo URL (dark)"
                hint="Optional — falls back to light logo"
                dense
                outlined
              >
                <template #prepend>
                  <q-icon name="sym_o_dark_mode" />
                </template>
              </q-input>
              <q-input
                v-model="form.faviconUrl"
                label="Favicon URL"
                hint="ICO, PNG, SVG — max 32 KB, 32×32 or 16×16"
                dense
                outlined
              >
                <template #prepend>
                  <q-icon name="sym_o_tab" />
                </template>
              </q-input>

              <div class="text-caption text-grey q-mt-sm">Background</div>
              <q-btn-toggle
                v-model="form.backgroundType"
                dense
                no-caps
                toggle-color="primary"
                :options="[
                  { label: 'Color', value: 'color' },
                  { label: 'Image', value: 'image' },
                  { label: 'Gradient', value: 'gradient' },
                ]"
              />
              <q-input
                v-if="form.backgroundType === 'color'"
                v-model="form.backgroundColor"
                label="Background Color"
                dense
                outlined
              >
                <template #append>
                  <q-icon name="sym_o_palette" class="cursor-pointer">
                    <q-popup-proxy
                      cover
                      transition-show="scale"
                      transition-hide="scale"
                    >
                      <q-color v-model="form.backgroundColor" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
              <q-input
                v-if="form.backgroundType === 'image'"
                v-model="form.backgroundImageUrl"
                label="Background Image URL"
                hint="Max 500 KB"
                dense
                outlined
              />
              <q-input
                v-if="form.backgroundType === 'gradient'"
                v-model="form.backgroundGradient"
                label="CSS Gradient"
                hint="e.g. linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                dense
                outlined
              />
            </div>
          </q-card-section>
        </q-card>

        <!-- Colors -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Colors</div>
            <div class="q-gutter-sm">
              <color-field
                v-for="c in colorFields"
                :key="c.key"
                v-model="form[c.key]"
                :label="c.label"
              />
            </div>
          </q-card-section>
        </q-card>

        <!-- Typography -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Typography</div>
            <div class="q-gutter-sm">
              <q-input
                v-model="form.fontFamily"
                label="Font Family"
                dense
                outlined
                hint="e.g. Inter, sans-serif"
              />
              <q-input
                v-model="form.fontSizeBase"
                label="Base Font Size"
                dense
                outlined
                hint="e.g. 14px"
              />
              <q-select
                v-model="form.buttonStyle"
                label="Button Style"
                :options="buttonStyleOptions"
                dense
                outlined
                emit-value
                map-options
              />
            </div>
          </q-card-section>
        </q-card>

        <!-- Spacing -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Spacing</div>
            <div class="q-gutter-sm">
              <q-input
                v-model="form.borderRadius"
                label="Border Radius"
                dense
                outlined
                hint="e.g. 8px"
              />
              <q-input
                v-model="form.spacingUnit"
                label="Spacing Unit"
                dense
                outlined
                hint="e.g. 16px"
              />
            </div>
          </q-card-section>
        </q-card>

        <!-- Dark Mode -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">
              Dark Mode
              <q-toggle v-model="form.darkModeEnabled" dense class="q-ml-sm" />
            </div>
            <div v-if="form.darkModeEnabled" class="q-gutter-sm">
              <color-field
                v-for="c in darkColorFields"
                :key="c.key"
                v-model="form[c.key]"
                :label="c.label"
              />
            </div>
          </q-card-section>
        </q-card>

        <!-- Text -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Text & Links</div>
            <div class="q-gutter-sm">
              <q-input
                v-model="form.loginTitle"
                label="Login Title"
                dense
                outlined
              />
              <q-input
                v-model="form.loginSubtitle"
                label="Login Subtitle"
                dense
                outlined
              />
              <q-input
                v-model="form.footerText"
                label="Footer Text"
                dense
                outlined
              />
              <q-input
                v-model="form.termsUrl"
                label="Terms of Service URL"
                dense
                outlined
              />
              <q-input
                v-model="form.privacyUrl"
                label="Privacy Policy URL"
                dense
                outlined
              />
              <q-input v-model="form.helpUrl" label="Help URL" dense outlined />
            </div>
          </q-card-section>
        </q-card>

        <!-- WCAG Contrast -->
        <q-card v-if="contrastResults.length > 0" flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">WCAG Contrast Check</div>
            <q-list dense separator>
              <q-item v-for="(r, i) in contrastResults" :key="i">
                <q-item-section avatar>
                  <div class="row q-gutter-xs items-center">
                    <div
                      :style="{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        backgroundColor: r.foreground,
                        border: '1px solid #ccc',
                      }"
                    />
                    <span class="text-caption">/</span>
                    <div
                      :style="{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        backgroundColor: r.background,
                        border: '1px solid #ccc',
                      }"
                    />
                  </div>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ r.ratio.toFixed(1) }}:1</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge
                    :color="wcagLevelColor(r.level)"
                    :label="wcagLevelLabel(r.level)"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <!-- ═══ Live Preview Panel ═══ -->
      <div class="col-12 col-md-7">
        <q-card flat bordered class="sticky-preview">
          <q-card-section class="q-pb-none">
            <div class="row items-center q-gutter-sm">
              <q-btn-toggle
                v-model="previewMode"
                dense
                no-caps
                toggle-color="primary"
                :options="[
                  {
                    label: 'Desktop',
                    value: 'desktop',
                    icon: 'sym_o_desktop_windows',
                  },
                  { label: 'Tablet', value: 'tablet', icon: 'sym_o_tablet' },
                  {
                    label: 'Mobile',
                    value: 'mobile',
                    icon: 'sym_o_smartphone',
                  },
                ]"
              />
              <q-space />
              <q-btn-toggle
                v-model="previewTheme"
                dense
                no-caps
                toggle-color="primary"
                :options="[
                  { label: 'Light', value: 'light', icon: 'sym_o_light_mode' },
                  { label: 'Dark', value: 'dark', icon: 'sym_o_dark_mode' },
                ]"
              />
              <q-btn
                flat
                dense
                icon="sym_o_contrast"
                label="Check Contrast"
                @click="runContrastCheck"
              />
            </div>
          </q-card-section>
          <q-card-section>
            <div class="preview-container" :style="previewContainerStyle">
              <div class="preview-frame" :style="previewStyle">
                <!-- Logo -->
                <div class="preview-logo q-mb-md" v-if="form.logoUrl">
                  <img
                    :src="
                      previewTheme === 'dark' && form.logoDarkUrl
                        ? form.logoDarkUrl
                        : form.logoUrl
                    "
                    alt="Logo"
                    style="max-height: 60px; max-width: 200px"
                  />
                </div>

                <!-- Title -->
                <div
                  class="text-h6 q-mb-xs"
                  :style="{ color: previewTokens.colorText }"
                >
                  {{ form.loginTitle || "Welcome" }}
                </div>
                <div
                  class="text-body2 q-mb-lg"
                  :style="{ color: previewTokens.colorTextSecondary }"
                >
                  {{ form.loginSubtitle || "Sign in to continue" }}
                </div>

                <!-- Form card -->
                <div
                  class="preview-card q-pa-md q-mb-md"
                  :style="{
                    backgroundColor: previewTokens.colorSurface,
                    borderRadius: form.borderRadius || '8px',
                  }"
                >
                  <div
                    class="text-caption q-mb-xs"
                    :style="{ color: previewTokens.colorText }"
                  >
                    Email
                  </div>
                  <div
                    class="preview-input q-mb-md"
                    :style="{
                      borderRadius: form.borderRadius || '8px',
                      borderColor: previewTokens.colorTextSecondary,
                    }"
                  />

                  <div
                    class="preview-btn"
                    :style="{
                      backgroundColor: previewTokens.colorPrimary,
                      color: '#fff',
                      borderRadius: buttonRadius,
                    }"
                  >
                    Continue
                  </div>
                </div>

                <!-- Footer links -->
                <div class="row justify-center q-gutter-sm">
                  <span
                    class="text-caption"
                    :style="{ color: previewTokens.colorPrimary }"
                  >
                    Forgot password?
                  </span>
                  <span
                    class="text-caption"
                    :style="{ color: previewTokens.colorTextSecondary }"
                    >|</span
                  >
                  <span
                    class="text-caption"
                    :style="{ color: previewTokens.colorPrimary }"
                  >
                    Register
                  </span>
                </div>

                <!-- Footer text -->
                <div
                  v-if="form.footerText"
                  class="text-caption text-center q-mt-lg"
                  :style="{ color: previewTokens.colorTextSecondary }"
                >
                  {{ form.footerText }}
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useBrandingStore } from "#admin/stores/branding";
import { ButtonStyle } from "@structured-id/proto/sid/v1/admin/branding";
import type {
  BrandingConfig,
  DesignTokens,
  BrandingAssets,
  DarkModeConfig,
  BrandingText,
  ContrastCheck,
  ColorPair,
} from "@structured-id/proto/sid/v1/admin/branding";
import {
  buttonStyleLabel,
  wcagLevelLabel,
  wcagLevelColor,
} from "#admin/composables/useEnumLabels";
import { defineComponent, h } from "vue";
import { BrandingConfigId, ProjectId, required } from "@structured-id/ids";

const store = useBrandingStore();

// The console administers the installation's own project.
const projectId = ProjectId.system();

const previewMode = ref<"desktop" | "tablet" | "mobile">("desktop");
const previewTheme = ref<"light" | "dark">("light");
const contrastResults = ref<ContrastCheck[]>([]);

// ── Color field component ──

const ColorField = defineComponent({
  props: {
    modelValue: { type: String, default: "" },
    label: { type: String, required: true },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h("div", { class: "row items-center q-gutter-sm" }, [
        h("div", {
          style: {
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            backgroundColor: props.modelValue || "#ccc",
            border: "1px solid #ddd",
            cursor: "pointer",
          },
        }),
        h("input", {
          type: "text",
          class: "col q-field__native q-placeholder",
          style: {
            border: "1px solid #ddd",
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: "13px",
          },
          value: props.modelValue,
          placeholder: props.label,
          onInput: (e: Event) =>
            emit("update:modelValue", (e.target as HTMLInputElement).value),
        }),
      ]);
  },
});

// The template names it <color-field>.
const colorField = ColorField;

// ── Form state ──

const DEFAULTS = {
  colorPrimary: "#2563EB",
  colorPrimaryHover: "#1D4ED8",
  colorBackground: "#FFFFFF",
  colorSurface: "#F8FAFC",
  colorText: "#1E293B",
  colorTextSecondary: "#64748B",
  colorError: "#DC2626",
  colorSuccess: "#16A34A",
  colorWarning: "#D97706",
  fontFamily: "Inter, sans-serif",
  fontSizeBase: "14px",
  borderRadius: "8px",
  spacingUnit: "16px",
  buttonStyle: ButtonStyle.ROUNDED,
  logoUrl: "",
  logoDarkUrl: "",
  faviconUrl: "",
  backgroundType: "color" as "color" | "image" | "gradient",
  backgroundColor: "#FFFFFF",
  backgroundImageUrl: "",
  backgroundGradient: "",
  darkModeEnabled: false,
  darkColorBackground: "#0F172A",
  darkColorSurface: "#1E293B",
  darkColorText: "#F1F5F9",
  darkColorTextSecondary: "#94A3B8",
  darkColorPrimary: "#3B82F6",
  darkColorPrimaryHover: "#60A5FA",
  darkColorError: "#EF4444",
  darkColorSuccess: "#22C55E",
  darkColorWarning: "#F59E0B",
  loginTitle: "",
  loginSubtitle: "",
  footerText: "",
  termsUrl: "",
  privacyUrl: "",
  helpUrl: "",
};

const form = reactive({ ...DEFAULTS });
const config = computed(() => store.config);

const colorFields = [
  { key: "colorPrimary" as const, label: "Primary" },
  { key: "colorPrimaryHover" as const, label: "Primary Hover" },
  { key: "colorBackground" as const, label: "Background" },
  { key: "colorSurface" as const, label: "Surface" },
  { key: "colorText" as const, label: "Text" },
  { key: "colorTextSecondary" as const, label: "Text Secondary" },
  { key: "colorError" as const, label: "Error" },
  { key: "colorSuccess" as const, label: "Success" },
  { key: "colorWarning" as const, label: "Warning" },
];

const darkColorFields = [
  { key: "darkColorBackground" as const, label: "Background (Dark)" },
  { key: "darkColorSurface" as const, label: "Surface (Dark)" },
  { key: "darkColorText" as const, label: "Text (Dark)" },
  { key: "darkColorTextSecondary" as const, label: "Text Secondary (Dark)" },
  { key: "darkColorPrimary" as const, label: "Primary (Dark)" },
  { key: "darkColorPrimaryHover" as const, label: "Primary Hover (Dark)" },
  { key: "darkColorError" as const, label: "Error (Dark)" },
  { key: "darkColorSuccess" as const, label: "Success (Dark)" },
  { key: "darkColorWarning" as const, label: "Warning (Dark)" },
];

const buttonStyleOptions = [
  ButtonStyle.ROUNDED,
  ButtonStyle.SQUARE,
  ButtonStyle.PILL,
].map((value) => ({ label: buttonStyleLabel(value), value }));

const isDirty = computed(() => {
  if (!config.value) return true;
  return (
    JSON.stringify(formToProto()) !==
    JSON.stringify({
      tokens: config.value.tokens,
      assets: config.value.assets,
      darkMode: config.value.darkMode,
      text: config.value.text,
    })
  );
});

// ── Preview computed ──

const previewTokens = computed(() => {
  if (previewTheme.value === "dark" && form.darkModeEnabled) {
    return {
      colorPrimary: form.darkColorPrimary || form.colorPrimary,
      colorBackground: form.darkColorBackground || form.colorBackground,
      colorSurface: form.darkColorSurface || form.colorSurface,
      colorText: form.darkColorText || form.colorText,
      colorTextSecondary:
        form.darkColorTextSecondary || form.colorTextSecondary,
      colorError: form.darkColorError || form.colorError,
    };
  }
  return {
    colorPrimary: form.colorPrimary,
    colorBackground: form.colorBackground,
    colorSurface: form.colorSurface,
    colorText: form.colorText,
    colorTextSecondary: form.colorTextSecondary,
    colorError: form.colorError,
  };
});

const PREVIEW_WIDTHS: Record<string, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

const previewContainerStyle = computed(() => ({
  display: "flex",
  justifyContent: "center",
}));

const previewStyle = computed(() => ({
  width: PREVIEW_WIDTHS[previewMode.value],
  maxWidth: "100%",
  minHeight: "480px",
  backgroundColor: previewTokens.value.colorBackground,
  fontFamily: form.fontFamily || "Inter, sans-serif",
  fontSize: form.fontSizeBase || "14px",
  padding: form.spacingUnit || "16px",
  borderRadius: form.borderRadius || "8px",
  border: "1px solid #e0e0e0",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.3s ease",
}));

const buttonRadius = computed(() => {
  if (form.buttonStyle === ButtonStyle.PILL) return "999px";
  if (form.buttonStyle === ButtonStyle.SQUARE) return "0";
  return form.borderRadius || "8px";
});

// ── Proto conversion helpers ──

function formToProto() {
  const tokens: DesignTokens = {
    colorPrimary: form.colorPrimary,
    colorPrimaryHover: form.colorPrimaryHover,
    colorBackground: form.colorBackground,
    colorSurface: form.colorSurface,
    colorText: form.colorText,
    colorError: form.colorError,
    colorTextSecondary: form.colorTextSecondary,
    colorSuccess: form.colorSuccess,
    colorWarning: form.colorWarning,
    fontFamily: form.fontFamily,
    fontSizeBase: form.fontSizeBase,
    borderRadius: form.borderRadius,
    spacingUnit: form.spacingUnit,
    buttonStyle: form.buttonStyle,
    custom: {},
  };

  const assets: BrandingAssets = {
    logoUrl: form.logoUrl,
    faviconUrl: form.faviconUrl,
    logoDarkUrl: form.logoDarkUrl,
    background: {
      background:
        form.backgroundType === "color"
          ? { oneofKind: "color" as const, color: form.backgroundColor }
          : form.backgroundType === "image"
            ? {
                oneofKind: "imageUrl" as const,
                imageUrl: form.backgroundImageUrl,
              }
            : {
                oneofKind: "gradient" as const,
                gradient: form.backgroundGradient,
              },
    },
  };

  const darkMode: DarkModeConfig = {
    enabled: form.darkModeEnabled,
    tokens: form.darkModeEnabled
      ? {
          colorBackground: form.darkColorBackground,
          colorSurface: form.darkColorSurface,
          colorText: form.darkColorText,
          colorPrimary: form.darkColorPrimary,
          colorPrimaryHover: form.darkColorPrimaryHover,
          colorError: form.darkColorError,
          colorTextSecondary: form.darkColorTextSecondary,
          colorSuccess: form.darkColorSuccess,
          colorWarning: form.darkColorWarning,
          custom: {},
        }
      : undefined,
  };

  const text: BrandingText = {
    loginTitle: form.loginTitle,
    loginSubtitle: form.loginSubtitle,
    footerText: form.footerText,
    termsUrl: form.termsUrl,
    privacyUrl: form.privacyUrl,
    helpUrl: form.helpUrl,
  };

  return { tokens, assets, darkMode, text };
}

function protoToForm(cfg: BrandingConfig) {
  const t = cfg.tokens;
  if (t) {
    form.colorPrimary = t.colorPrimary || DEFAULTS.colorPrimary;
    form.colorPrimaryHover = t.colorPrimaryHover || DEFAULTS.colorPrimaryHover;
    form.colorBackground = t.colorBackground || DEFAULTS.colorBackground;
    form.colorSurface = t.colorSurface || DEFAULTS.colorSurface;
    form.colorText = t.colorText || DEFAULTS.colorText;
    form.colorTextSecondary =
      t.colorTextSecondary || DEFAULTS.colorTextSecondary;
    form.colorError = t.colorError || DEFAULTS.colorError;
    form.colorSuccess = t.colorSuccess || DEFAULTS.colorSuccess;
    form.colorWarning = t.colorWarning || DEFAULTS.colorWarning;
    form.fontFamily = t.fontFamily || DEFAULTS.fontFamily;
    form.fontSizeBase = t.fontSizeBase || DEFAULTS.fontSizeBase;
    form.borderRadius = t.borderRadius || DEFAULTS.borderRadius;
    form.spacingUnit = t.spacingUnit || DEFAULTS.spacingUnit;
    form.buttonStyle = t.buttonStyle || DEFAULTS.buttonStyle;
  }

  const a = cfg.assets;
  if (a) {
    form.logoUrl = a.logoUrl;
    form.logoDarkUrl = a.logoDarkUrl;
    form.faviconUrl = a.faviconUrl;
    const bg = a.background?.background;
    if (bg?.oneofKind === "color") {
      form.backgroundType = "color";
      form.backgroundColor = bg.color;
    } else if (bg?.oneofKind === "imageUrl") {
      form.backgroundType = "image";
      form.backgroundImageUrl = bg.imageUrl;
    } else if (bg?.oneofKind === "gradient") {
      form.backgroundType = "gradient";
      form.backgroundGradient = bg.gradient;
    }
  }

  const dm = cfg.darkMode;
  if (dm) {
    form.darkModeEnabled = dm.enabled;
    if (dm.tokens) {
      form.darkColorBackground =
        dm.tokens.colorBackground || DEFAULTS.darkColorBackground;
      form.darkColorSurface =
        dm.tokens.colorSurface || DEFAULTS.darkColorSurface;
      form.darkColorText = dm.tokens.colorText || DEFAULTS.darkColorText;
      form.darkColorTextSecondary =
        dm.tokens.colorTextSecondary || DEFAULTS.darkColorTextSecondary;
      form.darkColorPrimary =
        dm.tokens.colorPrimary || DEFAULTS.darkColorPrimary;
      form.darkColorPrimaryHover =
        dm.tokens.colorPrimaryHover || DEFAULTS.darkColorPrimaryHover;
      form.darkColorError = dm.tokens.colorError || DEFAULTS.darkColorError;
      form.darkColorSuccess =
        dm.tokens.colorSuccess || DEFAULTS.darkColorSuccess;
      form.darkColorWarning =
        dm.tokens.colorWarning || DEFAULTS.darkColorWarning;
    }
  }

  const txt = cfg.text;
  if (txt) {
    form.loginTitle = txt.loginTitle;
    form.loginSubtitle = txt.loginSubtitle;
    form.footerText = txt.footerText;
    form.termsUrl = txt.termsUrl;
    form.privacyUrl = txt.privacyUrl;
    form.helpUrl = txt.helpUrl;
  }
}

function resetForm() {
  if (config.value) {
    protoToForm(config.value);
  } else {
    Object.assign(form, DEFAULTS);
  }
  contrastResults.value = [];
}

// ── Actions ──

async function handleSave() {
  const { tokens, assets, darkMode, text } = formToProto();
  if (config.value?.id) {
    await store.updateConfig(
      projectId,
      required(BrandingConfigId, config.value.id),
      tokens,
      assets,
      darkMode,
      text,
    );
  } else {
    await store.createConfig(projectId, tokens, assets, darkMode, text);
  }
}

async function runContrastCheck() {
  const pairs: ColorPair[] = [
    { foreground: form.colorText, background: form.colorBackground },
    { foreground: form.colorTextSecondary, background: form.colorBackground },
    { foreground: form.colorText, background: form.colorSurface },
    { foreground: "#FFFFFF", background: form.colorPrimary },
    { foreground: "#FFFFFF", background: form.colorError },
  ];
  const results = await store.validateContrast(pairs);
  if (results) contrastResults.value = results;
}

// ── Init ──

watch(config, (cfg) => {
  if (cfg) protoToForm(cfg);
});

onMounted(() => {
  store.fetchPublishedBranding(projectId);
});
</script>

<style scoped>
.sticky-preview {
  position: sticky;
  top: 80px;
}

.preview-container {
  overflow: auto;
}

.preview-frame {
  transition: all 0.3s ease;
}

.preview-card {
  width: 100%;
  max-width: 360px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.preview-input {
  height: 40px;
  border: 1px solid;
  border-radius: 4px;
}

.preview-btn {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  cursor: default;
}

.preview-logo {
  text-align: center;
}
</style>
