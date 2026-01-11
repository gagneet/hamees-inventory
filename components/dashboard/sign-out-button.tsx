import { signOut } from '@/lib/auth'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  return (
    <form
      action={async () => {
        'use server'
        await signOut({ redirectTo: '/' })
      }}
    >
      <Button variant="outline" type="submit">
        Logout
      </Button>
    </form>
  )
}
