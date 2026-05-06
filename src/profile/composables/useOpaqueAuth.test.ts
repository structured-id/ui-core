import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createOpaqueAuth,
  type OpaqueClientApi,
  type OpaqueClientFactory,
} from "./useOpaqueAuth";

// Mock the gRPC wrappers
vi.mock("./useAuthApi", () => ({
  opaqueLoginStart: vi.fn(),
  opaqueLoginFinish: vi.fn(),
  opaqueRegistrationStart: vi.fn(),
  opaqueRegistrationFinish: vi.fn(),
}));

import {
  opaqueLoginStart,
  opaqueLoginFinish,
  opaqueRegistrationStart,
  opaqueRegistrationFinish,
  type OpaqueLoginStartResponse,
  type OpaqueLoginFinishResponse,
  type OpaqueRegistrationStartResponse,
  type OpaqueRegistrationFinishResponse,
} from "./useAuthApi";

const mockLoginStart = vi.mocked(opaqueLoginStart);
const mockLoginFinish = vi.mocked(opaqueLoginFinish);
const mockRegStart = vi.mocked(opaqueRegistrationStart);
const mockRegFinish = vi.mocked(opaqueRegistrationFinish);

// ── Fake OpaqueClient ──

function createFakeOpaqueClient(): OpaqueClientApi {
  return {
    loginStart: vi.fn().mockResolvedValue({
      ke1: new Uint8Array([1, 2, 3]),
      state: "login-state-opaque",
    }),
    loginFinish: vi.fn().mockResolvedValue({
      ke3: new Uint8Array([7, 8, 9]),
    }),
    registrationStart: vi.fn().mockResolvedValue({
      request: new Uint8Array([10, 11, 12]),
      state: "reg-state-opaque",
    }),
    registrationFinish: vi.fn().mockResolvedValue({
      record: new Uint8Array([20, 21, 22]),
    }),
  };
}

let fakeClient: OpaqueClientApi;
let factory: OpaqueClientFactory;

