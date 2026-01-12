'use client'

import { signOut } from '@/lib/actions'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button variant="outline" type="submit">
        Logout
      </Button>
    </form>
  )
}
