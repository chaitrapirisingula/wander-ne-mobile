/**
 * Formats a feature label for UI (e.g. "Restaurants Near By" → "Restaurants Nearby").
 */
export function formatFeatureLabel(label: string): string {
  return label.replace(/\bnear\s+by\b/gi, "Nearby");
}
