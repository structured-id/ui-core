import { defineStore } from "pinia";
import { ref } from "vue";
import { NotificationTemplateServiceClient } from "@structured-id/proto/sid/v1/admin/notifications.client";
import type {
  TemplateSummary,
  NotificationTemplate,
  PreviewTemplateResponse,
  TemplateContent,
} from "@structured-id/proto/sid/v1/admin/notifications";
import { NotificationChannel } from "@structured-id/proto/sid/v1/admin/notifications";
import { getAccountTransport, refusalMessage } from "@structured-id/ui-core";

function getClient() {
  return new NotificationTemplateServiceClient(getAccountTransport());
}

export const useNotificationsStore = defineStore("notifications", () => {
  const templates = ref<TemplateSummary[]>([]);
  const currentTemplate = ref<NotificationTemplate | null>(null);
  const preview = ref<PreviewTemplateResponse | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  async function fetchTemplates(
    channel?: NotificationChannel,
    customizedOnly?: boolean,
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listTemplates({
        channel: channel ?? NotificationChannel.UNSPECIFIED,
        customizedOnly: customizedOnly ?? false,
      });
      templates.value = response.templates;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load templates";
    } finally {
      loading.value = false;
    }
  }

  /** The latest template request; an answer to an earlier one is dropped. */
  let templateRequest = 0;

  /**
   * Load the template for the selection. Only the latest request's answer
   * is applied: selecting A then B while A is in flight must not leave A
   * loaded under B's selection. True when this request's answer was applied.
   */
  async function fetchTemplate(
    templateId: string,
    channel: NotificationChannel,
    locale: string,
  ): Promise<boolean> {
    const request = ++templateRequest;
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getTemplate({
        templateId,
        channel,
        locale,
      });
      if (request !== templateRequest) return false;
      currentTemplate.value = response;
      return true;
    } catch (err) {
      if (request !== templateRequest) return false;
      error.value =
        err instanceof Error ? err.message : "Failed to load template";
      return false;
    } finally {
      if (request === templateRequest) loading.value = false;
    }
  }

  async function updateTemplate(templateId: string, content: TemplateContent) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateTemplate({
        templateId,
        content,
      });
      currentTemplate.value = response;
      // Update summary in list
      const idx = templates.value.findIndex((t) => t.templateId === templateId);
      if (idx >= 0) {
        templates.value[idx].customized = true;
        templates.value[idx].updatedAt = response.updatedAt;
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update template";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function resetTemplate(
    templateId: string,
    channel: NotificationChannel,
    locale: string,
  ) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await getClient().resetTemplate({
        templateId,
        channel,
        locale,
      });
      currentTemplate.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to reset template";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function previewTemplate(
    templateId: string,
    channel: NotificationChannel,
    locale: string,
    sampleData?: Record<string, string>,
  ) {
    error.value = null;
    try {
      const { response } = await getClient().previewTemplate({
        templateId,
        channel,
        locale,
        sampleData: sampleData ?? {},
      });
      preview.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to preview template";
      throw err;
    }
  }

  /**
   * Send the template to `recipient` (the signed-in administrator when
   * empty). Resolves when the channel accepted it; a refusal (no channel
   * configured, not accepted, no template) rejects, with its text in `error`.
   */
  async function sendTestNotification(
    templateId: string,
    channel: NotificationChannel,
    locale: string,
    recipient?: string,
  ): Promise<void> {
    error.value = null;
    try {
      await getClient().sendTestNotification({
        templateId,
        channel,
        locale,
        recipient: recipient ?? "",
      });
    } catch (err) {
      error.value = refusalMessage(err, "Failed to send test notification");
      throw err;
    }
  }

  return {
    templates,
    currentTemplate,
    preview,
    loading,
    saving,
    error,
    fetchTemplates,
    fetchTemplate,
    updateTemplate,
    resetTemplate,
    previewTemplate,
    sendTestNotification,
  };
});
