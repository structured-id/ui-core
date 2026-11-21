<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none">Notification Templates</h5>
        <p class="text-caption text-grey q-mb-none">
          Customize email, SMS, and push notification templates.
        </p>
      </div>
    </div>

    <q-banner v-if="store.error" type="negative" class="q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <div class="row q-col-gutter-md">
      <!-- ═══ Template Catalog (Left Panel) ═══ -->
      <div class="col-12 col-md-4">
        <!-- Filters -->
        <div class="row q-col-gutter-sm q-mb-sm">
          <div class="col">
            <q-select
              v-model="channelFilter"
              label="Channel"
              :options="channelOptions"
              dense
              outlined
              clearable
              emit-value
              map-options
              @update:model-value="loadTemplates"
            />
          </div>
          <div class="col-auto">
            <q-toggle
              v-model="customizedOnly"
              label="Customized"
              dense
              @update:model-value="loadTemplates"
            />
          </div>
        </div>

        <!-- Template List -->
        <q-card flat bordered>
          <q-list separator>
            <q-item
              v-for="tpl in store.templates"
              :key="tpl.templateId"
              clickable
              v-ripple
              :active="selectedTemplateId === tpl.templateId"
              active-class="bg-blue-1 text-primary"
              @click="selectTemplate(tpl.templateId)"
            >
              <q-item-section avatar>
                <q-icon
                  :name="primaryChannelIcon(tpl.channels)"
                  :color="tpl.customized ? 'primary' : 'grey'"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ tpl.name }}</q-item-label>
                <q-item-label caption>{{ tpl.trigger }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row q-gutter-xs">
                  <q-icon
                    v-for="ch in tpl.channels"
                    :key="ch"
                    :name="notificationChannelIcon(ch)"
                    size="xs"
                    :color="ch === selectedChannel ? 'primary' : 'grey-5'"
                  >
                    <q-tooltip>{{ notificationChannelLabel(ch) }}</q-tooltip>
                  </q-icon>
                </div>
                <q-badge
                  v-if="tpl.customized"
                  color="primary"
                  label="Custom"
                  class="q-mt-xs"
                />
              </q-item-section>
            </q-item>

            <q-item v-if="store.templates.length === 0 && !store.loading">
              <q-item-section class="text-center text-grey q-pa-md">
                No templates found
              </q-item-section>
            </q-item>
          </q-list>

          <q-inner-loading :showing="store.loading" />
        </q-card>
      </div>

      <!-- ═══ Editor + Preview (Right Panel) ═══ -->
      <div class="col-12 col-md-8">
        <template v-if="store.currentTemplate">
          <!-- Channel + Locale selectors -->
          <div class="row q-col-gutter-sm q-mb-md items-end">
            <div class="col-auto">
              <q-btn-toggle
                v-model="selectedChannel"
                toggle-color="primary"
                :options="availableChannelOptions"
                dense
                unelevated
                @update:model-value="reloadTemplate"
              />
            </div>
            <div class="col-12 col-sm-2">
              <q-select
                v-model="selectedLocale"
                label="Locale"
                :options="store.currentTemplate.availableLocales"
                dense
                outlined
                @update:model-value="reloadTemplate"
              />
            </div>
            <q-space />
            <div class="col-auto q-gutter-sm">
              <q-btn
                flat
                color="orange"
                icon="sym_o_restart_alt"
                label="Reset"
                :disable="!store.currentTemplate.customized"
                @click="handleReset"
              />
              <q-btn
                color="primary"
                icon="sym_o_save"
                label="Save"
                :loading="store.saving"
                :disable="!isDirty || !loadedIsSelected()"
                @click="handleSave"
              />
            </div>
          </div>

          <div class="row q-col-gutter-md">
            <!-- Editor -->
            <div class="col-12 col-md-6">
              <q-card flat bordered>
                <q-card-section>
                  <!-- Email editor -->
                  <template
                    v-if="selectedChannel === NotificationChannel.EMAIL"
                  >
                    <q-input
                      v-model="editForm.subject"
                      label="Subject"
                      outlined
                      dense
                      class="q-mb-sm"
                    />
                    <div class="text-caption text-grey q-mb-xs">
                      Body (HTML + Handlebars)
                    </div>
                    <q-input
                      v-model="editForm.htmlBody"
                      type="textarea"
                      outlined
                      dense
                      :input-style="{
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        minHeight: '300px',
                      }"
                    />
                    <div class="text-caption text-grey q-mt-md q-mb-xs">
                      Plain Text Fallback
                    </div>
                    <q-input
                      v-model="editForm.textBody"
                      type="textarea"
                      outlined
                      dense
                      :input-style="{
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        minHeight: '100px',
                      }"
                    />
                  </template>

                  <!-- SMS editor -->
                  <template v-if="selectedChannel === NotificationChannel.SMS">
                    <div class="text-caption text-grey q-mb-xs">
                      Message (max 160 chars)
                    </div>
                    <q-input
                      v-model="editForm.smsBody"
                      type="textarea"
                      outlined
                      dense
                      maxlength="160"
                      counter
                      :input-style="{
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        minHeight: '120px',
                      }"
                    />
                  </template>

                  <!-- Push editor -->
                  <template v-if="selectedChannel === NotificationChannel.PUSH">
                    <q-input
                      v-model="editForm.pushTitle"
                      label="Title (max 50 chars)"
                      outlined
                      dense
                      maxlength="50"
                      counter
                      class="q-mb-sm"
                    />
                    <q-input
                      v-model="editForm.pushBody"
                      label="Body (max 200 chars)"
                      type="textarea"
                      outlined
                      dense
                      maxlength="200"
                      counter
                      class="q-mb-sm"
                      :input-style="{ minHeight: '80px' }"
                    />
                    <q-input
                      v-model="editForm.pushActionUrl"
                      label="Action URL"
                      outlined
                      dense
                    />
                  </template>
                </q-card-section>

                <!-- Variables Reference -->
                <q-separator />
                <q-card-section>
                  <div class="text-subtitle2 q-mb-sm">
                    <q-icon name="sym_o_info" class="q-mr-xs" />
                    Available Variables
                  </div>
                  <q-list dense>
                    <q-item
                      v-for="v in store.currentTemplate.variables"
                      :key="v.name"
                      dense
                      clickable
                      @click="insertVariable(v.name)"
                    >
                      <q-item-section>
                        <q-item-label>
                          <code class="text-primary">{{
                            "\u007B\u007B" + v.name + "\u007D\u007D"
                          }}</code>
                        </q-item-label>
                        <q-item-label caption>{{ v.description }}</q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <span class="text-caption text-grey">{{
                          v.example
                        }}</span>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-card-section>
              </q-card>
            </div>

            <!-- Preview -->
            <div class="col-12 col-md-6">
              <q-card flat bordered>
                <q-card-section class="row items-center">
                  <div class="text-subtitle2">Preview</div>
                  <q-space />
                  <q-btn
                    flat
                    dense
                    size="sm"
                    icon="sym_o_refresh"
                    label="Refresh"
                    @click="refreshPreview"
                  />
                  <q-btn
                    flat
                    dense
                    size="sm"
                    icon="sym_o_send"
                    label="Send Test"
                    color="primary"
                    class="q-ml-sm"
                    @click="handleSendTest"
                  />
                </q-card-section>
                <q-separator />

                <!-- Email preview -->
                <q-card-section
                  v-if="selectedChannel === NotificationChannel.EMAIL"
                >
                  <div
                    v-if="store.preview?.renderedSubject"
                    class="text-weight-medium q-mb-sm"
                  >
                    Subject: {{ store.preview.renderedSubject }}
                  </div>
                  <div
                    v-if="store.preview?.renderedBody"
                    class="preview-frame"
                    v-html="store.preview.renderedBody"
                  />
                  <div v-else class="text-center text-grey q-pa-xl">
                    Click "Refresh" to render preview
                  </div>
                </q-card-section>

                <!-- SMS preview -->
                <q-card-section
                  v-if="selectedChannel === NotificationChannel.SMS"
                >
                  <div class="sms-preview q-pa-md">
                    <div class="sms-bubble">
                      {{
                        store.preview?.renderedBody ||
                        editForm.smsBody ||
                        "Click Refresh to preview"
                      }}
                    </div>
                  </div>
                </q-card-section>

                <!-- Push preview -->
                <q-card-section
                  v-if="selectedChannel === NotificationChannel.PUSH"
                >
                  <div class="push-preview q-pa-md">
                    <div class="push-notification q-pa-sm">
                      <div class="row items-center q-gutter-sm">
                        <q-icon name="sym_o_notifications" size="sm" />
                        <div>
                          <div class="text-weight-medium text-body2">
                            {{
                              store.preview?.renderedSubject ||
                              editForm.pushTitle ||
                              "Push title"
                            }}
                          </div>
                          <div class="text-caption">
                            {{
                              store.preview?.renderedBody ||
                              editForm.pushBody ||
                              "Push body"
                            }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </q-card-section>
              </q-card>

              <!-- Test Result -->
              <q-banner
                v-if="testResult !== null"
                class="q-mt-sm"
                rounded
                :class="testResult.success ? 'bg-green-1' : 'bg-red-1'"
              >
                <template #avatar>
                  <q-icon
                    :name="
                      testResult.success ? 'sym_o_check_circle' : 'sym_o_error'
                    "
                    :color="testResult.success ? 'positive' : 'negative'"
                  />
                </template>
                {{
                  testResult.success
                    ? "Test notification sent successfully"
                    : testResult.error
                }}
              </q-banner>
            </div>
          </div>
        </template>

        <!-- No template selected -->
        <q-card v-else flat bordered class="text-center q-pa-xl">
          <q-icon name="sym_o_mail" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">Select a template</div>
          <div class="text-caption text-grey">
            Choose a notification template from the list to edit.
          </div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useNotificationsStore } from "#admin/stores/notifications";
