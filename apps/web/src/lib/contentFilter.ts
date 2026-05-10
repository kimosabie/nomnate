// Minimal content filter for pre-pilot.
// Strips HTML/control characters and blocks obvious profanity.
// Extend BLOCKED_WORDS with a fuller list before public launch.

const BLOCKED_WORDS = [
  "fuck", "shit", "cunt", "nigger", "nigga", "faggot", "fag",
  "kaffir", "chink", "spic", "bitch", "asshole", "motherfucker",
  "whore", "slut", "bastard", "dick", "cock", "pussy",
];

/** Strip HTML tags, null bytes, and leading/trailing whitespace. */
export function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")      // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip control chars
    .trim();
}

/** Returns true if the input contains a blocked word. */
export function containsProfanity(input: string): boolean {
  const normalised = input.toLowerCase().replace(/[^a-z]/g, "");
  return BLOCKED_WORDS.some((w) => normalised.includes(w));
}

/**
 * Sanitize and validate a single user-supplied text field.
 * Returns the cleaned value, or an error string if it fails.
 */
export function filterText(
  input: string,
  maxLength: number
): { value: string; error: string | null } {
  const value = sanitize(input);
  if (value.length > maxLength) {
    return { value: "", error: `Must be under ${maxLength} characters` };
  }
  if (containsProfanity(value)) {
    return { value: "", error: "Content not allowed" };
  }
  return { value, error: null };
}
