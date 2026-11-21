/**
 * Authorization consent interaction composable.
 *
 * Wraps AuthFlowServiceClient for the issuer's consent page: the review of
 * one authorization operation, the user's decision on the reviewed revision,
 * and the operation's durable state after a reload or a lost answer. The
 * browser's own IdP session authenticates every call; recording a decision
 * issues nothing, the page then follows the issuer continuation.
 */
import { getTransport } from "../../index";
import { AuthorizationOperationId } from "@structured-id/ids";
import { AuthFlowServiceClient } from "@structured-id/proto/sid/v1/authn/auth_flow.client";
import {
  AuthorizationStep,
  ClaimSharing,
  ConsentDecision,
  type ClaimChoice,
  type ConsentClaim,
  type ConsentDetails,
  type FlowState,
} from "@structured-id/proto/sid/v1/authn/auth_flow";

function client(): AuthFlowServiceClient {
  return new AuthFlowServiceClient(getTransport());
}

export { AuthorizationStep, ClaimSharing, ConsentDecision };
export type { ClaimChoice, ConsentClaim, ConsentDetails, FlowState };

/** The wire operation id of `reference`, the page's `operation` query value. */
function operationId(reference: string) {
  return AuthorizationOperationId.parse(reference).toWire();
}

/**
 * The review of the operation `reference`: what the client asks for, each
 * claim with its allowed sharing and the value approving discloses, the
 * revision and the CSRF value a decision on it carries.
 */
export async function getConsent(reference: string): Promise<ConsentDetails> {
  const { response } = await client().getConsent({
    operationId: operationId(reference),
  });
  return response;
}

/**
 * Record `decision` on the revision `review` showed, with one choice per
 * reviewed claim for an approval. A repeated identical decision answers the
 * committed state.
 */
export async function submitConsent(
  review: ConsentDetails,
  decision: ConsentDecision,
  choices: ClaimChoice[],
): Promise<FlowState> {
  const { response } = await client().submitConsent({
    operationId: review.operationId,
    revision: review.revision,
    csrfToken: review.csrfToken,
    decision,
    choices: decision === ConsentDecision.APPROVE ? choices : [],
  });
  return response;
}

/** The durable state of the operation `reference`, with its continuation while one is owed. */
export async function getFlowState(reference: string): Promise<FlowState> {
  const { response } = await client().getFlowState({
    operationId: operationId(reference),
  });
  return response;
}
