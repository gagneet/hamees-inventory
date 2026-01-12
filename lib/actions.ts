'use server'

import { signOut as signOutFromAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'

/**
 * Server action that signs out the current user.
 *
 * On success, it delegates to the underlying auth library's `signOutFromAuth`
 * function, which redirects the user to the root path (`/`) using the
 * `redirectTo` option.
 *
 * If an error occurs during sign-out, the error is logged to the server
 * console and the user is redirected to the root path with an error query
 * parameter (`/?error=signout`) to indicate that sign-out failed.
 *
 * This function is intended to be called from client components and manages
 * navigation via redirects instead of propagating errors to the caller.
 *
 * @returns {Promise<void>} A promise that resolves after initiating the
 * sign-out and any resulting redirect.
 */
export async function signOut() {
  try {
    await signOutFromAuth({ redirectTo: '/' })
  } catch (error) {
    console.error('Failed to sign out:', error)
    redirect('/?error=signout')
  }
}
