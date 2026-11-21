<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none">Headless API Reference</h5>
        <p class="text-caption text-grey q-mb-none">
          Build custom login UIs with the StructuredID authentication API.
        </p>
      </div>
    </div>

    <q-banner v-if="error" class="bg-negative text-white q-mb-md" rounded>
      {{ error }}
    </q-banner>

    <div class="row q-col-gutter-md">
      <!-- ═══ Left: Documentation ═══ -->
      <div class="col-12 col-md-8">
        <!-- Quick Start -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle1 q-mb-sm">Quick Start</div>
            <q-stepper v-model="quickStartStep" vertical flat>
              <q-step :name="1" title="Install SDK" icon="sym_o_download">
                <div class="text-body2 q-mb-sm">
                  Install the StructuredID client library:
                </div>
                <code-block lang="bash" :code="installCmd" />
              </q-step>
              <q-step :name="2" title="Start auth flow" icon="sym_o_play_arrow">
                <div class="text-body2 q-mb-sm">
                  Initialize an authentication flow:
                </div>
                <code-block lang="typescript" :code="startFlowCode" />
              </q-step>
              <q-step :name="3" title="Submit credentials" icon="sym_o_passkey">
                <div class="text-body2 q-mb-sm">
                  Submit user identification and credentials:
                </div>
                <code-block lang="typescript" :code="submitCredCode" />
              </q-step>
              <q-step
                :name="4"
                title="Handle redirect"
                icon="sym_o_open_in_new"
              >
                <div class="text-body2 q-mb-sm">
                  On completion, redirect to the target application:
                </div>
                <code-block lang="typescript" :code="redirectCode" />
              </q-step>
            </q-stepper>
          </q-card-section>
        </q-card>

        <!-- Flow State Machine -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle1 q-mb-md">Authentication Flow States</div>
            <div class="flow-diagram q-pa-md bg-grey-1 rounded-borders">
              <div class="row items-center justify-center q-gutter-sm">
                <q-badge
                  v-for="step in flowSteps"
                  :key="step.name"
                  :color="step.color"
                  :label="step.name"
                  class="text-caption q-pa-sm"
                />
              </div>
              <div class="text-caption text-grey text-center q-mt-sm">
                Each step is optional — the server determines which steps are
                required based on policy.
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Code Examples by Language -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle1 q-mb-sm">Code Examples</div>
            <q-tabs v-model="codeTab" dense align="left" class="q-mb-md">
              <q-tab name="typescript" label="TypeScript" />
              <q-tab name="rust" label="Rust" />
              <q-tab name="go" label="Go" />
              <q-tab name="python" label="Python" />
            </q-tabs>
            <q-tab-panels v-model="codeTab">
              <q-tab-panel name="typescript">
                <code-block lang="typescript" :code="tsExample" />
              </q-tab-panel>
              <q-tab-panel name="rust">
                <code-block lang="rust" :code="rustExample" />
              </q-tab-panel>
              <q-tab-panel name="go">
                <code-block lang="go" :code="goExample" />
              </q-tab-panel>
              <q-tab-panel name="python">
                <code-block lang="python" :code="pythonExample" />
              </q-tab-panel>
            </q-tab-panels>
          </q-card-section>
        </q-card>

        <!-- gRPC Service Map -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle1 q-mb-sm">API Overview</div>
            <q-list dense separator>
              <q-item v-for="rpc in serviceMap" :key="rpc.method">
                <q-item-section avatar>
                  <q-badge
                    :color="rpc.type === 'mutation' ? 'orange' : 'blue'"
                    :label="rpc.type === 'mutation' ? 'POST' : 'GET'"
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-medium">
                    {{ rpc.method }}
                  </q-item-label>
                  <q-item-label caption>{{ rpc.description }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge outline color="grey" :label="rpc.path" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <!-- ═══ Right: SDK & Resources ═══ -->
      <div class="col-12 col-md-4">
        <!-- SDK Downloads -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle1 q-mb-sm">SDK Downloads</div>
            <q-list dense>
              <q-item v-for="sdk in sdks" :key="sdk.name">
                <q-item-section avatar>
                  <q-icon :name="sdk.icon" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ sdk.name }}</q-item-label>
                  <q-item-label caption>{{ sdk.install }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>

        <!-- i18n Package -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle1 q-mb-sm">Internationalization</div>
            <div class="text-body2 q-mb-sm">
              Use the i18n package for localized login screens:
            </div>
            <code-block lang="bash" code="npm install @structured-id/i18n" />
            <div class="text-caption text-grey q-mt-sm">
              Supports 40+ locales out of the box. Custom translations via
              admin-ui text overrides.
            </div>
          </q-card-section>
        </q-card>

        <!-- Test Flow -->
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle1 q-mb-sm">Try It</div>
            <div class="text-body2 q-mb-md">
              Start an interactive test flow to explore the API step-by-step.
            </div>
            <q-select
              v-model="testClientId"
              outlined
              dense
              label="Application (client_id)"
              :options="testClientOptions"
              emit-value
              map-options
              class="q-mb-sm"
            />
            <q-btn
              color="primary"
              label="Start test flow"
              :disable="!testClientId"
              :loading="testLoading"
              @click="startTest"
              class="full-width"
            />

            <template v-if="testFlow">
              <q-separator class="q-my-md" />
              <div class="text-caption text-grey q-mb-xs">Current step</div>
              <q-badge
                :label="testFlow.currentStep"
                color="primary"
                class="q-mb-sm"
              />
              <div class="text-caption text-grey q-mb-xs">Available steps</div>
              <div class="q-gutter-xs q-mb-sm">
                <q-badge
                  v-for="step in testFlow.availableSteps"
                  :key="step"
                  :label="step"
                  outline
                  color="grey"
                />
              </div>
              <div class="text-caption text-grey q-mb-xs">Response</div>
              <pre
                class="bg-grey-2 q-pa-sm rounded-borders text-caption"
                style="overflow-x: auto"
                >{{ testFlow.rawResponse }}</pre>
            </template>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, defineComponent, h } from "vue";
