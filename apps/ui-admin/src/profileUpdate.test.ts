import { describe, expect, it } from "vitest";
import { nameUpdate } from "./profileUpdate";

describe("nameUpdate", () => {
  const stored = { givenName: "Ada", familyName: "Lovelace", middleName: "K" };

  // Regression: a cleared field was sent as absent, which the server reads
  // as "unchanged", so the old name came back after a successful save.
  it("sends a cleared field as an empty value", () => {
    expect(
      nameUpdate(stored, { givenName: "Ada", familyName: "", middleName: "K" }),
    ).toEqual({ familyName: "" });
  });

  // Unchanged fields stay out of the update; changed ones are sent.
  it("sends only what changed", () => {
    expect(
      nameUpdate(stored, {
        givenName: "Augusta",
        familyName: "Lovelace",
        middleName: "K",
      }),
    ).toEqual({ givenName: "Augusta" });
  });

  // A field the profile never had and the form leaves empty is no change.
  it("treats an absent stored name as empty", () => {
    expect(
      nameUpdate({}, { givenName: "", familyName: "", middleName: "" }),
    ).toEqual({});
  });
});
