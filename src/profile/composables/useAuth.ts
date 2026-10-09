/**
 * The password ceremonies (shared between all profile UIs): registration,
 * sign-in, password change and reset.
 *
 * A password is installed (a first password, a change or a reset) in one
 * server-side operation. The preparing RPC returns the operation's history
 * context; the client blinds its history input for the server's evaluator,
 * proves policy and history over the same password, bound to the operation
 * and to its OPAQUE request, and sends the proof with the final record.
 * Sign-in runs on the same Pallas OPAQUE client, since the server registers
 * on Pallas.
 *
 * The client-side crypto is injected as {@link ZkppClientApi} (implemented by
 * `@structured-id/opaque`), keeping kernel delivery at the app layer.
 * gRPC calls go through useAuthApi wrappers.
 */
import {
  completePasswordReset,
  evaluatePasswordHistory,
  executePasswordReset,
  opaqueLoginFinish,
  opaqueLoginStart,
  opaqueZkppRegistrationFinish,
  opaqueZkppRegistrationStart,
  passwordChangeChallenge,
  passwordChangeExecute,
  passwordChangeFinish,
  type CompletePasswordResetResponse,
  type PasswordHistoryContext,
  type PasswordHistoryEvaluation,
  type PasswordRegistrationProof,
} from "./useAuthApi";

// ── Types ──

/** A sign-in's session, as the server issued it. */
export interface LoginResult {
  sessionId: string;
  accessToken: string;
  expiresIn: number;
}

/** A registration's profile and its password credential. */
export interface RegisterResult {
  profileId: string;
  credentialId: string;
}

import {
  CONFIRMED_CHANGE_STEPS,
  INSTALL_STEPS,
  OperationPlan,
  type PasswordOperationProgress,
} from "./operationPlan";

/** A password change of the signed-in user. */
export interface PasswordChange {
  /** The password credential to change. */
  credentialId: string;
  newPassword: string;
  /** The current password, proved inside the change; required while the
   * server requires it, accepted whenever given. */
  currentPassword?: string;
}

export {
  DEFAULT_STEP_MS,
  OperationPlan,
  type PasswordOperationProgress,
  type PasswordOperationStep,
} from "./operationPlan";

/** The operation's history context as the ZKPP client takes it. */
export interface ZkppHistoryContext {
  /** The operation, 16 bytes; every later step carries it. */
  operationId: Uint8Array;
  ownerDomain: Uint8Array;
  domains: { comparisonDomain: Uint8Array; evaluatorPublicKey: Uint8Array }[];
  policyVersion: number;
}

/** The client's blinded history input; `blind` stays with the client. */
export interface ZkppHistoryRequest {
  blind: Uint8Array;
  blinded: Uint8Array;
}

/** The evaluator's answer for one comparison domain. */
export interface ZkppHistoryEvaluation {
  evaluatedElement: Uint8Array;
  proof: { challenge: Uint8Array; response: Uint8Array };
}

/** The OPAQUE registration start: the request sent, the state kept local. */
export interface ZkppRegistrationStart {
  request: Uint8Array;
  state: string;
}

/** A registration proof: Halo2 bytes and its public instances. */
export interface ZkppProof {
  proof: Uint8Array;
  instances: Uint8Array[];
}

/**
 * Interface for the ZKPP client-side crypto.
 * Implemented by @structured-id/opaque ZkppClient.
 */
export interface ZkppClientApi {
  /** True once the client answers no more calls (a worker it runs on stopped). */
  readonly stopped: boolean;
  registrationStart(password: string): Promise<ZkppRegistrationStart>;
  /** `null` when the circuit cannot hold the password; the server alone
   * decides whether proof-free setup is permitted. This never means verified. */
  historyRequest(
    password: string,
    ownerDomain: Uint8Array,
  ): Promise<ZkppHistoryRequest | null>;
  prove(
    password: string,
    start: ZkppRegistrationStart,
    opts: {
      context: ZkppHistoryContext;
      history: {
        request: ZkppHistoryRequest;
        evaluations: ZkppHistoryEvaluation[];
      } | null;
      onProgress?: (p: PasswordOperationProgress) => void;
    },
  ): Promise<ZkppProof | null>;
  registrationFinish(
    password: string,
    state: string,
    response: Uint8Array,
  ): Promise<Uint8Array>;
  loginStart(password: string): Promise<{ request: Uint8Array; state: string }>;
  loginFinish(
    password: string,
    state: string,
    response: Uint8Array,
  ): Promise<Uint8Array>;
}

