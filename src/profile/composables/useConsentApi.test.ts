import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthorizationOperationId } from "@structured-id/ids";
import {
  AuthorizationStep,
  ClaimSharing,
  ConsentDecision,
  getConsent,
  getFlowState,
  submitConsent,
  type ConsentDetails,
} from "./useConsentApi";

const mockGetConsent = vi.fn();
const mockSubmitConsent = vi.fn();
const mockGetFlowState = vi.fn();

vi.mock("../../index", () => ({
  getTransport: vi.fn(),
}));

vi.mock("@structured-id/proto/sid/v1/authn/auth_flow.client", () => ({
  // Called with `new`: a constructor mock must be a `function`, not an arrow.
  AuthFlowServiceClient: vi.fn().mockImplementation(function () {
    return {
      getConsent: mockGetConsent,
      submitConsent: mockSubmitConsent,
      getFlowState: mockGetFlowState,
    };
  }),
}));

const REFERENCE = "019290a4-7b3c-7d2e-8f00-112233445566";
const WIRE = AuthorizationOperationId.parse(REFERENCE).toWire();

function review(): ConsentDetails {
  return {
    operationId: WIRE,
    revision: 4n,
    csrfToken: new Uint8Array([1, 2, 3]),
    issuer: "https://sid.example.com",
    clientId: "app",
    clientName: "App",
    resource: "https://api.sid.example.com",
    scopes: ["openid", "email"],
    claims: [],
    identityDisplayName: "Alice",
  };
}

describe("useConsentApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The page reads the operation it was sent to by its reference only; the
  // session decides whether it may.
  it("reads the review of the referenced operation", async () => {
    mockGetConsent.mockResolvedValue({ response: review() });

    const got = await getConsent(REFERENCE);

    expect(mockGetConsent).toHaveBeenCalledWith({ operationId: WIRE });
    expect(got.revision).toBe(4n);
  });

  // A reference that is not an operation id is refused before any call.
  it("refuses a malformed reference without a call", async () => {
    await expect(getConsent("not-an-id")).rejects.toThrow();
    expect(mockGetConsent).not.toHaveBeenCalled();
  });

  // An approval carries the reviewed revision, its CSRF value and the
  // choices; a denial carries no choices.
  it("submits the decision on the reviewed revision", async () => {
    mockSubmitConsent.mockResolvedValue({
      response: {
        operationId: WIRE,
        step: AuthorizationStep.APPROVED,
        continuationUri: "https://sid.example.com/oauth2/authorize?operation=x",
      },
    });
    const choices = [{ name: "email", sharing: ClaimSharing.STATIC }];

    const state = await submitConsent(
      review(),
      ConsentDecision.APPROVE,
      choices,
    );

    expect(mockSubmitConsent).toHaveBeenCalledWith({
      operationId: WIRE,
      revision: 4n,
      csrfToken: new Uint8Array([1, 2, 3]),
      decision: ConsentDecision.APPROVE,
      choices,
    });
    expect(state.step).toBe(AuthorizationStep.APPROVED);

    await submitConsent(review(), ConsentDecision.DENY, choices);
    expect(mockSubmitConsent).toHaveBeenLastCalledWith(
      expect.objectContaining({ decision: ConsentDecision.DENY, choices: [] }),
    );
  });

  it("reads the operation state after a reload", async () => {
    mockGetFlowState.mockResolvedValue({
      response: { operationId: WIRE, step: AuthorizationStep.AWAITING_CONSENT },
    });

    const state = await getFlowState(REFERENCE);

    expect(mockGetFlowState).toHaveBeenCalledWith({ operationId: WIRE });
    expect(state.step).toBe(AuthorizationStep.AWAITING_CONSENT);
  });

  it("propagates gRPC errors", async () => {
    mockGetConsent.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(getConsent(REFERENCE)).rejects.toThrow("NOT_FOUND");
  });
});
