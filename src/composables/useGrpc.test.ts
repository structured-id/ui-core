import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock modules BEFORE importing the module under test
// ---------------------------------------------------------------------------

const mockAdaptiveInit = vi
  .fn<[], Promise<void>>()
  .mockResolvedValue(undefined);
const mockAdaptiveClose = vi.fn();
const mockAdaptiveActiveTransport = vi
  .fn<[], string>()
  .mockReturnValue("grpc-web");

vi.mock("../transport/adaptive", () => ({
  AdaptiveRpcTransport: vi.fn().mockImplementation(() => ({
    init: mockAdaptiveInit,
    close: mockAdaptiveClose,
    get activeTransport() {
      return mockAdaptiveActiveTransport();
    },
  })),
}));

vi.mock("@protobuf-ts/grpcweb-transport", () => ({
  GrpcWebFetchTransport: vi
    .fn()
    .mockImplementation(() => ({ type: "grpc-web-transport" })),
}));

// Import AFTER mocks
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import { AdaptiveRpcTransport } from "../transport/adaptive";
import {
  initGrpc,
  getTransport,
  closeTransport,
  getTransportType,
  useGrpc,
} from "./useGrpc";
import type { GrpcConfig } from "../types/auth";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useGrpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset transport state by calling close between tests
    closeTransport();
  });

  describe("initGrpc — without WebTransport URL", () => {
    it("creates GrpcWebFetchTransport with baseUrl and credentials", () => {
      const config: GrpcConfig = { baseUrl: "https://api.sid.example.com" };
      initGrpc(config);

      expect(GrpcWebFetchTransport).toHaveBeenCalledWith({
        baseUrl: "https://api.sid.example.com",
        fetchInit: { credentials: "include" },
      });
      expect(AdaptiveRpcTransport).not.toHaveBeenCalled();
    });

    it("getTransportType returns grpc-web", () => {
      initGrpc({ baseUrl: "https://api.sid.example.com" });
      expect(getTransportType()).toBe("grpc-web");
    });
  });

  describe("initGrpc — with WebTransport URL", () => {
    it("creates AdaptiveRpcTransport with fetchInit credentials", () => {
      const config: GrpcConfig = {
        baseUrl: "https://api.sid.example.com",
        webTransportUrl: "https://wt.api.sid.example.com",
      };
      initGrpc(config);

      expect(AdaptiveRpcTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          grpcWebUrl: "https://api.sid.example.com",
          webTransportUrl: "https://wt.api.sid.example.com",
          fetchInit: { credentials: "include" },
        }),
      );
      expect(GrpcWebFetchTransport).not.toHaveBeenCalled();
    });

    it("calls adaptive.init() non-blocking on creation", async () => {
      initGrpc({
        baseUrl: "https://api.sid.example.com",
        webTransportUrl: "https://wt.api.sid.example.com",
      });

      // init() should be called (non-blocking fire-and-forget)
      // Give microtasks time to run
      await Promise.resolve();
      expect(mockAdaptiveInit).toHaveBeenCalled();
    });

    it("passes all WebTransport options to AdaptiveRpcTransport", () => {
      const onChange = vi.fn();
      initGrpc({
        baseUrl: "https://api.sid.example.com",
        webTransportUrl: "https://wt.api.sid.example.com",
        webTransportCertHash: "abcdef1234567890",
        webTransportReconnectDelay: 3000,
        onTransportChange: onChange,
      });

      expect(AdaptiveRpcTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          grpcWebUrl: "https://api.sid.example.com",
          webTransportUrl: "https://wt.api.sid.example.com",
          webTransportCertHash: "abcdef1234567890",
          reconnectDelay: 3000,
          onTransportChange: onChange,
          fetchInit: { credentials: "include" },
        }),
      );
    });

    it("getTransportType delegates to AdaptiveRpcTransport.activeTransport", () => {
      mockAdaptiveActiveTransport.mockReturnValue("webtransport");
      initGrpc({
        baseUrl: "https://api.sid.example.com",
        webTransportUrl: "https://wt.api.sid.example.com",
      });

      expect(getTransportType()).toBe("webtransport");
    });
  });

  describe("getTransport", () => {
    it("throws before initGrpc is called", () => {
      expect(() => getTransport()).toThrow("gRPC transport not initialized");
    });

    it("returns transport after initGrpc", () => {
      initGrpc({ baseUrl: "https://api.sid.example.com" });
      expect(() => getTransport()).not.toThrow();
      expect(getTransport()).toBeDefined();
    });
  });

  describe("useGrpc composable", () => {
    it("transport.value is null before initGrpc", () => {
      const { transport } = useGrpc();
      expect(transport.value).toBeNull();
    });

    it("transport.value is set when initGrpc was called before useGrpc", () => {
      initGrpc({ baseUrl: "https://api.sid.example.com" });
      const { transport } = useGrpc();
      expect(transport.value).not.toBeNull();
    });

    it("returns getTransport and initGrpc functions", () => {
      const composable = useGrpc();
      expect(typeof composable.getTransport).toBe("function");
      expect(typeof composable.initGrpc).toBe("function");
    });

    it("transport.value is null after closeTransport", () => {
      initGrpc({ baseUrl: "https://api.sid.example.com" });
      closeTransport();
      const { transport } = useGrpc();
      expect(transport.value).toBeNull();
    });
  });

  describe("closeTransport", () => {
    it("calls close() on AdaptiveRpcTransport", () => {
      initGrpc({
        baseUrl: "https://api.sid.example.com",
        webTransportUrl: "https://wt.api.sid.example.com",
      });

      closeTransport();
      expect(mockAdaptiveClose).toHaveBeenCalled();
    });

    it("resets transport to null (getTransport throws after close)", () => {
      initGrpc({ baseUrl: "https://api.sid.example.com" });
      closeTransport();
      expect(() => getTransport()).toThrow("gRPC transport not initialized");
    });

    it("does not call close() on plain GrpcWebFetchTransport (no close method)", () => {
      initGrpc({ baseUrl: "https://api.sid.example.com" });
      // Should not throw even though GrpcWebFetchTransport has no close()
      expect(() => closeTransport()).not.toThrow();
    });
  });
});
