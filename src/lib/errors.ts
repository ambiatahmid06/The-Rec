// Turns Supabase/network errors into short messages for people, not developers.

interface ErrorLike {
  message?: string
  code?: string
}

export function friendlyError(error: unknown): string {
  const { message = '', code } = (error ?? {}) as ErrorLike

  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return "Can't reach the server. Check your connection and try again."
  }
  if (message.includes('Invalid login credentials')) return 'Wrong email or password.'
  if (message.includes('Email not confirmed')) {
    return 'Confirm your email first. Check your inbox for the link.'
  }
  if (message.includes('User already registered')) {
    return 'An account with that email already exists. Try signing in.'
  }
  if (message.toLowerCase().includes('rate limit')) {
    return 'Too many attempts. Wait a few minutes and try again.'
  }
  if (code === '23505') return 'That is already taken.'

  // Our database functions raise plain-English messages; show them as-is.
  return message || 'Something went wrong. Please try again.'
}
