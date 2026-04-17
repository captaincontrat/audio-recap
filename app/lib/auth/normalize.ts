const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function normalizeEmailOrThrow(email: string): string {
  const normalized = normalizeEmail(email);

  if (!isValidEmail(normalized)) {
    throw new Error(`Invalid email address: ${email}`);
  }

  return normalized;
}