import { LoginExperienceServiceClient } from "@structured-id/proto/sid/v1/admin/login_experience.client";
import type { TestFlowResponse } from "@structured-id/proto/sid/v1/admin/login_experience";
import { getTransport } from "@structured-id/ui-core";

const error = ref<string | null>(null);

function getClient() {
  return new LoginExperienceServiceClient(getTransport());
}

// ── Quick Start ──

const quickStartStep = ref(1);

const installCmd = `npm install @structured-id/client`;

const startFlowCode = `import { SidClient } from '@structured-id/client';

const client = new SidClient({
  baseUrl: 'https://auth.example.com',
  clientId: 'my-app',
});

const flow = await client.startFlow({
  redirectUri: 'https://app.example.com/callback',
  scope: 'openid profile email',
});`;

const submitCredCode = `// Submit identification (email/phone/username)
await client.submitIdentification(flow.id, {
  principal: 'user@example.com',
});

// Submit password (OPAQUE protocol)
await client.submitCredential(flow.id, {
  type: 'opaque',
  password: userInput,
});

// Handle MFA if required
if (flow.currentStep === 'mfa') {
  await client.submitMfa(flow.id, {
    type: 'totp',
    code: totpCode,
  });
}`;

const redirectCode = `// Flow complete — redirect to application
if (flow.complete && flow.redirectUri) {
  window.location.href = flow.redirectUri;
}`;

// ── Flow State Machine ──

const flowSteps = [
  { name: "IDENTIFICATION", color: "blue" },
  { name: "CREDENTIAL", color: "primary" },
  { name: "MFA", color: "orange" },
  { name: "CONSENT", color: "teal" },
  { name: "PENDING_LINK", color: "purple" },
  { name: "FIRST_LOGIN", color: "amber" },
  { name: "COMPLETE", color: "positive" },
];

// ── Code Examples ──

const codeTab = ref("typescript");

const tsExample = `import { SidClient } from '@structured-id/client';

const client = new SidClient({
  baseUrl: 'https://auth.example.com',
  clientId: 'my-app',
});

// Full authentication flow
const flow = await client.startFlow({
  redirectUri: 'https://app.example.com/callback',
  scope: 'openid profile email',
});

await client.submitIdentification(flow.id, {
  principal: 'user@example.com',
});

await client.submitCredential(flow.id, {
  type: 'opaque',
  password: userPassword,
});

// Check if MFA required
if (flow.currentStep === 'mfa') {
  await client.submitMfa(flow.id, {
    type: 'totp',
    code: totpCode,
  });
}

// Redirect on completion
window.location.href = flow.redirectUri;`;

