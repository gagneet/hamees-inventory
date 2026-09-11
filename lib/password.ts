/**
 * FEATURETRACE: Password hashing
 *
 * One bcrypt cost for every stored password, so a login's response time doesn't depend on how
 * the account was created. Unknown emails are compared against a dummy hash of the same cost
 * (timing-equalised, not constant-time). Older, cheaper hashes are upgraded on the next
 * successful login.
 */

import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'

export const BCRYPT_COST = 12

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

let dummyHash: Promise<string> | null = null

/** A hash of the current cost that no real password matches; used when the email is unknown. */
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= bcrypt.hash(`unused-${Date.now()}-${Math.random()}`, BCRYPT_COST)
  return dummyHash
}

export function needsRehash(hash: string): boolean {
  try {
    return bcrypt.getRounds(hash) < BCRYPT_COST
  } catch {
    return false
  }
}

/**
 * Short fingerprint of the stored hash, kept in the session token. When the password changes the
 * fingerprint no longer matches and existing sessions end at their next refresh.
 */
export function passwordFingerprint(hash: string): string {
  return createHash('sha256').update(hash).digest('base64url').slice(0, 16)
}
