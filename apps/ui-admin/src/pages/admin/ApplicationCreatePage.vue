<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <q-btn
        flat
        round
        icon="sym_o_arrow_back"
        :to="{ name: 'admin-applications' }"
      />
      <div class="text-h5 q-ml-sm">Create Application</div>
    </div>

    <q-stepper
      v-model="step"
      ref="stepperRef"
      color="primary"
      animated
      flat
      bordered
    >
      <!-- Step 1: Basics -->
      <q-step :name="1" title="Basics" icon="sym_o_info" :done="step > 1">
        <div class="q-gutter-md" style="max-width: 500px">
          <q-input
            v-model="form.name"
            outlined
            label="Application name"
            :rules="[(v: string) => !!v || 'Name is required']"
          />
          <div class="text-subtitle2">Roles</div>
          <div class="text-caption text-grey">
            A client obtains tokens; a protected resource is an API that accepts
            them. An application has one role or both.
          </div>
          <q-toggle v-model="form.withClient" label="OAuth client" />
          <q-toggle v-model="form.withResource" label="Protected resource" />
          <div v-if="form.withClient" class="text-subtitle2 q-mb-sm">
            Client type
          </div>
          <div v-if="form.withClient" class="row q-col-gutter-sm">
            <div
              v-for="opt in appTypeOptions"
              :key="opt.value"
              class="col-6 col-sm-3"
            >
              <q-card
                flat
                bordered
                :class="{ 'bg-blue-1 border-primary': form.type === opt.value }"
                class="cursor-pointer text-center q-pa-md"
                @click="selectType(opt.value)"
              >
                <q-icon
                  :name="opt.icon"
                  size="32px"
                  :color="form.type === opt.value ? 'primary' : 'grey-6'"
                />
                <div class="text-subtitle2 q-mt-sm">{{ opt.label }}</div>
                <div class="text-caption text-grey">{{ opt.hint }}</div>
              </q-card>
            </div>
          </div>
        </div>
        <q-stepper-navigation>
          <q-btn
            color="primary"
            label="Next"
            @click="goStep2"
            :disable="!canContinue"
            no-caps
          />
        </q-stepper-navigation>
      </q-step>

      <!-- Step 2: Protocol -->
      <q-step :name="2" title="Protocol" icon="sym_o_settings" :done="step > 2">
        <div class="q-gutter-md" style="max-width: 600px">
          <template v-if="form.withResource">
            <div class="text-subtitle2">Resource indicator</div>
            <q-input
              v-model="form.indicator"
              outlined
              dense
              placeholder="https://api.example.com/orders"
              hint="An absolute URI without a fragment: the audience of the resource's tokens (RFC 8707)"
            />
            <q-input
              v-model="form.resourceScopes"
              outlined
              dense
              label="Resource scopes"
              hint="Space-separated scopes the resource understands"
            />
          </template>

          <template v-if="form.withClient">
            <!-- Redirect URIs (not for M2M) -->
            <template v-if="form.type !== ApplicationType.API">
              <div class="text-subtitle2">Redirect URIs</div>
              <div
                v-for="(uri, i) in form.redirectUris"
                :key="i"
                class="row items-center q-gutter-sm"
              >
                <q-input
                  v-model="form.redirectUris[i]"
                  outlined
                  dense
                  class="col"
                  placeholder="https://app.example.com/callback"
                />
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_close"
                  @click="form.redirectUris.splice(i, 1)"
                />
              </div>
              <q-btn
                flat
                dense
                icon="sym_o_add"
                label="Add URI"
                no-caps
                @click="form.redirectUris.push('')"
              />
            </template>

            <!-- What the new client may reach (not for M2M: a machine names
                 its target itself) -->
            <template v-if="form.type !== ApplicationType.API">
              <div class="text-subtitle2 q-mt-md">Sign-in</div>
              <q-toggle
                v-model="form.signIn"
                label="Sign users in (OpenID Connect)"
                data-test="sign-in-access"
              />
              <div class="text-caption text-grey">
                <template v-if="form.signIn">
                  The application gets access to this installation's UserInfo
                  with the sign-in scopes, saved as its default target, so a
                  standard sign-in works. It gets access to nothing else.
                </template>
                <template v-else>
                  The application is created with access to no resource: its
                  requests are refused until you give it access under Access on
                  its page.
                </template>
              </div>
            </template>

            <!-- Grant types -->
            <div class="text-subtitle2 q-mt-md">Grant types</div>
            <div class="q-gutter-sm">
              <q-checkbox
                v-for="gt in availableGrantTypes"
                :key="gt.value"
                v-model="form.grantTypes"
                :val="gt.value"
                :label="gt.label"
                :disable="gt.forced"
              />
            </div>

            <!-- PKCE (SPA/Native) -->
            <q-toggle
              v-if="
                form.type === ApplicationType.SPA ||
                form.type === ApplicationType.NATIVE
              "
              :model-value="true"
              disable
              label="PKCE required (enforced for this app type)"
            />
          </template>
        </div>
        <q-stepper-navigation>
          <q-btn
            color="primary"
            label="Create"
            @click="submit"
            :loading="store.loading"
            no-caps
          />
          <q-btn flat label="Back" @click="step = 1" class="q-ml-sm" no-caps />
        </q-stepper-navigation>
      </q-step>

      <!-- Step 3: Credentials (shown after creation) -->
      <q-step :name="3" title="Credentials" icon="sym_o_key" :done="step > 3">
        <q-banner
          v-if="store.lastCreatedSecret"
          class="bg-warning text-dark q-mb-md"
        >
          <template #avatar>
            <q-icon name="sym_o_warning" />
          </template>
          Save the client secret now. It will not be shown again.
        </q-banner>
        <q-banner
          v-if="signInAccess === 'saved'"
          class="bg-grey-2 text-dark q-mb-md"
          rounded
          data-test="sign-in-saved"
        >
          The application can sign users in: it has access to this
          installation's UserInfo, saved as its default target.
        </q-banner>
        <q-banner
          v-if="signInAccess === 'failed'"
          class="bg-negative text-white q-mb-md"
          rounded
          data-test="sign-in-failed"
        >
          The application was created, but its sign-in access was not saved:
          {{ signInFailure }} Until it has that access its sign-in is refused.
          Give it under Access on the application's page; do not create the
          application again.
        </q-banner>

        <div class="q-gutter-md" style="max-width: 600px">
          <template v-if="createdApp?.client">
            <div class="text-subtitle2">Client ID</div>
            <q-input
              :model-value="createdApp.client.clientId"
              outlined
              readonly
              dense
            >
              <template #append>
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_content_copy"
                  @click="copyToClipboard(createdApp.client.clientId)"
                />
              </template>
            </q-input>
          </template>

          <template v-if="createdApp?.resource">
            <div class="text-subtitle2">Resource indicator</div>
            <q-input
              :model-value="createdApp.resource.indicator"
              outlined
              readonly
              dense
            />
          </template>

          <template v-if="store.lastCreatedSecret">
            <div class="text-subtitle2">Client Secret</div>
            <q-input
              :model-value="store.lastCreatedSecret"
              outlined
              readonly
              dense
              :type="showSecret ? 'text' : 'password'"
            >
              <template #append>
                <q-btn
                  flat
                  round
                  dense
                  :icon="
                    showSecret ? 'sym_o_visibility_off' : 'sym_o_visibility'
                  "
                  @click="showSecret = !showSecret"
                />
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_content_copy"
                  @click="copyToClipboard(store.lastCreatedSecret || '')"
                />
              </template>
            </q-input>
          </template>
        </div>

        <q-stepper-navigation>
          <q-btn
            color="primary"
            label="Go to Application"
            no-caps
            :to="
              createdApp
                ? {
                    name: 'admin-application-detail',
                    params: { id: shown(createdApp.id) },
                  }
                : undefined
            "
          />
        </q-stepper-navigation>
      </q-step>
    </q-stepper>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from "vue";
