// Input rules shared by the forms. They match the CHECK constraints in the database.

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/

/** Lowercases and trims, and strips a leading "@" people often type. */
export function normalizeUsername(input: string) {
  return input.trim().replace(/^@/, '').toLowerCase()
}

/** Returns an error message, or null when the username is valid. */
export function usernameError(username: string): string | null {
  if (username.length < 3) return 'At least 3 characters.'
  if (username.length > 20) return 'At most 20 characters.'
  if (!USERNAME_PATTERN.test(username)) return 'Use only letters, numbers and underscores.'
  return null
}

export function displayNameError(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'Enter a display name.'
  if (trimmed.length > 40) return 'At most 40 characters.'
  return null
}

export function looksLikeEmail(input: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.trim())
}

export const MIN_PASSWORD_LENGTH = 8
