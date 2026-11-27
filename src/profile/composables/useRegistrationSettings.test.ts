import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrincipalType } from "@structured-id/proto/sid/v1/identity/identity";

// The installation's answer, as the generated client returns it.
const service = vi.hoisted(() => ({
  answer: null as null | {
    registrationOpen: boolean;
    registrationPrincipalTypes: number[];
    registrationUsernameMinLength: number;
  },
}));

vi.mock("@structured-id/proto/sid/v1/ui/public_settings.client", () => ({
  PublicUiSettingsServiceClient: class {
    async getPublicUiSettings() {
      if (service.answer === null) throw new Error("UNAVAILABLE");
      return { response: service.answer };
    }
  },
}));
vi.mock("../../index", () => ({ getTransport: () => ({}) }));

import { readRegistrationSettings } from "./useRegistrationSettings";

describe("readRegistrationSettings", () => {
  beforeEach(() => {
    service.answer = null;
  });

  // What is tested: the form gets the types and the username minimum the
  // installation publishes, not values of its own.
  // Bug prevented: a self-hosted installation's three-character name stopped
  // by a page that assumed the global minimum of six.
  it("reads the types and the username minimum the installation publishes", async () => {
    service.answer = {
      registrationOpen: true,
      registrationPrincipalTypes: [
        PrincipalType.EMAIL,
        PrincipalType.PHONE,
        PrincipalType.USERNAME,
      ],
      registrationUsernameMinLength: 3,
    };
    expect(await readRegistrationSettings()).toEqual({
      open: true,
      principalTypes: ["email", "phone", "username"],
      usernameMinLength: 3,
    });
  });

  // What is tested: whether a visitor may start is its own published choice,
  // read beside the types and the minimum and not derived from them.
  // Bug prevented: a form shown because types are published, where the
  // installation takes no registration from a visitor.
  it("reads whether a visitor may start from its own field", async () => {
    service.answer = {
      registrationOpen: false,
      registrationPrincipalTypes: [PrincipalType.EMAIL, PrincipalType.USERNAME],
      registrationUsernameMinLength: 3,
    };
    expect(await readRegistrationSettings()).toEqual({
      open: false,
      principalTypes: ["email", "username"],
      usernameMinLength: 3,
    });
  });

  // What is tested: where registration takes no username, no minimum is
  // stated for one (the installation publishes zero then).
  // Bug prevented: a domain-restricted registration offering a username the
  // installation always refuses.
  it("states no username minimum where no username registers", async () => {
    service.answer = {
      registrationOpen: true,
      registrationPrincipalTypes: [PrincipalType.EMAIL],
      registrationUsernameMinLength: 0,
    };
    expect(await readRegistrationSettings()).toEqual({
      open: true,
      principalTypes: ["email"],
      usernameMinLength: undefined,
    });
  });

  // What is tested: a type this page has no field for is left out, and a
  // repeated one is taken once.
  it("ignores a type it has no field for", async () => {
    service.answer = {
      registrationOpen: true,
      registrationPrincipalTypes: [
        PrincipalType.EMAIL,
        99,
        PrincipalType.EMAIL,
      ],
      registrationUsernameMinLength: 0,
    };
    expect((await readRegistrationSettings()).principalTypes).toEqual([
      "email",
    ]);
  });

  // What is tested: no answer is an error for the page to show, never
  // settings of the page's own.
  it("has no settings without an answer", async () => {
    await expect(readRegistrationSettings()).rejects.toThrow("UNAVAILABLE");
  });
});
