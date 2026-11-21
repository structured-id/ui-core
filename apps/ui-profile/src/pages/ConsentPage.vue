<template>
  <ceremony-frame>
    <q-card v-if="!review && !failure" flat bordered class="q-pa-lg">
      <q-skeleton type="text" width="70%" />
      <q-skeleton type="text" class="q-mt-md" />
      <q-skeleton type="QBtn" class="q-mt-lg" />
    </q-card>

    <q-banner v-else-if="failure" class="bg-negative text-white" rounded>
      {{ failure }}
    </q-banner>

    <q-card v-else-if="review" flat bordered>
      <q-card-section>
        <div class="text-h6">{{ review.clientName || review.clientId }}</div>
        <div class="text-body2 text-grey-7">
          wants to sign you in as {{ review.identityDisplayName }}
        </div>
      </q-card-section>

      <q-card-section v-if="review.scopes.length">
        <div class="text-subtitle2">Access</div>
        <q-chip v-for="scope in review.scopes" :key="scope" dense>
          {{ scope }}
        </q-chip>
      </q-card-section>

      <q-card-section v-if="review.claims.length">
        <div class="text-subtitle2">Information shared</div>
        <q-list dense>
          <q-item v-for="claim in review.claims" :key="claim.name">
            <q-item-section>
              <q-item-label>{{ claim.name }}</q-item-label>
              <q-item-label v-if="claim.value" caption>
                {{ claim.value }}
              </q-item-label>
              <q-item-label v-if="claim.justification" caption>
                {{ claim.justification }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle
                v-model="shared[claim.name]"
                :disable="isRequired(claim) || !canShare(claim)"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat
          label="Deny"
          :loading="deciding === ConsentDecision.DENY"
          :disable="deciding !== null"
          @click="decide(ConsentDecision.DENY)"
        />
        <q-btn
          color="primary"
          label="Allow"
          :loading="deciding === ConsentDecision.APPROVE"
          :disable="deciding !== null"
          @click="decide(ConsentDecision.APPROVE)"
        />
      </q-card-actions>
    </q-card>
  </ceremony-frame>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { ClaimRequestLevel } from "@structured-id/proto/sid/v1/common/claims";
import {
  ClaimSharing,
  ConsentDecision,
  getConsent,
  getFlowState,
  submitConsent,
  type ClaimChoice,
  type ConsentClaim,
  type ConsentDetails,
  type FlowState,
} from "@structured-id/ui-core/profile";
import { refusalMessage } from "@structured-id/ui-core";
import CeremonyFrame from "src/components/CeremonyFrame.vue";

const route = useRoute();
const operation =
  typeof route.query.operation === "string" ? route.query.operation : "";

const review = ref<ConsentDetails | null>(null);
const failure = ref<string | null>(null);
const deciding = ref<ConsentDecision | null>(null);
/** Whether each reviewed claim is shared, by claim name. */
const shared = reactive<Record<string, boolean>>({});

function isRequired(claim: ConsentClaim): boolean {
  return claim.level === ClaimRequestLevel.REQUIRED;
}

/** The sharing an approval gives a shared claim: the current value when allowed. */
function sharing(claim: ConsentClaim): ClaimSharing | undefined {
  if (claim.allowed.includes(ClaimSharing.STATIC)) return ClaimSharing.STATIC;
  return claim.allowed.find((s) => s !== ClaimSharing.NONE);
}

function canShare(claim: ConsentClaim): boolean {
  return sharing(claim) !== undefined;
}

/**
 * Follow the issuer's continuation of the operation. It is the issuer's own
 * authorization endpoint on this origin, never an address from the client;
 * anything else is not followed.
 */
function continueWith(state: FlowState): boolean {
  if (!state.continuationUri) return false;
  const target = new URL(state.continuationUri, window.location.origin);
  if (target.origin !== window.location.origin) {
    failure.value = "The issuer answered with a continuation elsewhere";
    return true;
  }
  window.location.assign(target.toString());
  return true;
}

/**
 * The review of the operation; an operation already decided (a reload, a
 * lost answer) continues where the issuer says.
 */
async function load() {
  if (!operation) {
    failure.value = "This page needs the authorization it reviews";
    return;
  }
  try {
    const details = await getConsent(operation);
    for (const claim of details.claims) {
      shared[claim.name] = canShare(claim);
    }
    review.value = details;
  } catch (e) {
    try {
      if (continueWith(await getFlowState(operation))) return;
    } catch {
      // The review's own refusal says more.
    }
    failure.value = refusalMessage(e, "This authorization cannot be reviewed");
  }
}

async function decide(decision: ConsentDecision) {
  if (!review.value) return;
  deciding.value = decision;
  try {
    const choices: ClaimChoice[] = review.value.claims.map((claim) => ({
      name: claim.name,
      sharing: (shared[claim.name] && sharing(claim)) || ClaimSharing.NONE,
    }));
    const state = await submitConsent(review.value, decision, choices);
    if (!continueWith(state)) {
      failure.value = "The issuer did not say where to continue";
    }
  } catch (e) {
    failure.value = refusalMessage(e, "The decision was not recorded");
  } finally {
    deciding.value = null;
  }
}

onMounted(() => void load());
</script>
