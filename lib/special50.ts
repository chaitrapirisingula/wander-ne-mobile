/**
 * Firebase / JSON data may store special50 as boolean true, string "true", or 1.
 */
export function isSpecial50Site(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  }
  return false;
}