describe("createOpaqueAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeClient = createFakeOpaqueClient();
    factory = vi.fn().mockReturnValue(fakeClient);
  });

  describe("login", () => {
    beforeEach(() => {
      mockLoginStart.mockResolvedValue({
        credentialResponse: new Uint8Array([4, 5, 6]),
        serverLoginState: "server-state-123",
      } as unknown as OpaqueLoginStartResponse);
      mockLoginFinish.mockResolvedValue({
        sessionId: "sess-1",
        accessToken: "jwt-token",
        expiresIn: BigInt(3600),
      } as unknown as OpaqueLoginFinishResponse);
    });

    it("performs full 4-step OPAQUE login flow", async () => {
      const { login } = createOpaqueAuth(factory, "test.server");
      const result = await login("alice@test.com", "password123");

      // Factory creates client with correct serverId and clientId
      expect(factory).toHaveBeenCalledWith("test.server", "alice@test.com");

      // Step 1: client-side crypto
      expect(fakeClient.loginStart).toHaveBeenCalledWith("password123");

      // Step 2: gRPC call with ke1
      expect(mockLoginStart).toHaveBeenCalledWith(
        "alice@test.com",
        new Uint8Array([1, 2, 3]),
      );

      // Step 3: client-side finalization
      expect(fakeClient.loginFinish).toHaveBeenCalledWith(
        "password123",
        new Uint8Array([4, 5, 6]),
        "login-state-opaque",
      );

      // Step 4: gRPC finish call
      expect(mockLoginFinish).toHaveBeenCalledWith(
        "alice@test.com",
        new Uint8Array([7, 8, 9]),
        "server-state-123",
      );

      // Result: bigint expiresIn converted to number
      expect(result).toEqual({
        sessionId: "sess-1",
        accessToken: "jwt-token",
        expiresIn: 3600,
      });
    });

    it("calls onStep callback at each phase", async () => {
      const { login } = createOpaqueAuth(factory);
      const onStep = vi.fn();
      await login("alice@test.com", "pass", onStep);

      expect(onStep).toHaveBeenCalledWith(1);
      expect(onStep).toHaveBeenCalledWith(2);
      expect(onStep).toHaveBeenCalledWith(3);
      expect(onStep).toHaveBeenCalledTimes(3);
    });

    it("propagates gRPC error from loginStart", async () => {
      mockLoginStart.mockRejectedValue(new Error("UNAUTHENTICATED"));

      const { login } = createOpaqueAuth(factory);
      await expect(login("alice@test.com", "wrong")).rejects.toThrow(
        "UNAUTHENTICATED",
      );
    });

    it("propagates gRPC error from loginFinish", async () => {
      mockLoginFinish.mockRejectedValue(new Error("INTERNAL"));

      const { login } = createOpaqueAuth(factory);
      await expect(login("alice@test.com", "pass")).rejects.toThrow("INTERNAL");
    });

    it("propagates client-side crypto error", async () => {
      (fakeClient.loginStart as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("WASM init failed"),
      );

      const { login } = createOpaqueAuth(factory);
      await expect(login("alice@test.com", "pass")).rejects.toThrow(
        "WASM init failed",
      );
    });

    it("uses default serverId when not specified", async () => {
      const { login } = createOpaqueAuth(factory);
      await login("bob@test.com", "pass");

      expect(factory).toHaveBeenCalledWith("structured.id", "bob@test.com");
    });
  });

  describe("register", () => {
    beforeEach(() => {
      mockRegStart.mockResolvedValue({
        registrationResponse: new Uint8Array([13, 14, 15]),
        serverSetup: "setup-xyz",
      } as unknown as OpaqueRegistrationStartResponse);
      mockRegFinish.mockResolvedValue({
        profileId: "profile-uuid",
        credentialId: "cred-uuid",
        serverPepper: new Uint8Array(),
      } as unknown as OpaqueRegistrationFinishResponse);
    });

    it("performs full 4-step OPAQUE registration flow", async () => {
      const { register } = createOpaqueAuth(factory, "test.server");
      const result = await register("bob@test.com", "newpass");

      expect(factory).toHaveBeenCalledWith("test.server", "bob@test.com");

      // Step 1: client-side request
      expect(fakeClient.registrationStart).toHaveBeenCalledWith("newpass");

      // Step 2: gRPC start
      expect(mockRegStart).toHaveBeenCalledWith(
        "bob@test.com",
        new Uint8Array([10, 11, 12]),
      );

      // Step 3: client-side record generation
      expect(fakeClient.registrationFinish).toHaveBeenCalledWith(
        "newpass",
        new Uint8Array([13, 14, 15]),
        "reg-state-opaque",
      );

      // Step 4: gRPC finish
      expect(mockRegFinish).toHaveBeenCalledWith(
        "bob@test.com",
        new Uint8Array([20, 21, 22]),
        "setup-xyz",
      );

      expect(result).toEqual({
        profileId: "profile-uuid",
        credentialId: "cred-uuid",
      });
    });

    it("propagates gRPC error from registrationStart", async () => {
      mockRegStart.mockRejectedValue(new Error("ALREADY_EXISTS"));

      const { register } = createOpaqueAuth(factory);
      await expect(register("taken@test.com", "pass")).rejects.toThrow(
        "ALREADY_EXISTS",
      );
    });

    it("propagates gRPC error from registrationFinish", async () => {
      mockRegFinish.mockRejectedValue(new Error("INTERNAL"));

      const { register } = createOpaqueAuth(factory);
      await expect(register("bob@test.com", "pass")).rejects.toThrow(
        "INTERNAL",
      );
    });
  });

  describe("computeRegistrationRecord", () => {
    beforeEach(() => {
      mockRegStart.mockResolvedValue({
        registrationResponse: new Uint8Array([13, 14, 15]),
        serverSetup: "setup-xyz",
      } as unknown as OpaqueRegistrationStartResponse);
    });

    it("returns registration record without calling registrationFinish RPC", async () => {
      const { computeRegistrationRecord } = createOpaqueAuth(
        factory,
        "test.server",
      );
      const record = await computeRegistrationRecord(
        "alice@test.com",
        "newpass",
      );

      expect(factory).toHaveBeenCalledWith("test.server", "alice@test.com");

      // Step 1: client-side request
      expect(fakeClient.registrationStart).toHaveBeenCalledWith("newpass");

      // Step 2: gRPC start (server generates RegistrationResponse)
      expect(mockRegStart).toHaveBeenCalledWith(
        "alice@test.com",
        new Uint8Array([10, 11, 12]),
      );

      // Step 3: client-side record generation
      expect(fakeClient.registrationFinish).toHaveBeenCalledWith(
        "newpass",
        new Uint8Array([13, 14, 15]),
        "reg-state-opaque",
      );

      // registrationFinish RPC must NOT be called
      expect(mockRegFinish).not.toHaveBeenCalled();

      // Returns raw record bytes
      expect(record).toEqual(new Uint8Array([20, 21, 22]));
    });

    it("propagates gRPC error from registrationStart", async () => {
      mockRegStart.mockRejectedValue(new Error("NOT_FOUND"));

      const { computeRegistrationRecord } = createOpaqueAuth(factory);
      await expect(
        computeRegistrationRecord("unknown@test.com", "pass"),
      ).rejects.toThrow("NOT_FOUND");
    });

    it("propagates client-side crypto error", async () => {
      (
        fakeClient.registrationFinish as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error("WASM crypto error"));

      const { computeRegistrationRecord } = createOpaqueAuth(factory);
      await expect(
        computeRegistrationRecord("alice@test.com", "pass"),
      ).rejects.toThrow("WASM crypto error");
    });
  });
});
