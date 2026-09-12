'use client'

/**
 * @featuretrace Admin → Users
 * @description Create, edit, activate/deactivate user accounts (manage_users).
 *   Server-side guards in lib/user-admin.ts prevent self-demotion/deactivation and
 *   removing the last active Administrator or Owner; changes are audit-logged.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Edit2, Shield, ShieldCheck } from 'lucide-react'
import { ALL_ROLES, getRoleName, roleDescriptions, type UserRole } from '@/lib/permissions'

type User = {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: string
  updatedAt: string
}

type FormState = { name: string; email: string; password: string; role: UserRole }

const EMPTY_FORM: FormState = { name: '', email: '', password: '', role: 'VIEWER' }
const MIN_PASSWORD = 8

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json()
    const detail = Array.isArray(data.details) && data.details[0]?.message
    return detail || data.error || fallback
  } catch {
    return fallback
  }
}

function RoleSelect({ id, value, onChange }: { id: string; value: UserRole; onChange: (role: UserRole) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as UserRole)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALL_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {getRoleName(role)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function UsersManager() {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM)

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      } else {
        toast.error(await errorMessage(response, 'Failed to load users'))
      }
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  const handleAddUser = async () => {
    if (formData.password.length < MIN_PASSWORD) {
      toast.error(`Password must be at least ${MIN_PASSWORD} characters`)
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (response.ok) {
        toast.success('User created')
        setShowAddDialog(false)
        setFormData(EMPTY_FORM)
        void fetchUsers()
      } else {
        toast.error(await errorMessage(response, 'Failed to create user'))
      }
    } catch {
      toast.error('Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser) return
    if (formData.password && formData.password.length < MIN_PASSWORD) {
      toast.error(`Password must be at least ${MIN_PASSWORD} characters`)
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          ...(formData.role !== selectedUser.role && { role: formData.role }),
          ...(formData.password && { password: formData.password }),
        }),
      })
      if (response.ok) {
        toast.success('User updated')
        setSelectedUser(null)
        setFormData(EMPTY_FORM)
        void fetchUsers()
      } else {
        toast.error(await errorMessage(response, 'Failed to update user'))
      }
    } catch {
      toast.error('Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active }),
      })
      if (response.ok) {
        toast.success(user.active ? `${user.name} deactivated` : `${user.name} activated`)
        void fetchUsers()
      } else {
        toast.error(await errorMessage(response, 'Failed to change status'))
      }
    } catch {
      toast.error('Failed to change status')
    }
  }

  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setFormData({ name: user.name, email: user.email, password: '', role: user.role })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>Manage user accounts and their access levels</CardDescription>
          </div>
          <Button onClick={() => { setFormData(EMPTY_FORM); setShowAddDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isSelf = user.id === currentUserId
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name}
                          {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getRoleName(user.role)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.active ? 'default' : 'secondary'}>
                            {user.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(user)} aria-label={`Edit ${user.name}`}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={user.active ? 'destructive' : 'default'}
                              size="sm"
                              disabled={isSelf}
                              title={isSelf ? 'You cannot deactivate your own account' : undefined}
                              onClick={() => handleToggleActive(user)}
                            >
                              {user.active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Permissions
          </CardTitle>
          <CardDescription>What each role can do</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {ALL_ROLES.map((role) => (
              <div key={role} className="flex items-start gap-3 p-3 border rounded-lg">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">{getRoleName(role)}</div>
                  <div className="text-sm text-muted-foreground">{roleDescriptions[role]}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account with a specific role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="off"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={`Minimum ${MIN_PASSWORD} characters`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <RoleSelect id="role" value={formData.role} onChange={(role) => setFormData({ ...formData, role })} />
              <p className="text-xs text-slate-500">{roleDescriptions[formData.role]}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={saving}>{saving ? 'Creating…' : 'Create User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={selectedUser !== null} onOpenChange={(open) => { if (!open) setSelectedUser(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New password (leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={`Minimum ${MIN_PASSWORD} characters`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              {selectedUser?.id === currentUserId ? (
                <p className="text-sm text-slate-500">You cannot change your own role.</p>
              ) : (
                <>
                  <RoleSelect id="edit-role" value={formData.role} onChange={(role) => setFormData({ ...formData, role })} />
                  <p className="text-xs text-slate-500">{roleDescriptions[formData.role]}</p>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
