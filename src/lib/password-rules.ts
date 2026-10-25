/**
 * Password rules for new passwords (signup and reset). Shared by the forms
 * (live checklist) and the server (which enforces them), so both agree.
 */

export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { id: "upper", label: "One capital letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { id: "lower", label: "One small letter (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { id: "number", label: "One number (0-9)", test: (pw) => /\d/.test(pw) },
  { id: "symbol", label: "One symbol (like ! @ # ?)", test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
];

// The passwords people try first. Blocked even when they tick every box.
const COMMON = ["password", "passw0rd", "qwerty", "12345678", "123456789", "11111111", "abc12345", "iloveyou", "welcome", "letmein", "admin123", "orbit123"];

/** Ids of the rules this password fails (empty = good). */
export function failedRules(pw: string, email?: string | null): string[] {
  const failed = PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.id);
  const lower = pw.toLowerCase();
  const name = (email ?? "").split("@")[0].toLowerCase();
  if (COMMON.some((c) => lower.includes(c)) || (name.length >= 4 && lower.includes(name))) failed.push("guessable");
  if (pw.length > 72) failed.push("too_long"); // bcrypt only uses the first 72 bytes
  return failed;
}

export function passwordProblem(pw: string, email?: string | null): string | null {
  const failed = failedRules(pw, email);
  if (!failed.length) return null;
  if (failed.includes("guessable")) return "That password is too easy to guess. Avoid common words and your email name.";
  if (failed.includes("too_long")) return "Use 72 characters or fewer.";
  return "Your password needs: " + PASSWORD_RULES.filter((r) => failed.includes(r.id)).map((r) => r.label.toLowerCase()).join(", ") + ".";
}