import { copyToClipboard } from "quasar";
import { useApplicationsStore } from "#admin/stores/applications";
import { ApplicationType } from "@structured-id/proto/sid/v1/projects/projects";
import type { Application } from "@structured-id/proto/sid/v1/projects/projects";
import { ProjectId } from "@structured-id/ids";
import { refusalMessage } from "@structured-id/ui-core";
import { shown } from "#admin/ids";
import {
  discoverUserinfoEndpoint,
  grantSignInAccess,
} from "#admin/signInAccess";

const store = useApplicationsStore();

const step = ref(1);
const stepperRef = ref();
const showSecret = ref(false);
const createdApp = ref<Application | null>(null);

const form = reactive({
  name: "",
  withClient: true,
  withResource: false,
  type: ApplicationType.WEB as ApplicationType,
  redirectUris: [""] as string[],
  grantTypes: ["authorization_code", "refresh_token"] as string[],
  indicator: "",
  resourceScopes: "",
  // A browser or native client is registered to sign users in; the
  // administrator can still create it with no access.
  signIn: true,
});

/** What became of the new client's sign-in access, once it was asked for. */
const signInAccess = ref<"saved" | "failed" | null>(null);
const signInFailure = ref("");

// The server requires at least one role.
const canContinue = computed(
  () => !!form.name && (form.withClient || form.withResource),
);

