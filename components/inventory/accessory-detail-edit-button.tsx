'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AccessoryEditForm } from './accessory-edit-form'
import { Edit } from 'lucide-react'

interface AccessoryDetailEditButtonProps {
  accessoryId: string
  canEdit: boolean
}

export function AccessoryDetailEditButton({ accessoryId, canEdit }: AccessoryDetailEditButtonProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  if (!canEdit) {
    return null
  }

  return (
    <>
      <Button
        onClick={() => setEditOpen(true)}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Edit className="h-4 w-4" />
        Edit Details
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Accessory Inventory</DialogTitle>
          </DialogHeader>
          <AccessoryEditForm
            accessoryId={accessoryId}
            onSuccess={() => {
              setEditOpen(false)
              router.refresh()
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