import { NotificationChannel } from "@structured-id/proto/sid/v1/admin/notifications";
import {
  notificationChannelLabel,
  notificationChannelIcon,
} from "#admin/composables/useEnumLabels";
import { useQuasar } from "quasar";

const $q = useQuasar();
const store = useNotificationsStore();

// ── State ──

const channelFilter = ref<NotificationChannel | null>(null);
const customizedOnly = ref(false);
const selectedTemplateId = ref<string | null>(null);
const selectedChannel = ref(NotificationChannel.EMAIL);
const selectedLocale = ref("en");
/** Outcome of the last test send: sent, or the refusal's text. */
const testResult = ref<{ success: boolean; error: string } | null>(null);

const channelOptions = [
  { label: "Email", value: NotificationChannel.EMAIL },
  { label: "SMS", value: NotificationChannel.SMS },
  { label: "Push", value: NotificationChannel.PUSH },
];

const editForm = reactive({
  subject: "",
  htmlBody: "",
  textBody: "",
  smsBody: "",
  pushTitle: "",
  pushBody: "",
  pushActionUrl: "",
});

// Snapshot of original content for dirty detection.
const originalContent = ref({
  subject: "",
  htmlBody: "",
  textBody: "",
  smsBody: "",
  pushTitle: "",
  pushBody: "",
  pushActionUrl: "",
});