const appTypeOptions = [
  {
    value: ApplicationType.WEB,
    label: "Web App",
    icon: "sym_o_language",
    hint: "Server-side",
  },
  {
    value: ApplicationType.SPA,
    label: "SPA",
    icon: "sym_o_web",
    hint: "Client-side",
  },
  {
    value: ApplicationType.NATIVE,
    label: "Native",
    icon: "sym_o_phone_iphone",
    hint: "Mobile/Desktop",
  },
  {
    value: ApplicationType.API,
    label: "M2M",
    icon: "sym_o_api",
    hint: "Service-to-service",
  },
];

function selectType(type: ApplicationType) {
  form.type = type;
  // Pre-select grant types per app type
  switch (type) {
    case ApplicationType.WEB:
      form.grantTypes = ["authorization_code", "refresh_token"];
      break;
    case ApplicationType.SPA:
      form.grantTypes = ["authorization_code"];
      break;
    case ApplicationType.NATIVE:
      form.grantTypes = [
        "authorization_code",
        "refresh_token",
        "urn:ietf:params:oauth:grant-type:device_code",
      ];
      break;
    case ApplicationType.API:
      form.grantTypes = ["client_credentials"];
      form.redirectUris = [];
      break;
  }
}

const availableGrantTypes = computed(() => {
  const isM2M = form.type === ApplicationType.API;
  return [
    { value: "authorization_code", label: "Authorization Code", forced: isM2M },
    {
      value: "client_credentials",
      label: "Client Credentials",
      forced: !isM2M,
    },
    { value: "refresh_token", label: "Refresh Token", forced: false },
    {
      value: "urn:ietf:params:oauth:grant-type:device_code",
      label: "Device Code",
      forced: false,
    },
  ].filter((gt) =>
    isM2M
      ? gt.value === "client_credentials"
      : gt.value !== "client_credentials" || !isM2M,
  );
});

function goStep2() {
  if (canContinue.value) {
    step.value = 2;
  }
}

// The console administers the installation's own project.
const projectId = ProjectId.system().toWire();

async function submit() {
  try {
    const response = await store.createApplication({
      projectId,
      name: form.name,
      client: form.withClient
        ? {
            type: form.type,
            redirectUris: form.redirectUris.filter((u) => u.trim()),
            // Empty means the server's default `openid profile email`.
            allowedScopes: [],
            grantTypes: form.grantTypes,
            postLogoutRedirectUris: [],
            // No claims beyond those of its scopes until an administrator adds them.
            claimRequests: [],
          }
        : undefined,
      resource: form.withResource
        ? {
            indicator: form.indicator.trim(),
            scopes: form.resourceScopes.split(/\s+/).filter((s) => s),
          }
        : undefined,
    });
    createdApp.value = response.application ?? null;
    step.value = 3;
  } catch {
    // store.error already set
    return;
  }
  const client = createdApp.value?.client;
  if (!client || !form.signIn || form.type === ApplicationType.API) return;
  // The application exists from here on: a failure below is reported beside
  // its credentials and finished on its page, never by creating it again.
  try {
    await store.fetchApplications(ProjectId.system());
    await grantSignInAccess(
      {
        userinfoEndpoint: discoverUserinfoEndpoint,
        setAccess: store.setClientAccess,
        setDefaultTarget: store.setDefaultTarget,
      },
      client,
      store.applications,
    );
    signInAccess.value = "saved";
  } catch (e) {
    signInFailure.value = refusalMessage(e, "the installation refused it.");
    signInAccess.value = "failed";
  }
}
</script>
