/** The name fields an administrator edits on a profile. */
export interface NameFields {
  givenName: string;
  familyName: string;
  middleName: string;
}

/**
 * The update for the names the form changed: an absent field keeps its
 * stored value, so a field cleared in the form is sent as an empty value,
 * and an unchanged one is not sent.
 */
export function nameUpdate(
  stored: Partial<Record<keyof NameFields, string | undefined>>,
  form: NameFields,
): Partial<NameFields> {
  const update: Partial<NameFields> = {};
  for (const key of ["givenName", "familyName", "middleName"] as const) {
    if (form[key] !== (stored[key] ?? "")) update[key] = form[key];
  }
  return update;
}