const rustExample = `use structured_id_client::SidClient;

let client = SidClient::new("https://auth.example.com", "my-app");

let flow = client.start_flow(StartFlowRequest {
    redirect_uri: "https://app.example.com/callback",
    scope: "openid profile email",
}).await?;

client.submit_identification(&flow.id, "user@example.com").await?;
client.submit_credential(&flow.id, CredentialType::Opaque, &password).await?;

if flow.current_step == "mfa" {
    client.submit_mfa(&flow.id, MfaType::Totp, &totp_code).await?;
}

println!("Redirect: {}", flow.redirect_uri.unwrap());`;

const goExample = `import "github.com/structured-id/go-client"

client := sidclient.New("https://auth.example.com", "my-app")

flow, err := client.StartFlow(ctx, &sidclient.StartFlowRequest{
    RedirectURI: "https://app.example.com/callback",
    Scope:       "openid profile email",
})

_ = client.SubmitIdentification(ctx, flow.ID, "user@example.com")
_ = client.SubmitCredential(ctx, flow.ID, sidclient.Opaque, password)

if flow.CurrentStep == "mfa" {
    _ = client.SubmitMFA(ctx, flow.ID, sidclient.TOTP, totpCode)
}

fmt.Println("Redirect:", flow.RedirectURI)`;

const pythonExample = `from structured_id import SidClient

client = SidClient(
    base_url="https://auth.example.com",
    client_id="my-app",
)

flow = client.start_flow(
    redirect_uri="https://app.example.com/callback",
    scope="openid profile email",
)

client.submit_identification(flow.id, "user@example.com")
client.submit_credential(flow.id, "opaque", password)

if flow.current_step == "mfa":
    client.submit_mfa(flow.id, "totp", totp_code)

print(f"Redirect: {flow.redirect_uri}")`;

// ── Service Map ──

const serviceMap = [
  {
    method: "StartFlow",
    path: "/v1/auth/flow",
    type: "mutation",
    description: "Initialize an authentication flow with OAuth2 parameters",
  },
  {
    method: "SubmitIdentification",
    path: "/v1/auth/flow/{id}/identify",
    type: "mutation",
    description: "Submit user identifier (email, phone, or username)",
  },
  {
    method: "SubmitCredential",
    path: "/v1/auth/flow/{id}/credential",
    type: "mutation",
    description:
      "Submit authentication credential (OPAQUE password, WebAuthn, magic link)",
  },
  {
    method: "SubmitMfa",
    path: "/v1/auth/flow/{id}/mfa",
    type: "mutation",
    description: "Submit MFA verification (TOTP, WebAuthn, SMS, recovery code)",
  },
  {
    method: "GetFlowState",
    path: "/v1/auth/flow/{id}",
    type: "query",
    description: "Get current flow state and available next steps",
  },
  {
    method: "SubmitConsent",
    path: "/v1/auth/flow/{id}/consent",
    type: "mutation",
    description: "Submit consent decision for scope/claim grants",
  },
];

// ── SDK Downloads ──

const sdks = [
  {
    name: "@structured-id/client",
    install: "npm install @structured-id/client",
    icon: "sym_o_code",
  },
  {
    name: "structured-id-client (Rust)",
    install: "cargo add structured-id-client",
    icon: "sym_o_terminal",
  },
  {
    name: "go-client",
    install: "go get github.com/structured-id/go-client",
    icon: "sym_o_terminal",
  },
  {
    name: "structured-id (Python)",
    install: "pip install structured-id",
    icon: "sym_o_terminal",
  },
];

// ── Test Flow ──

const testClientId = ref("");
const testClientOptions = [{ label: "Default client", value: "default" }];
const testLoading = ref(false);
const testFlow = ref<TestFlowResponse | null>(null);

async function startTest() {
  if (!testClientId.value) return;
  testLoading.value = true;
  error.value = null;
  try {
    const { response } = await getClient().startTestFlow({
      clientId: testClientId.value,
    });
    testFlow.value = response;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to start test flow";
  } finally {
    testLoading.value = false;
  }
}

// ── Code Block component (inline) ──

const CodeBlock = defineComponent({
  name: "CodeBlock",
  props: {
    code: { type: String, required: true },
    lang: { type: String, default: "text" },
  },
  setup(props) {
    return () =>
      h(
        "pre",
        {
          class: "bg-grey-2 q-pa-sm rounded-borders text-caption",
          style:
            "overflow-x: auto; white-space: pre-wrap; word-break: break-word;",
        },
        [h("code", props.code)],
      );
  },
});
</script>
