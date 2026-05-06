/**
 * OPAQUE auth flow orchestration (shared between all profile UIs).
 *
 * Uses dependency injection for client-side crypto: apps provide an
 * OpaqueClientApi implementation (from @structured-id/opaque), keeping
 * the WASM dependency at the app layer.
 *
 * gRPC calls go through useAuthApi wrappers.
 */
import {
  opaqueLoginStart,
  opaqueLoginFinish,
  opaqueRegistrationStart,
  opaqueRegistrationFinish,
} from "./useAuthApi";

// ── Types ──

export interface LoginResult {
  sessionId: string;
  accessToken: string;
  expiresIn: number;
}

export interface RegisterResult {
  profileId: string;
  credentialId: string;
}

/**
 * Interface for OPAQUE client-side crypto operations.
 * Implemented by @structured-id/opaque OpaqueClient.
 */
export interface OpaqueClientApi {
  loginStart(password: string): Promise<{ ke1: Uint8Array; state: unknown }>;
  loginFinish(
    password: string,
    ke2: Uint8Array,
    state: unknown,
  ): Promise<{ ke3: Uint8Array }>;
  registrationStart(
    password: string,
  ): Promise<{ request: Uint8Array; state: unknown }>;
  registrationFinish(
    password: string,
    response: Uint8Array,
    state: unknown,
  ): Promise<{ record: Uint8Array }>;
}

export type OpaqueClientFactory = (
  serverId: string,
  clientId: string,
) => OpaqueClientApi;

/**
 * Create an OPAQUE auth composable with injected crypto client.
 *
 * @param createClient - Factory that creates an OpaqueClientApi instance
 * @param serverId - OPAQUE server identifier (default: "structured.id")
 *
 * @example
 * ```ts
 * import { OpaqueClient } from "@structured-id/opaque";
 * import { createOpaqueAuth } from "@structured-id/ui-core/profile";
 *
 * const { login, register } = createOpaqueAuth(
 *   (serverId, clientId) => new OpaqueClient({ serverId, clientId }),
 * );
 * ```
 */
export function createOpaqueAuth(
  createClient: OpaqueClientFactory,
  serverId = "structured.id",
) {
  /**
   * Perform full OPAQUE login flow (2 round-trips via gRPC-web).
   *
   * 1. loginStart: send credentialRequest → receive credentialResponse + serverLoginState
   * 2. loginFinish: send credentialFinalization → receive session tokens
   */
  async function login(
    identifier: string,
    password: string,
    onStep?: (step: number) => void,
  ): Promise<LoginResult> {
    const opaque = createClient(serverId, identifier);

    // Step 1: Generate credential request (client-side only, password never sent)
    onStep?.(1);
    const start = await opaque.loginStart(password);

    // Step 2: Send credential request to server
    onStep?.(2);
    const startResp = await opaqueLoginStart(identifier, start.ke1);

    // Step 3: Process server response, generate finalization (client-side crypto)
    onStep?.(3);
    const finish = await opaque.loginFinish(
      password,
      startResp.credentialResponse,
      start.state,
    );

    // Step 4: Send finalization, receive session tokens
    const finishResp = await opaqueLoginFinish(
      identifier,
      finish.ke3,
      startResp.serverLoginState,
    );

    return {
      sessionId: finishResp.sessionId,
      accessToken: finishResp.accessToken,
      expiresIn: Number(finishResp.expiresIn),
    };
  }

  /**
   * Perform full OPAQUE registration flow (2 round-trips via gRPC-web).
   *
   * 1. registrationStart: send registrationRequest → receive registrationResponse + serverSetup
   * 2. registrationFinish: send registrationRecord → receive profileId + credentialId
   */
  async function register(
    identifier: string,
    password: string,
  ): Promise<RegisterResult> {
    const opaque = createClient(serverId, identifier);

    // Step 1: Generate registration request
    const start = await opaque.registrationStart(password);

    const startResp = await opaqueRegistrationStart(
      identifier,
      start.request,
    );

    // Step 2: Process server response, generate registration record
    const finish = await opaque.registrationFinish(
      password,
      startResp.registrationResponse,
      start.state,
    );

    const finishResp = await opaqueRegistrationFinish(
      identifier,
      finish.record,
      startResp.serverSetup,
    );

    return {
      profileId: finishResp.profileId,
      credentialId: finishResp.credentialId,
    };
  }

  /**
   * Compute OPAQUE registration record WITHOUT storing the credential.
   *
   * Used by password reset: the registration_record is passed to
   * CompletePasswordReset RPC which stores the credential in the
   * context of the reset session (replacing the old one).
   *
   * 1. registrationStart: send registrationRequest → receive registrationResponse
   * 2. Client-side finish: compute registrationRecord (NOT sent to server yet)
   */
  async function computeRegistrationRecord(
    identifier: string,
    password: string,
  ): Promise<Uint8Array> {
    const opaque = createClient(serverId, identifier);

    const start = await opaque.registrationStart(password);

    const startResp = await opaqueRegistrationStart(
      identifier,
      start.request,
    );

    const finish = await opaque.registrationFinish(
      password,
      startResp.registrationResponse,
      start.state,
    );

    return finish.record;
  }

  return { login, register, computeRegistrationRecord };
}
