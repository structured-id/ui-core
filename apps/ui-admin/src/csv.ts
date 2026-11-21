/**
 * One CSV field, quoted, that a spreadsheet shows as the text it is. A value
 * starting with `=`, `+`, `-`, `@`, a tab or a carriage return would be read
 * as a formula (user-chosen names reach exports), so it is prefixed with `'`
 * (OWASP CSV Injection); quotes are doubled (RFC 4180 §2.7).
 */
export function csvField(value: string): string {
  const literal = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${literal.replace(/"/g, '""')}"`;
}