// ── Computed ──

const availableChannelOptions = computed(() => {
  const channels = store.currentTemplate?.channels ?? [];
  return channels.map((ch) => ({
    label: notificationChannelLabel(ch),
    value: ch,
  }));
});

const isDirty = computed(() => {
  const o = originalContent.value;
  return (
    editForm.subject !== o.subject ||
    editForm.htmlBody !== o.htmlBody ||
    editForm.textBody !== o.textBody ||
    editForm.smsBody !== o.smsBody ||
    editForm.pushTitle !== o.pushTitle ||
    editForm.pushBody !== o.pushBody ||
    editForm.pushActionUrl !== o.pushActionUrl
  );
});

// ── Helpers ──

function primaryChannelIcon(channels: NotificationChannel[]): string {
  if (channels.includes(NotificationChannel.EMAIL)) return "sym_o_mail";
  if (channels.includes(NotificationChannel.SMS)) return "sym_o_sms";
  if (channels.includes(NotificationChannel.PUSH)) return "sym_o_notifications";
  return "sym_o_send";
}

function populateForm() {
  const c = store.currentTemplate?.content;
  if (!c) return;
  editForm.subject = c.subject;
  editForm.htmlBody = c.htmlBody;
  editForm.textBody = c.textBody;
  editForm.smsBody = c.smsBody;
  editForm.pushTitle = c.pushTitle;
  editForm.pushBody = c.pushBody;
  editForm.pushActionUrl = c.pushActionUrl;
  // Save snapshot
  originalContent.value = { ...editForm };
}