/**
 * Loads the client on first use: public TypeScript or an application-supplied
 * kernel. Automatic selection may use TS after a pre-operation WASM load failure.
 * Errors after an operation starts propagate without moving its state to another kernel.
 */
export type ZkppClientLoader = () => Promise<ZkppClientApi>;

/** What the finish of an operation sends. */
interface Installed {
  operationId: Uint8Array;
  record: Uint8Array;
  proof?: PasswordRegistrationProof;
}

/** The preparing RPC's answer to the OPAQUE request: the operation and the response. */
interface Exchange {
  context: PasswordHistoryContext | undefined;
  registrationResponse: Uint8Array;
}

// ── Wire conversions ──

/** The operation's context; a server that prepared none cannot take a password. */
function historyContext(
  wire: PasswordHistoryContext | undefined,
): ZkppHistoryContext {
  const operationId = wire?.operationId?.value;
  if (!wire || !operationId || operationId.length === 0) {
    throw new Error("The server did not prepare a password operation");
  }
  return {
    operationId,
    ownerDomain: wire.ownerDomain,
    domains: wire.domains.map((d) => ({
      comparisonDomain: d.comparisonDomain,
      evaluatorPublicKey: d.evaluatorPublicKey,
    })),
    policyVersion: wire.policyVersion,
  };
}

/** The evaluator's answers with their proofs; an answer without one proves nothing. */
function historyEvaluations(
  answers: PasswordHistoryEvaluation[],
): ZkppHistoryEvaluation[] {
  return answers.map((answer) => {
    if (!answer.proof) {
      throw new Error("The history evaluator answered without a proof");
    }
    return {
      evaluatedElement: answer.evaluatedElement,
      proof: {
        challenge: answer.proof.challenge,
        response: answer.proof.response,
      },
    };
  });
}

function wireProof(
  proof: ZkppProof | null,
): PasswordRegistrationProof | undefined {
  return proof
    ? { zkppProof: proof.proof, instances: proof.instances }
    : undefined;
}

/**
 * Create the password ceremonies with an injected client loader; an app
 * wraps the result in its `useAuth()`.
 *
 * @example
 * ```ts
 * import { loadZkppClient } from "@structured-id/opaque";
 * import { createAuth } from "@structured-id/ui-core/profile";
 *
 * const { register, login, prewarm } = createAuth(() => loadZkppClient());
 * void prewarm(); // when the page opens
 * ```
 */
