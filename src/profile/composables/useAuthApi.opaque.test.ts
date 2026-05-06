import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  opaqueLoginStart,
  opaqueLoginFinish,
  opaqueRegistrationStart,
  opaqueRegistrationFinish,
} from "./useAuthApi";

// Mock the gRPC transport + AuthServiceClient
const mockOpaqueLoginStart = vi.fn();
const mockOpaqueLoginFinish = vi.fn();
const mockOpaqueRegistrationStart = vi.fn();
const mockOpaqueRegistrationFinish = vi.fn();

vi.mock("../../index", () => ({
  getTransport: vi.fn(),
  AuthServiceClient: vi.fn().mockImplementation(() => ({
    opaqueLoginStart: mockOpaqueLoginStart,
    opaqueLoginFinish: mockOpaqueLoginFinish,
    opaqueRegistrationStart: mockOpaqueRegistrationStart,
    opaqueRegistrationFinish: mockOpaqueRegistrationFinish,
  })),
}));

// authMeta needs to be mocked since it uses useAuth() which needs Vue context
vi.mock("../auth", () => ({
  authMeta: () => ({}),
}));

describe("OPAQUE gRPC wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("opaqueLoginStart", () => {
    it("sends principal and credentialRequest, returns response", async () => {
      const expected = {
        credentialResponse: new Uint8Array([1, 2, 3]),
        serverLoginState: "state-123",
      };
      mockOpaqueLoginStart.mockResolvedValue({ response: expected });

      const result = await opaqueLoginStart(
        "alice@test.com",
        new Uint8Array([10, 20]),
      );

      expect(mockOpaqueLoginStart).toHaveBeenCalledWith({
        principal: "alice@test.com",
        credentialRequest: new Uint8Array([10, 20]),
      });
      expect(result).toBe(expected);
    });

    it("propagates gRPC errors", async () => {
      mockOpaqueLoginStart.mockRejectedValue(new Error("UNAVAILABLE"));
      await expect(opaqueLoginStart("x", new Uint8Array())).rejects.toThrow(
        "UNAVAILABLE",
      );
    });
  });

  describe("opaqueLoginFinish", () => {
    it("sends principal, finalization, and serverLoginState", async () => {
      const expected = {
        sessionId: "sess-1",
        accessToken: "jwt",
        expiresIn: BigInt(3600),
      };
      mockOpaqueLoginFinish.mockResolvedValue({ response: expected });

      const result = await opaqueLoginFinish(
        "alice@test.com",
        new Uint8Array([7, 8, 9]),
        "state-123",
      );

      expect(mockOpaqueLoginFinish).toHaveBeenCalledWith({
        principal: "alice@test.com",
        credentialFinalization: new Uint8Array([7, 8, 9]),
        serverLoginState: "state-123",
      });
      expect(result).toBe(expected);
    });
  });

  describe("opaqueRegistrationStart", () => {
    it("sends principal and registrationRequest", async () => {
      const expected = {
        registrationResponse: new Uint8Array([4, 5, 6]),
        serverSetup: "setup-abc",
      };
      mockOpaqueRegistrationStart.mockResolvedValue({ response: expected });

      const result = await opaqueRegistrationStart(
        "bob@test.com",
        new Uint8Array([11, 12]),
      );

      expect(mockOpaqueRegistrationStart).toHaveBeenCalledWith({
        principal: "bob@test.com",
        registrationRequest: new Uint8Array([11, 12]),
      });
      expect(result).toBe(expected);
    });
  });

  describe("opaqueRegistrationFinish", () => {
    it("sends principal, record, and serverSetup", async () => {
      const expected = {
        profileId: "profile-uuid",
        credentialId: "cred-uuid",
        serverPepper: new Uint8Array(),
      };
      mockOpaqueRegistrationFinish.mockResolvedValue({ response: expected });

      const result = await opaqueRegistrationFinish(
        "bob@test.com",
        new Uint8Array([20, 21]),
        "setup-abc",
      );

      expect(mockOpaqueRegistrationFinish).toHaveBeenCalledWith({
        principal: "bob@test.com",
        registrationRecord: new Uint8Array([20, 21]),
        serverSetup: "setup-abc",
      });
      expect(result).toBe(expected);
    });

    it("propagates gRPC errors", async () => {
      mockOpaqueRegistrationFinish.mockRejectedValue(
        new Error("ALREADY_EXISTS"),
      );
      await expect(
        opaqueRegistrationFinish("x", new Uint8Array(), "s"),
      ).rejects.toThrow("ALREADY_EXISTS");
    });
  });
});
