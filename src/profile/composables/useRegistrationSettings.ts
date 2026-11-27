/**
 * What an ordinary registration admits, as the installation publishes it for
 * its pages: the principal types a new account may register with and the
 * shortest username among them. The registration form shows a field only for
 * what is admitted; the installation enforces the same whatever the page
 * shows.
 *
 * The settings have no assumed value: a page that got no answer shows that,
 * never a form with values of its own.
 */
import { PublicUiSettingsServiceClient } from "@structured-id/proto/sid/v1/ui/public_settings.client";
import { PrincipalType } from "@structured-id/proto/sid/v1/identity/identity";
import { getTransport } from "../../index";
import type { AcceptedPrincipalType } from "../../quasar/principalInputTexts";

/** What an ordinary registration admits. */
export interface RegistrationSettings {
  /** The types a new account may register with; none where nobody may. */
  principalTypes: AcceptedPrincipalType[];
  /** The shortest username admitted; none where no username registers. */
  usernameMinLength: number | undefined;
}

/** The name of a published type, for the types a page has a field for. */
function fieldOf(type: PrincipalType): AcceptedPrincipalType | undefined {
  switch (type) {
    case PrincipalType.EMAIL:
      return "email";
    case PrincipalType.PHONE:
      return "phone";
    case PrincipalType.USERNAME:
      return "username";
    default:
      // A type newer than this page: it has no field for it.
      return undefined;
  }
}

/** The registration settings the installation publishes. */
export async function readRegistrationSettings(): Promise<RegistrationSettings> {
  const client = new PublicUiSettingsServiceClient(getTransport());
  const { response } = await client.getPublicUiSettings({});
  const principalTypes: AcceptedPrincipalType[] = [];
  for (const type of response.registrationPrincipalTypes) {
    const field = fieldOf(type);
    if (field && !principalTypes.includes(field)) principalTypes.push(field);
  }
  return {
    principalTypes,
    usernameMinLength: principalTypes.includes("username")
      ? response.registrationUsernameMinLength
      : undefined,
  };
}
