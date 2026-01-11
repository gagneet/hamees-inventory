'use server'

import { signOut as signOutFromAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function signOut() {
  try {
    await signOutFromAuth({ redirectTo: '/' })
  } catch (error) {
    console.error('Failed to sign out:', error)
    redirect('/?error=signout')
  }
}
