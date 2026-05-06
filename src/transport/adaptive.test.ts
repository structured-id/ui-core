import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Deferred, RpcError, UnaryCall } from "@protobuf-ts/runtime-rpc";
import type {
  RpcTransport,
  MethodInfo,
  RpcOptions,
  RpcMetadata,
  RpcStatus,
} from "@protobuf-ts/runtime-rpc";

// ---------------------------------------------------------------------------
// Mock WebTransport global (does not exist in Node.js)
// ---------------------------------------------------------------------------

class MockWebTransport {
  ready = Promise.resolve();
  closed = new Promise<void>(() => {});
  close = vi.fn();
  createBidirectionalStream = vi.fn();
}

// ---------------------------------------------------------------------------
// Mock modules BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Mock GrpcWebFetchTransport
vi.mock("@protobuf-ts/grpcweb-transport", () => ({
  GrpcWebFetchTransport: vi
    .fn()
    .mockImplementation(() => createMockTransport()),
}));

// Mock WebTransportConnection and WebTransportRpcTransport
const mockWtConnect = vi.fn<[], Promise<void>>();
const mockWtClose = vi.fn();
let mockWtTransportInstance: RpcTransport;

vi.mock("./webtransport", () => ({
  WebTransportConnection: vi.fn().mockImplementation(() => ({
    connect: mockWtConnect,
    close: mockWtClose,
  })),
  WebTransportRpcTransport: vi.fn().mockImplementation(() => {
    return mockWtTransportInstance;
  }),
}));

// Now import the module under test (AFTER vi.mock calls)
import { AdaptiveRpcTransport } from "./adaptive";
import type { AdaptiveTransportOptions } from "./adaptive";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockMsg {
  value: string;
}

function createMethodInfo(): MethodInfo<MockMsg, MockMsg> {
  return {
    service: { typeName: "test.TestService", methods: [], options: {} },
    name: "TestMethod",
    localName: "testMethod",
    idempotency: undefined,
    serverStreaming: false,
    clientStreaming: false,
    I: {
      typeName: "TestInput",
      toBinary: () => new Uint8Array(),
      fromBinary: () => ({ value: "input" }),
    },
    O: {
      typeName: "TestOutput",
      toBinary: () => new Uint8Array(),
      fromBinary: () => ({ value: "output" }),
    },
    options: {},
  } as unknown as MethodInfo<MockMsg, MockMsg>;
}

function createMockTransport(): RpcTransport {
  return {
    mergeOptions: (opts?: Partial<RpcOptions>) => opts ?? {},
    unary: vi.fn(),
    serverStreaming: vi.fn(),
    clientStreaming: vi.fn(),
    duplex: vi.fn(),
  } as unknown as RpcTransport;
}

/** Create a resolved UnaryCall with the given response. */
function resolvedUnaryCall<I extends object, O extends object>(
  method: MethodInfo<I, O>,
  input: I,
  response: O,
): UnaryCall<I, O> {
  const dH = new Deferred<RpcMetadata>();
  const dM = new Deferred<O>();
  const dS = new Deferred<RpcStatus>();
  const dT = new Deferred<RpcMetadata>();

  dH.resolve({});
  dM.resolve(response);
  dS.resolve({ code: "OK", detail: "" });
  dT.resolve({});

  return new UnaryCall(
    method,
    {},
    input,
    dH.promise,
    dM.promise,
    dS.promise,
    dT.promise,
  );
}

/** Create a rejected UnaryCall that fails with the given RpcError. */
function rejectedUnaryCall<I extends object, O extends object>(
  method: MethodInfo<I, O>,
  input: I,
  error: RpcError,
): UnaryCall<I, O> {
  const dH = new Deferred<RpcMetadata>();
  const dM = new Deferred<O>();
  const dS = new Deferred<RpcStatus>();
  const dT = new Deferred<RpcMetadata>();

  dH.reject(error);
  dM.reject(error);
  dS.reject(error);
  dT.reject(error);

  return new UnaryCall(
    method,
    {},
    input,
    dH.promise,
    dM.promise,
    dS.promise,
    dT.promise,
  );
}