export function createAuth(loadClient: ZkppClientLoader) {
  let client: Promise<ZkppClientApi> | undefined;
  let loaded: ZkppClientApi | undefined;

  /**
   * The client, loaded once and kept for each next operation; a failed load
   * is retried next time, and a client that stopped answering is replaced.
   */
  function zkpp(): Promise<ZkppClientApi> {
    if (loaded?.stopped) {
      client = undefined;
      loaded = undefined;
    }
    client ??= loadClient().then(
      (c) => (loaded = c),
      (e: unknown) => {
        client = undefined;
        throw e;
      },
    );
    return client;
  }

  /**
   * The steps every operation shares: the OPAQUE start, `exchange` (the RPC
   * that answers the request and names the operation), the history
   * evaluation, the proof and the record.
   */
  async function install(
    password: string,
    exchange: (request: Uint8Array) => Promise<Exchange>,
    plan: OperationPlan,
  ): Promise<Installed> {
    const c = await zkpp();
    plan.enter("protect");
    const start = await c.registrationStart(password);
    const { context: wire, registrationResponse } = await exchange(
      start.request,
    );
    const context = historyContext(wire);
    plan.enter("compare");
    const request = await c.historyRequest(password, context.ownerDomain);
    const history = request
      ? {
          request,
          evaluations: historyEvaluations(
            await evaluatePasswordHistory(context.operationId, request.blinded),
          ),
        }
      : null;
    plan.enter("prove");
    const proof = await c.prove(password, start, {
      context,
      history,
      // The prover's own time-based 0..1 fills the proof's share.
      onProgress: (p) => plan.within(p.fraction),
    });
    // The record (the client's stretching) and the server's check.
    plan.enter("verify");
    const record = await c.registrationFinish(
      password,
      start.state,
      registrationResponse,
    );
    return {
      operationId: context.operationId,
      record,
      proof: wireProof(proof),
    };
  }

  /**
   * Register `identifier` with `password`: the start carries the OPAQUE
   * request and returns the operation, the finish carries the record with
   * the proof. `claimToken` claims an installation that has no administrator.
   */
  async function register(
    identifier: string,
    password: string,
    claimToken?: string,
    onProgress?: (p: PasswordOperationProgress) => void,
  ): Promise<RegisterResult> {
    const plan = new OperationPlan(onProgress);
    const done = await install(
      password,
      async (request) => {
        const started = await opaqueZkppRegistrationStart(
          identifier,
          request,
          claimToken,
        );
        return {
          context: started.history,
          registrationResponse: started.registrationResponse,
        };
      },
      plan,
    );
    const finished = await opaqueZkppRegistrationFinish(
      done.operationId,
      done.record,
      done.proof,
    );
    plan.finish();
    return {
      profileId: finished.profileId,
      credentialId: finished.credentialId,
    };
  }

  /**
   * Replace the signed-in user's password with `change.newPassword`: the
   * challenge names the operation, the execute step answers the OPAQUE
   * request, the finish carries the record with the proof. With
   * `change.currentPassword` the change signs in with it inside the same
   * steps (KE1 in the challenge, KE3 in execute), which the server requires
   * unless its policy says the session's authentication is recent enough
   * ({@link useCurrentPasswordRequirement}); a wrong current password is
   * refused before anything new is proved.
   */
  async function changePassword(
    change: PasswordChange,
    onProgress?: (p: PasswordOperationProgress) => void,
  ): Promise<void> {
    const { credentialId, newPassword, currentPassword } = change;
    const proves = !!currentPassword;
    const plan = new OperationPlan(
      onProgress,
      proves ? CONFIRMED_CHANGE_STEPS : INSTALL_STEPS,
    );
    let challenge: Awaited<ReturnType<typeof passwordChangeChallenge>>;
    let credentialFinalization: Uint8Array = new Uint8Array();
    if (currentPassword) {
      const c = await zkpp();
      plan.enter("confirm");
      const login = await c.loginStart(currentPassword);
      challenge = await passwordChangeChallenge(credentialId, login.request);
      try {
        credentialFinalization = await c.loginFinish(
          currentPassword,
          login.state,
          challenge.credentialResponse,
        );
      } catch {
        // A wrong current password fails here, on the client. The server
        // still gets a finalization, one that cannot verify, so it refuses
        // the change as a wrong sign-in and counts it toward the lockout.
        credentialFinalization = new Uint8Array(64);
      }
    } else {
      challenge = await passwordChangeChallenge(credentialId);
    }
    const context = historyContext(challenge.history);
    const done = await install(
      newPassword,
      async (request) => ({
        context: challenge.history,
        registrationResponse: (
          await passwordChangeExecute(
            context.operationId,
            credentialId,
            request,
            credentialFinalization,
          )
        ).registrationResponse,
      }),
      plan,
    );
    await passwordChangeFinish(
      done.operationId,
      credentialId,
      done.record,
      done.proof,
    );
    plan.finish();
  }

  /**
   * Replace the password under a verified reset: `context` is the operation
   * the verification prepared (`VerifyPasswordResetResponse.history`).
   */
  async function resetPassword(
    resetSessionId: string,
    context: PasswordHistoryContext | undefined,
    newPassword: string,
    onProgress?: (p: PasswordOperationProgress) => void,
  ): Promise<CompletePasswordResetResponse> {
    const plan = new OperationPlan(onProgress);
    const prepared = historyContext(context);
    const done = await install(
      newPassword,
      async (request) => ({
        context,
        registrationResponse: (
          await executePasswordReset(prepared.operationId, request)
        ).registrationResponse,
      }),
      plan,
    );
    const completed = await completePasswordReset(
      resetSessionId,
      done.operationId,
      done.record,
      done.proof,
    );
    plan.finish();
    return completed;
  }

  /**
   * Sign in with a Pallas OPAQUE credential (2 round-trips via gRPC-web).
   */
  async function login(
    identifier: string,
    password: string,
    onStep?: (step: number) => void,
  ): Promise<LoginResult> {
    const c = await zkpp();
    onStep?.(1);
    const start = await c.loginStart(password);
    onStep?.(2);
    const started = await opaqueLoginStart(identifier, start.request);
    onStep?.(3);
    const finalization = await c.loginFinish(
      password,
      start.state,
      started.credentialResponse,
    );
    const finished = await opaqueLoginFinish(
      identifier,
      finalization,
      started.serverLoginState,
    );
    return {
      sessionId: finished.sessionId,
      accessToken: finished.accessToken,
      expiresIn: Number(finished.expiresIn),
    };
  }

  /**
   * Load the client now, when the page opens, so the kernel's download and
   * compilation are done before the user submits a password. Resolves when
   * loading ends either way: a failed load is retried, and reported, by the
   * next operation.
   */
  async function prewarm(): Promise<void> {
    await zkpp().catch(() => undefined);
  }

  return { register, changePassword, resetPassword, login, prewarm };
}
