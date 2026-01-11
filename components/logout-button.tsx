'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const handleLogout = async () => {
    await signOut({
      callbackUrl: '/',
      redirect: true,
    })
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      Logout
    </Button>
  )
}