function getGrpcWebTransport(adaptive: AdaptiveRpcTransport): RpcTransport {
  // Access the private fallback field
  return (adaptive as unknown as { fallback: RpcTransport }).fallback;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdaptiveRpcTransport", () => {
  const method = createMethodInfo();
  const input: MockMsg = { value: "hello" };
  const options: RpcOptions = { meta: {} };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockWtConnect.mockResolvedValue(undefined);
    mockWtTransportInstance = createMockTransport();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("when WebTransport is unavailable (no URL)", () => {
    it("always uses gRPC-web", async () => {
      const opts: AdaptiveTransportOptions = {
        grpcWebUrl: "https://grpc.sid.example.com",
        // no webTransportUrl
      };

      const adaptive = new AdaptiveRpcTransport(opts);
      await adaptive.init();

      expect(adaptive.activeTransport).toBe("grpc-web");

      const fallback = getGrpcWebTransport(adaptive);
      const mockCall = resolvedUnaryCall(method, input, { value: "ok" });
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(mockCall);

      adaptive.unary(method, input, options);

      expect(fallback.unary).toHaveBeenCalledWith(method, input, options);
    });
  });

  describe("when WebTransport is available", () => {
    let adaptive: AdaptiveRpcTransport;

    beforeEach(async () => {
      // Make WebTransport global exist so the constructor enables WT
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;

      const opts: AdaptiveTransportOptions = {
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
        reconnectDelay: 1000,
      };

      adaptive = new AdaptiveRpcTransport(opts);
      await adaptive.init();
    });

    afterEach(() => {
      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });

    it("uses WebTransport as primary transport", () => {
      expect(adaptive.activeTransport).toBe("webtransport");
    });

    it("sends unary calls through WebTransport primary", async () => {
      const mockCall = resolvedUnaryCall(method, input, { value: "wt-ok" });
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockCall);

      const call = adaptive.unary(method, input, options);
      const response = await call.response;

      expect(response).toEqual({ value: "wt-ok" });
      expect(mockWtTransportInstance.unary).toHaveBeenCalledWith(
        method,
        input,
        options,
      );
    });

    it("fails over to gRPC-web on transport error (UNAVAILABLE)", async () => {
      // Primary rejects with UNAVAILABLE (transport error)
      const transportErr = new RpcError("connection lost", "UNAVAILABLE");
      const failedCall = rejectedUnaryCall(method, input, transportErr);
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(failedCall);

      // Fallback succeeds
      const fallback = getGrpcWebTransport(adaptive);
      const successCall = resolvedUnaryCall(method, input, {
        value: "fallback-ok",
      });
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(successCall);

      const call = adaptive.unary(method, input, options);
      const response = await call.response;

      expect(response).toEqual({ value: "fallback-ok" });
      expect(fallback.unary).toHaveBeenCalledWith(method, input, options);
    });

    it("does NOT failover on application error (NOT_FOUND)", async () => {
      const appErr = new RpcError("not found", "NOT_FOUND");
      const failedCall = rejectedUnaryCall(method, input, appErr);
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(failedCall);

      const fallback = getGrpcWebTransport(adaptive);

      const call = adaptive.unary(method, input, options);

      await expect(call.response).rejects.toThrow("not found");
      expect(fallback.unary).not.toHaveBeenCalled();
    });

    it("does NOT failover on PERMISSION_DENIED", async () => {
      const appErr = new RpcError("forbidden", "PERMISSION_DENIED");
      const failedCall = rejectedUnaryCall(method, input, appErr);
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(failedCall);

      const fallback = getGrpcWebTransport(adaptive);

      const call = adaptive.unary(method, input, options);

      await expect(call.response).rejects.toThrow("forbidden");
      expect(fallback.unary).not.toHaveBeenCalled();
    });

    it("schedules reconnect after failover", async () => {
      const transportErr = new RpcError("connection lost", "UNAVAILABLE");
      const failedCall = rejectedUnaryCall(method, input, transportErr);
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(failedCall);

      const fallback = getGrpcWebTransport(adaptive);
      const successCall = resolvedUnaryCall(method, input, { value: "ok" });
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(successCall);

      const call = adaptive.unary(method, input, options);
      await call.response;

      // After failover, transport should be grpc-web
      expect(adaptive.activeTransport).toBe("grpc-web");

      // Reconnect is scheduled — advance timer
      mockWtConnect.mockResolvedValue(undefined);
      await vi.advanceTimersByTimeAsync(1000);

      // After successful reconnect, primary should be available again
      expect(adaptive.activeTransport).toBe("webtransport");
    });

    it("retries reconnect if reconnect attempt fails", async () => {
      const transportErr = new RpcError("connection lost", "UNAVAILABLE");
      const failedCall = rejectedUnaryCall(method, input, transportErr);
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(failedCall);

      const fallback = getGrpcWebTransport(adaptive);
      const successCall = resolvedUnaryCall(method, input, { value: "ok" });
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(successCall);

      const call = adaptive.unary(method, input, options);
      await call.response;

      // First reconnect attempt fails
      mockWtConnect.mockRejectedValueOnce(new Error("still down"));
      await vi.advanceTimersByTimeAsync(1000);

      // Still on gRPC-web
      expect(adaptive.activeTransport).toBe("grpc-web");

      // Second reconnect succeeds
      mockWtConnect.mockResolvedValue(undefined);
      await vi.advanceTimersByTimeAsync(1000);

      expect(adaptive.activeTransport).toBe("webtransport");
    });
  });

  describe("activeTransport getter", () => {
    it("returns grpc-web when WebTransport URL not provided", async () => {
      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
      });
      await adaptive.init();

      expect(adaptive.activeTransport).toBe("grpc-web");
    });

    it("returns webtransport after successful init", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;

      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
      });
      await adaptive.init();

      expect(adaptive.activeTransport).toBe("webtransport");

      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });

    it("returns grpc-web after init failure", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;
      mockWtConnect.mockRejectedValueOnce(new Error("connect failed"));

      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
      });
      await adaptive.init();

      expect(adaptive.activeTransport).toBe("grpc-web");

      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });

    it("schedules reconnect after init() failure", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;
      mockWtConnect.mockRejectedValueOnce(new Error("connect failed"));

      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
        reconnectDelay: 2000,
      });
      await adaptive.init();

      expect(adaptive.activeTransport).toBe("grpc-web");
      mockWtConnect.mockResolvedValue(undefined);

      // Reconnect fires after delay
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockWtConnect).toHaveBeenCalledTimes(2); // init fail + reconnect
      expect(adaptive.activeTransport).toBe("webtransport");

      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });
  });

  describe("onTransportChange callback", () => {
    it("fires when transport changes during failover", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;

      const onChange = vi.fn();
      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
        reconnectDelay: 1000,
        onTransportChange: onChange,
      });
      await adaptive.init();

      // init() calls onTransportChange with "webtransport"
      expect(onChange).toHaveBeenCalledWith("webtransport");

      // Trigger failover
      const transportErr = new RpcError("down", "UNAVAILABLE");
      const failedCall = rejectedUnaryCall(method, input, transportErr);
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(failedCall);

      const fallback = getGrpcWebTransport(adaptive);
      const successCall = resolvedUnaryCall(method, input, { value: "ok" });
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(successCall);

      const call = adaptive.unary(method, input, options);
      await call.response;

      expect(onChange).toHaveBeenCalledWith("grpc-web");

      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });
  });

  describe("close()", () => {
    it("cancels pending reconnect timer", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;

      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
        reconnectDelay: 5000,
      });
      await adaptive.init();

      // Trigger failover to schedule reconnect
      const transportErr = new RpcError("down", "UNAVAILABLE");
      const failedCall = rejectedUnaryCall(method, input, transportErr);
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(failedCall);

      const fallback = getGrpcWebTransport(adaptive);
      const successCall = resolvedUnaryCall(method, input, { value: "ok" });
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(successCall);

      const call = adaptive.unary(method, input, options);
      await call.response;

      // Close before reconnect fires
      adaptive.close();

      // Advance past reconnect delay — should NOT attempt reconnect
      mockWtConnect.mockClear();
      await vi.advanceTimersByTimeAsync(10000);

      // connect should not be called again (only the init() call)
      expect(mockWtConnect).not.toHaveBeenCalled();

      delete (globalThis as Record<string, unknown>).WebTransport;
    });
  });

  describe("clientStreaming / duplex", () => {
    it("clientStreaming throws RpcError", () => {
      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
      });
      expect(() => adaptive.clientStreaming(method, options)).toThrow(RpcError);
    });

    it("duplex throws RpcError", () => {
      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
      });
      expect(() => adaptive.duplex(method, options)).toThrow(RpcError);
    });
  });

  describe("failover triggers (all transport error codes)", () => {
    it("fails over on CANCELLED", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;
      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
      });
      await adaptive.init();

      const err = new RpcError("cancelled", "CANCELLED");
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(rejectedUnaryCall(method, input, err));

      const fallback = getGrpcWebTransport(adaptive);
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(
        resolvedUnaryCall(method, input, { value: "ok" }),
      );

      await adaptive.unary(method, input, options).response;
      expect(adaptive.activeTransport).toBe("grpc-web");

      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });

    it("fails over on UNKNOWN", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;
      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
      });
      await adaptive.init();

      const err = new RpcError("unknown", "UNKNOWN");
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(rejectedUnaryCall(method, input, err));

      const fallback = getGrpcWebTransport(adaptive);
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(
        resolvedUnaryCall(method, input, { value: "ok" }),
      );

      await adaptive.unary(method, input, options).response;
      expect(adaptive.activeTransport).toBe("grpc-web");

      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });

    it("fails over on non-RpcError (plain Error from stream failure)", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;
      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
      });
      await adaptive.init();

      // Simulate a plain Error (not RpcError) from the primary transport
      // This happens when WebTransport stream throws a non-gRPC error
      const defH = new Deferred<RpcMetadata>();
      const defM = new Deferred<MockMsg>();
      const defS = new Deferred<RpcStatus>();
      const defT = new Deferred<RpcMetadata>();
      const plainErr = new Error("stream aborted");
      defH.reject(plainErr);
      defM.reject(plainErr);
      defS.reject(plainErr);
      defT.reject(plainErr);
      const crashedCall = new UnaryCall(
        method,
        {},
        input,
        defH.promise,
        defM.promise,
        defS.promise,
        defT.promise,
      );
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(crashedCall);

      const fallback = getGrpcWebTransport(adaptive);
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(
        resolvedUnaryCall(method, input, { value: "fallback-ok" }),
      );

      const response = await adaptive.unary(method, input, options).response;
      expect(response).toEqual({ value: "fallback-ok" });
      expect(adaptive.activeTransport).toBe("grpc-web");

      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });

    it("propagates error when fallback also fails", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;
      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
      });
      await adaptive.init();

      // Primary fails with transport error
      const transportErr = new RpcError("primary down", "UNAVAILABLE");
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(rejectedUnaryCall(method, input, transportErr));

      // Fallback also fails
      const fallbackErr = new RpcError("fallback down", "UNAVAILABLE");
      const fallback = getGrpcWebTransport(adaptive);
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(
        rejectedUnaryCall(method, input, fallbackErr),
      );

      const err = await adaptive
        .unary(method, input, options)
        .response.catch((e: unknown) => e);
      expect((err as RpcError).message).toBe("fallback down");

      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });
  });

  describe("scheduleReconnect idempotency", () => {
    it("does not schedule multiple reconnect timers on concurrent failovers", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;
      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
        reconnectDelay: 5000,
      });
      await adaptive.init();

      const transportErr = new RpcError("down", "UNAVAILABLE");
      const fallback = getGrpcWebTransport(adaptive);

      // Two concurrent unary calls both fail with UNAVAILABLE
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(rejectedUnaryCall(method, input, transportErr));
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(
        resolvedUnaryCall(method, input, { value: "ok" }),
      );

      await Promise.all([
        adaptive.unary(method, input, options).response,
        adaptive.unary(method, input, options).response,
      ]);

      // Advance past the reconnect delay — connect should fire exactly once
      mockWtConnect.mockResolvedValue(undefined);
      await vi.advanceTimersByTimeAsync(5000);

      // Only one reconnect attempt, not two (init=1, reconnect=1 — second failover is no-op)
      expect(mockWtConnect).toHaveBeenCalledTimes(2);

      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });
  });

  describe("onTransportChange on reconnect", () => {
    it("fires 'webtransport' when reconnect restores primary", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;

      const onChange = vi.fn();
      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
        reconnectDelay: 1000,
        onTransportChange: onChange,
      });
      await adaptive.init();

      // Trigger failover
      const transportErr = new RpcError("down", "UNAVAILABLE");
      (
        mockWtTransportInstance.unary as ReturnType<typeof vi.fn>
      ).mockReturnValue(rejectedUnaryCall(method, input, transportErr));
      const fallback = getGrpcWebTransport(adaptive);
      (fallback.unary as ReturnType<typeof vi.fn>).mockReturnValue(
        resolvedUnaryCall(method, input, { value: "ok" }),
      );

      await adaptive.unary(method, input, options).response;
      expect(onChange).toHaveBeenLastCalledWith("grpc-web");

      // Reconnect
      mockWtConnect.mockResolvedValue(undefined);
      await vi.advanceTimersByTimeAsync(1000);
      expect(onChange).toHaveBeenLastCalledWith("webtransport");

      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });
  });

  describe("serverStreaming", () => {
    it("always routes to gRPC-web fallback (WebTransport does not support streaming)", async () => {
      (globalThis as Record<string, unknown>).WebTransport = MockWebTransport;
      const adaptive = new AdaptiveRpcTransport({
        grpcWebUrl: "https://grpc.sid.example.com",
        webTransportUrl: "https://wt.sid.example.com",
      });
      await adaptive.init();

      const fallback = getGrpcWebTransport(adaptive);
      const mockStream = {} as ReturnType<RpcTransport["serverStreaming"]>;
      (fallback.serverStreaming as ReturnType<typeof vi.fn>).mockReturnValue(
        mockStream,
      );

      const result = adaptive.serverStreaming(method, input, options);

      expect(fallback.serverStreaming).toHaveBeenCalledWith(
        method,
        input,
        options,
      );
      expect(result).toBe(mockStream);

      adaptive.close();
      delete (globalThis as Record<string, unknown>).WebTransport;
    });
  });
});
