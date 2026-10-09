import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  createAuth,
  type ZkppClientApi,
  DEFAULT_STEP_MS,
  type PasswordOperationProgress,
  WrongCurrentPasswordError,
} from "./useAuth";

// Mock the gRPC wrappers
vi.mock("./useAuthApi", () => ({
  completePasswordReset: vi.fn(),
  evaluatePasswordHistory: vi.fn(),
  executePasswordReset: vi.fn(),
  opaqueLoginStart: vi.fn(),
  opaqueLoginFinish: vi.fn(),
  opaqueZkppRegistrationStart: vi.fn(),
  opaqueZkppRegistrationFinish: vi.fn(),
  passwordChangeChallenge: vi.fn(),
  passwordChangeExecute: vi.fn(),
  passwordChangeFinish: vi.fn(),
}));

import {
  completePasswordReset,
  evaluatePasswordHistory,
  executePasswordReset,
  opaqueLoginStart,
  opaqueLoginFinish,
  opaqueZkppRegistrationStart,
  opaqueZkppRegistrationFinish,
  passwordChangeChallenge,
  passwordChangeExecute,
  passwordChangeFinish,
  type PasswordHistoryContext,
} from "./useAuthApi";

const api = {
  completeReset: vi.mocked(completePasswordReset),
  evaluate: vi.mocked(evaluatePasswordHistory),
  executeReset: vi.mocked(executePasswordReset),
  loginStart: vi.mocked(opaqueLoginStart),
  loginFinish: vi.mocked(opaqueLoginFinish),
  regStart: vi.mocked(opaqueZkppRegistrationStart),
  regFinish: vi.mocked(opaqueZkppRegistrationFinish),
  challenge: vi.mocked(passwordChangeChallenge),
  execute: vi.mocked(passwordChangeExecute),
  changeFinish: vi.mocked(passwordChangeFinish),
};

// ── Fixtures ──

const OPERATION = new Uint8Array(16).fill(7);
const OWNER_DOMAIN = new Uint8Array(32).fill(1);
const DOMAIN = new Uint8Array(32).fill(2);
const KEY = new Uint8Array(32).fill(3);

/** The history context as the server's preparing RPC returns it. */
function wireContext(): PasswordHistoryContext {
  return {
    operationId: { value: OPERATION },
    ownerDomain: OWNER_DOMAIN,
    domains: [{ comparisonDomain: DOMAIN, evaluatorPublicKey: KEY }],
    policyVersion: 1,
  };
}

/** The same context as the client takes it. */
const clientContext = {
  operationId: OPERATION,
  ownerDomain: OWNER_DOMAIN,
  domains: [{ comparisonDomain: DOMAIN, evaluatorPublicKey: KEY }],
  policyVersion: 1,
};

const START = { request: new Uint8Array([10, 11]), state: "reg-state" };
const HISTORY = { blind: new Uint8Array([1]), blinded: new Uint8Array([2]) };
const PROOF = {
  proof: new Uint8Array([9, 9]),
  instances: [new Uint8Array(32)],
};
const RECORD = new Uint8Array([20, 21]);
const RESPONSE = new Uint8Array([13, 14]);
const ANSWER = {
  evaluatedElement: new Uint8Array([5]),
  proof: { challenge: new Uint8Array([6]), response: new Uint8Array([7]) },
};

function fakeClient(): ZkppClientApi {
  return {
    stopped: false,
    registrationStart: vi.fn().mockResolvedValue(START),
    historyRequest: vi.fn().mockResolvedValue(HISTORY),
    prove: vi.fn().mockResolvedValue(PROOF),
    registrationFinish: vi.fn().mockResolvedValue(RECORD),
    loginStart: vi.fn().mockResolvedValue({
      request: new Uint8Array([1, 2, 3]),
      state: "login-state",
    }),
    loginFinish: vi.fn().mockResolvedValue(new Uint8Array([7, 8, 9])),
  };
}

let client: ZkppClientApi;
let loader: Mock<() => Promise<ZkppClientApi>>;

