export const TEXT_LIMITS = {
  username: 30,
  email: 254,
  displayName: 100,
  title: 200,
  body: 5000,
  comment: 2000,
  flagReason: 1000,
  category: 100,
  rewardPool: 100,
  tag: 50,
  maxTags: 10,
} as const;

/**
 * Returns an error message for the first field that is not a string or exceeds its limit, or null if all are valid.
 * Missing (undefined/null) values are skipped; required checks stay in the route.
 */
export function checkTextLimits(fields: Record<string, [value: unknown, max: number]>): string | null {
  for (const [label, [value, max]] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") return `${label} must be text`;
    if (value.length > max) return `${label} must be at most ${max} characters`;
  }
  return null;
}

/** Validates a tag list: at most TEXT_LIMITS.maxTags strings of at most TEXT_LIMITS.tag characters. */
export function checkTagList(tags: unknown): string | null {
  if (tags === undefined || tags === null) return null;
  if (!Array.isArray(tags)) return "Tags must be a list";
  if (tags.length > TEXT_LIMITS.maxTags) return `At most ${TEXT_LIMITS.maxTags} tags are allowed`;
  for (const tag of tags) {
    if (typeof tag !== "string") return "Tags must be text";
    if (tag.length > TEXT_LIMITS.tag) return `Tags must be at most ${TEXT_LIMITS.tag} characters`;
  }
  return null;
}

export function lengthError(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