function insertVariable(name: string) {
  const tag = `{{${name}}}`;
  // Copy to clipboard for the user to paste
  navigator.clipboard.writeText(tag);
  $q.notify({ type: "info", message: `Copied ${tag} to clipboard` });
}

// ── Actions ──

function loadTemplates() {
  store.fetchTemplates(channelFilter.value ?? undefined, customizedOnly.value);
}

async function selectTemplate(templateId: string) {
  selectedTemplateId.value = templateId;
  testResult.value = null;
  store.preview = null;
  const applied = await store.fetchTemplate(
    templateId,
    selectedChannel.value,
    selectedLocale.value,
  );
  if (applied) populateForm();
}

async function reloadTemplate() {
  if (!selectedTemplateId.value) return;
  store.preview = null;
  const applied = await store.fetchTemplate(
    selectedTemplateId.value,
    selectedChannel.value,
    selectedLocale.value,
  );
  if (applied) populateForm();
}

/**
 * Whether the loaded content is the selection's: while another template,
 * channel or locale is still loading, the form holds the previous one's.
 */
function loadedIsSelected(): boolean {
  const tpl = store.currentTemplate;
  return (
    !store.loading &&
    tpl?.templateId === selectedTemplateId.value &&
    tpl.content?.channel === selectedChannel.value &&
    tpl.content?.locale === selectedLocale.value
  );
}

async function handleSave() {
  if (!selectedTemplateId.value || !loadedIsSelected()) return;
  try {
    await store.updateTemplate(selectedTemplateId.value, {
      channel: selectedChannel.value,
      locale: selectedLocale.value,
      subject: editForm.subject,
      htmlBody: editForm.htmlBody,
      textBody: editForm.textBody,
      smsBody: editForm.smsBody,
      pushTitle: editForm.pushTitle,
      pushBody: editForm.pushBody,
      pushActionUrl: editForm.pushActionUrl,
    });
    originalContent.value = { ...editForm };
    $q.notify({ type: "positive", message: "Template saved" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed" });
  }
}

async function handleReset() {
  if (!selectedTemplateId.value) return;
  $q.dialog({
    title: "Reset Template",
    message: "Reset this template to its default? Custom changes will be lost.",
    cancel: true,
  }).onOk(async () => {
    try {
      await store.resetTemplate(
        selectedTemplateId.value!,
        selectedChannel.value,
        selectedLocale.value,
      );
      populateForm();
      $q.notify({ type: "positive", message: "Template reset to default" });
    } catch {
      $q.notify({ type: "negative", message: store.error ?? "Failed" });
    }
  });
}

async function refreshPreview() {
  if (!selectedTemplateId.value) return;
  await store.previewTemplate(
    selectedTemplateId.value,
    selectedChannel.value,
    selectedLocale.value,
  );
}

async function handleSendTest() {
  if (!selectedTemplateId.value) return;
  try {
    await store.sendTestNotification(
      selectedTemplateId.value,
      selectedChannel.value,
      selectedLocale.value,
    );
    testResult.value = { success: true, error: "" };
    $q.notify({ type: "positive", message: "Test notification sent" });
  } catch {
    const message = store.error ?? "Failed";
    testResult.value = { success: false, error: message };
    $q.notify({ type: "negative", message });
  }
}

// ── Watch for channel changes to auto-switch ──

watch(
  () => store.currentTemplate,
  (tpl) => {
    if (tpl && !tpl.channels.includes(selectedChannel.value)) {
      selectedChannel.value = tpl.channels[0] ?? NotificationChannel.EMAIL;
      // The loaded content is for the channel just left: load the new one's.
      void reloadTemplate();
    }
  },
);

// ── Init ──

onMounted(() => {
  loadTemplates();
});
</script>

<style scoped>
.preview-frame {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 16px;
  min-height: 300px;
  background: white;
  overflow: auto;
  max-height: 500px;
}

.sms-preview {
  background: #f5f5f5;
  border-radius: 8px;
  min-height: 200px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.sms-bubble {
  background: #e3f2fd;
  border-radius: 16px;
  padding: 12px 16px;
  max-width: 280px;
  font-size: 14px;
  line-height: 1.4;
}

.push-preview {
  background: #f5f5f5;
  border-radius: 8px;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.push-notification {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  width: 100%;
  max-width: 340px;
}
</style>
