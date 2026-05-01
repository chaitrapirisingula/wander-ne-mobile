/** Lowercase, trim, collapse whitespace — matches WanderNebraska web listing lookups. */
export function normalizeSearchable(
  input: string | null | undefined,
): string {
  if (input == null) return "";
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
