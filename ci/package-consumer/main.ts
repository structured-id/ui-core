import { createApp, h } from "vue";
import { createPinia } from "pinia";
import { initGrpc, getTransport } from "@structured-id/ui-core";
import { SidStatusBadge } from "@structured-id/ui-core/components";
import { fetchCurrentProfile } from "@structured-id/ui-core/profile";
import { IdentityServiceClient } from "@structured-id/proto/sid/v1/identity/identity.client";

// Compile the root, profile and SFC subpaths together. A workspace alias or an
// old generated-client export cannot satisfy these imports in this consumer.
initGrpc({ baseUrl: window.location.origin });
const identity = new IdentityServiceClient(getTransport());
const app = createApp({
  setup() {
    if (!identity || typeof fetchCurrentProfile !== "function")
      throw new Error("Packaged clients failed to initialize");
    return () => h(SidStatusBadge, { label: "SDK consumer ready" });
  },
});
app.use(createPinia());
app.mount("#app");