beforeEach(() => {
  vi.clearAllMocks();
  client = fakeClient();
  loader = vi.fn<() => Promise<ZkppClientApi>>().mockResolvedValue(client);
  api.evaluate.mockResolvedValue([ANSWER]);
});

describe("createAuth prewarm", () => {
  beforeEach(() => {
    api.loginStart.mockResolvedValue({
      credentialResponse: new Uint8Array([4]),
      serverLoginState: "server-state",
    });
    api.loginFinish.mockResolvedValue({
      sessionId: "s",
      accessToken: "t",
      expiresIn: 60n,
    });
  });

  // Loading the client when the page opens: the kernel's download and
  // compilation are done before the user submits, and the operation that
  // follows uses the same client instead of loading another.
  it("loads the client once and the next operation reuses it", async () => {
    const { prewarm, login } = createAuth(loader);
    await prewarm();
    await login("bob@test.com", "P@ssw0rd!");
    expect(loader).toHaveBeenCalledTimes(1);
    expect(client.loginStart).toHaveBeenCalledOnce();
  });

  // A prewarm that fails does not break the page: it resolves, and the next
  // operation loads again and reports its own failure if there is one.
  it("resolves after a failed load and leaves the next operation to load again", async () => {
    loader.mockRejectedValueOnce(new Error("offline"));
    const { prewarm, login } = createAuth(loader);
    await expect(prewarm()).resolves.toBeUndefined();
    await login("bob@test.com", "P@ssw0rd!");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  // A client whose worker stopped (after prewarm or an earlier operation)
  // answers nothing again: the next operation starts on a newly loaded one.
  it("loads a new client for the next operation after the client stopped", async () => {
    const stoppedClient = { ...fakeClient(), stopped: true };
    const fresh = fakeClient();
    loader.mockReset();
    loader.mockResolvedValueOnce(stoppedClient).mockResolvedValueOnce(fresh);
    const { prewarm, login } = createAuth(loader);
    await prewarm();
    await login("bob@test.com", "P@ssw0rd!");
    expect(loader).toHaveBeenCalledTimes(2);
    expect(stoppedClient.loginStart).not.toHaveBeenCalled();
    expect(fresh.loginStart).toHaveBeenCalledOnce();
  });
});

describe("createAuth register", () => {
  beforeEach(() => {
    api.regStart.mockResolvedValue({
      registrationResponse: RESPONSE,
      history: wireContext(),
    });
    api.regFinish.mockResolvedValue({
      profileId: "profile-uuid",
      credentialId: "cred-uuid",
    });
  });

  it("runs the operation: start, evaluate, prove, finish with the proof", async () => {
    const { register } = createAuth(loader);
    const result = await register("bob@test.com", "N3wP@ssword!", "sidclaim_x");

    expect(client.registrationStart).toHaveBeenCalledWith("N3wP@ssword!");
    expect(api.regStart).toHaveBeenCalledWith(
      "bob@test.com",
      START.request,
      "sidclaim_x",
    );
    expect(client.historyRequest).toHaveBeenCalledWith(
      "N3wP@ssword!",
      OWNER_DOMAIN,
    );
    expect(api.evaluate).toHaveBeenCalledWith(OPERATION, HISTORY.blinded);
    expect(client.prove).toHaveBeenCalledWith(
      "N3wP@ssword!",
      START,
      expect.objectContaining({
        context: clientContext,
        history: { request: HISTORY, evaluations: [ANSWER] },
      }),
    );
    expect(client.registrationFinish).toHaveBeenCalledWith(
      "N3wP@ssword!",
      "reg-state",
      RESPONSE,
    );
    expect(api.regFinish).toHaveBeenCalledWith(OPERATION, RECORD, {
      zkppProof: PROOF.proof,
      instances: PROOF.instances,
    });
    expect(result).toEqual({
      profileId: "profile-uuid",
      credentialId: "cred-uuid",
    });
  });

  // A password the circuit cannot hold has no history request: nothing is
  // evaluated or proved, and the finish carries no proof.
  it("installs a password without a proof when the client cannot prove it", async () => {
    vi.mocked(client.historyRequest).mockResolvedValue(null);
    vi.mocked(client.prove).mockResolvedValue(null);

    const { register } = createAuth(loader);
    await register("bob@test.com", "x".repeat(200));

    expect(api.evaluate).not.toHaveBeenCalled();
    expect(client.prove).toHaveBeenCalledWith(
      "x".repeat(200),
      START,
      expect.objectContaining({ history: null }),
    );
    expect(api.regFinish).toHaveBeenCalledWith(OPERATION, RECORD, undefined);
  });

  // The user follows the operation by its steps: on this device, the
  // comparison with previous passwords, the proof (filled by the prover's own
  // progress) and the server's check, in that order and never backwards,
  // ending complete.
  it("reports each step, with the prover filling the proof's share", async () => {
    // Step times learned by earlier tests in this browser would move the shares.
    localStorage.clear();
    vi.mocked(client.prove).mockImplementation(async (_pw, _start, opts) => {
      opts.onProgress?.({ fraction: 0.5, label: "Computing quotient" });
      return PROOF;
    });
    const seen: PasswordOperationProgress[] = [];
    const { register } = createAuth(loader);
    await register("bob@test.com", "pw", undefined, (p) => seen.push(p));
    const ms = DEFAULT_STEP_MS;
    const total = ms.protect + ms.compare + ms.prove + ms.verify;
    const proveStart = (ms.protect + ms.compare) / total;

    expect(seen.map((p) => p.step)).toEqual([
      "protect",
      "compare",
      "prove",
      "prove",
      "verify",
      "verify",
    ]);
    [
      0,
      ms.protect / total,
      proveStart,
      proveStart + ms.prove / total / 2,
      proveStart + ms.prove / total,
      1,
    ].forEach((expected, i) =>
      expect(seen[i].fraction).toBeCloseTo(expected, 10),
    );
    expect(seen[3].label, "the prover's stage names stay inside").toBe(
      "Building the proof",
    );
  });

  it("refuses to go on when the server prepared no operation", async () => {
    api.regStart.mockResolvedValue({
      registrationResponse: RESPONSE,
      history: undefined,
    });
    const { register } = createAuth(loader);
    await expect(register("bob@test.com", "pw")).rejects.toThrow(
      /did not prepare/,
    );
    expect(client.prove).not.toHaveBeenCalled();
    expect(api.regFinish).not.toHaveBeenCalled();
  });

  // A client that fails mid-operation (its worker stopped while proving,
  // a history request it cannot make) ends the operation: nothing reaches
  // the finish, so no password is installed without its proof, and the
  // operation is not taken up by another client.
  it("ends the operation when the proof fails", async () => {
    vi.mocked(client.prove).mockRejectedValue(new Error("WASM worker failed"));
    const { register } = createAuth(loader);
    await expect(register("bob@test.com", "pw")).rejects.toThrow(
      "WASM worker failed",
    );
    expect(client.registrationFinish).not.toHaveBeenCalled();
    expect(api.regFinish).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("ends the operation when the history request fails", async () => {
    vi.mocked(client.historyRequest).mockRejectedValue(
      new Error("WASM worker failed"),
    );
    const { register } = createAuth(loader);
    await expect(register("bob@test.com", "pw")).rejects.toThrow(
      "WASM worker failed",
    );
    expect(api.evaluate).not.toHaveBeenCalled();
    expect(client.prove).not.toHaveBeenCalled();
    expect(api.regFinish).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("refuses an evaluator answer without a proof", async () => {
    api.evaluate.mockResolvedValue([
      { evaluatedElement: new Uint8Array([5]), proof: undefined },
    ]);
    const { register } = createAuth(loader);
    await expect(register("bob@test.com", "pw")).rejects.toThrow(
      /without a proof/,
    );
    expect(client.prove).not.toHaveBeenCalled();
  });

  it("propagates gRPC errors from the start", async () => {
    api.regStart.mockRejectedValue(new Error("ALREADY_EXISTS"));
    const { register } = createAuth(loader);
    await expect(register("taken@test.com", "pw")).rejects.toThrow(
      "ALREADY_EXISTS",
    );
  });

  it("loads the client once and retries a failed load", async () => {
    loader
      .mockRejectedValueOnce(new Error("ZKPP needs WebAssembly"))
      .mockResolvedValue(client);
    const { register } = createAuth(loader);

    await expect(register("bob@test.com", "pw")).rejects.toThrow(
      "ZKPP needs WebAssembly",
    );
    await register("bob@test.com", "pw");
    await register("bob@test.com", "pw");
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe("createAuth changePassword", () => {
  const KE2 = new Uint8Array([4, 4]);
  beforeEach(() => {
    api.challenge.mockResolvedValue({
      history: wireContext(),
      credentialResponse: new Uint8Array(),
    });
    api.execute.mockResolvedValue({ registrationResponse: RESPONSE });
    api.changeFinish.mockResolvedValue({});
  });

  it("challenges, executes the OPAQUE start, proves and finishes", async () => {
    const { changePassword } = createAuth(loader);
    await changePassword({
      credentialId: "cred-1",
      newPassword: "N3wP@ssword!",
    });

    expect(api.challenge).toHaveBeenCalledWith("cred-1");
    expect(client.loginStart).not.toHaveBeenCalled();
    expect(api.execute).toHaveBeenCalledWith(
      OPERATION,
      "cred-1",
      START.request,
      new Uint8Array(),
    );
    expect(api.evaluate).toHaveBeenCalledWith(OPERATION, HISTORY.blinded);
    expect(client.prove).toHaveBeenCalledWith(
      "N3wP@ssword!",
      START,
      expect.objectContaining({ context: clientContext }),
    );
    expect(api.changeFinish).toHaveBeenCalledWith(OPERATION, "cred-1", RECORD, {
      zkppProof: PROOF.proof,
      instances: PROOF.instances,
    });
  });

  // The current password is proved with a sign-in carried by the change's
  // own steps: KE1 in the challenge, KE3 in execute, before any proof work.
  it("proves the current password inside the change", async () => {
    api.challenge.mockResolvedValue({
      history: wireContext(),
      credentialResponse: KE2,
    });
    const seen: PasswordOperationProgress[] = [];
    const { changePassword } = createAuth(loader);
    await changePassword(
      {
        credentialId: "cred-1",
        newPassword: "N3wP@ssword!",
        currentPassword: "0ldP@ssword!",
      },
      (p) => seen.push(p),
    );

    expect(client.loginStart).toHaveBeenCalledWith("0ldP@ssword!");
    expect(api.challenge).toHaveBeenCalledWith(
      "cred-1",
      new Uint8Array([1, 2, 3]),
    );
    expect(client.loginFinish).toHaveBeenCalledWith(
      "0ldP@ssword!",
      "login-state",
      KE2,
    );
    expect(api.execute).toHaveBeenCalledWith(
      OPERATION,
      "cred-1",
      START.request,
      new Uint8Array([7, 8, 9]),
    );
    expect(seen[0]).toMatchObject({ step: "confirm", fraction: 0 });
  });

  // A wrong current password fails in the client's own sign-in; the server
  // already counted the guess when it issued KE2, so the change stops here
  // with an error the form can name, and nothing more is sent.
  it("stops at a wrong current password", async () => {
    api.challenge.mockResolvedValue({
      history: wireContext(),
      credentialResponse: KE2,
    });
    vi.mocked(client.loginFinish).mockRejectedValue(new Error("invalid login"));
    const { changePassword } = createAuth(loader);
    await expect(
      changePassword({
        credentialId: "cred-1",
        newPassword: "N3wP@ssword!",
        currentPassword: "wrong",
      }),
    ).rejects.toBeInstanceOf(WrongCurrentPasswordError);
    expect(api.execute).not.toHaveBeenCalled();
    expect(client.prove).not.toHaveBeenCalled();
  });

  // A client that stopped answering is a fault, not a wrong password: its
  // own error comes through.
  it("reports a stopped client as itself", async () => {
    api.challenge.mockResolvedValue({
      history: wireContext(),
      credentialResponse: KE2,
    });
    const stopped = new Error("the worker stopped");
    vi.mocked(client.loginFinish).mockImplementation(async () => {
      (client as { stopped: boolean }).stopped = true;
      throw stopped;
    });
    const { changePassword } = createAuth(loader);
    await expect(
      changePassword({
        credentialId: "cred-1",
        newPassword: "N3wP@ssword!",
        currentPassword: "0ldP@ssword!",
      }),
    ).rejects.toBe(stopped);
    expect(api.execute).not.toHaveBeenCalled();
  });

  it("stops before any OPAQUE start when the challenge prepared no operation", async () => {
    api.challenge.mockResolvedValue({
      history: undefined,
      credentialResponse: new Uint8Array(),
    });
    const { changePassword } = createAuth(loader);
    await expect(
      changePassword({ credentialId: "cred-1", newPassword: "pw" }),
    ).rejects.toThrow(/did not prepare/);
    expect(client.registrationStart).not.toHaveBeenCalled();
    expect(api.execute).not.toHaveBeenCalled();
  });

  it("propagates a refused history (password reused) from the finish", async () => {
    api.changeFinish.mockRejectedValue(new Error("PASSWORD_REUSED"));
    const { changePassword } = createAuth(loader);
    await expect(
      changePassword({ credentialId: "cred-1", newPassword: "pw" }),
    ).rejects.toThrow("PASSWORD_REUSED");
  });
});

describe("createAuth resetPassword", () => {
  beforeEach(() => {
    api.executeReset.mockResolvedValue({ registrationResponse: RESPONSE });
    api.completeReset.mockResolvedValue({
      sessionId: "sess-1",
      accessToken: "jwt",
      expiresIn: 3600,
    });
  });

  it("executes the OPAQUE start under the reset operation and completes with the proof", async () => {
    const { resetPassword } = createAuth(loader);
    const done = await resetPassword("reset-1", wireContext(), "N3wP@ssword!");

    expect(api.executeReset).toHaveBeenCalledWith(OPERATION, START.request);
    expect(api.completeReset).toHaveBeenCalledWith(
      "reset-1",
      OPERATION,
      RECORD,
      {
        zkppProof: PROOF.proof,
        instances: PROOF.instances,
      },
    );
    expect(done.sessionId).toBe("sess-1");
  });

  it("refuses a verification that prepared no operation", async () => {
    const { resetPassword } = createAuth(loader);
    await expect(resetPassword("reset-1", undefined, "pw")).rejects.toThrow(
      /did not prepare/,
    );
    expect(client.registrationStart).not.toHaveBeenCalled();
  });
});

describe("createAuth login", () => {
  beforeEach(() => {
    api.loginStart.mockResolvedValue({
      credentialResponse: new Uint8Array([4, 5, 6]),
      serverLoginState: "server-state",
    });
    api.loginFinish.mockResolvedValue({
      sessionId: "sess-1",
      accessToken: "jwt",
      expiresIn: BigInt(3600),
    } as never);
  });

  it("signs in with the Pallas client in two round trips", async () => {
    const { login } = createAuth(loader);
    const steps: number[] = [];
    const result = await login("alice@test.com", "pw", (s) => steps.push(s));

    expect(client.loginStart).toHaveBeenCalledWith("pw");
    expect(api.loginStart).toHaveBeenCalledWith(
      "alice@test.com",
      new Uint8Array([1, 2, 3]),
    );
    expect(client.loginFinish).toHaveBeenCalledWith(
      "pw",
      "login-state",
      new Uint8Array([4, 5, 6]),
    );
    expect(api.loginFinish).toHaveBeenCalledWith(
      "alice@test.com",
      new Uint8Array([7, 8, 9]),
      "server-state",
    );
    expect(steps).toEqual([1, 2, 3]);
    expect(result).toEqual({
      sessionId: "sess-1",
      accessToken: "jwt",
      expiresIn: 3600,
    });
  });

  it("propagates a wrong password (the client cannot finish)", async () => {
    vi.mocked(client.loginFinish).mockRejectedValue(
      new Error("login finish: InvalidLoginError"),
    );
    const { login } = createAuth(loader);
    await expect(login("alice@test.com", "wrong")).rejects.toThrow(
      "InvalidLoginError",
    );
    expect(api.loginFinish).not.toHaveBeenCalled();
  });
});
