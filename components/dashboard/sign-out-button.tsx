import { signOut } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'

export function SignOutButton() {
  return (
    <form
      action={async () => {
        'use server'
        try {
          await signOut({ redirectTo: '/' })
        } catch (error) {
          console.error('Failed to sign out:', error)
          redirect('/?error=signout')
        }
      }}
    >
      <Button variant="outline" type="submit">
        Logout
      </Button>
    </form>
  )
}
