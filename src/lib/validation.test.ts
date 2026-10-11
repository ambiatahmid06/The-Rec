import { describe, expect, it } from 'vitest'
import { displayNameError, looksLikeEmail, normalizeUsername, usernameError } from './validation'

describe('usernames', () => {
  it('normalizes what people type', () => {
    expect(normalizeUsername('  @Splash_Bro ')).toBe('splash_bro')
  })

  it('accepts 3-20 lowercase letters, numbers and underscores', () => {
    expect(usernameError('ab')).toMatch(/at least 3/i)
    expect(usernameError('a'.repeat(21))).toMatch(/at most 20/i)
    expect(usernameError('no spaces')).toMatch(/only letters/i)
    expect(usernameError('no-dashes')).toMatch(/only letters/i)
    expect(usernameError('kd_35')).toBeNull()
  })
})

describe('display names', () => {
  it('requires 1-40 characters after trimming', () => {
    expect(displayNameError('   ')).not.toBeNull()
    expect(displayNameError('x'.repeat(41))).not.toBeNull()
    expect(displayNameError(' Steph ')).toBeNull()
  })
})

describe('invite input', () => {
  it('tells emails apart from usernames', () => {
    expect(looksLikeEmail('friend@mail.com')).toBe(true)
    expect(looksLikeEmail('@friend')).toBe(false)
    expect(looksLikeEmail('friend')).toBe(false)
  })
})
