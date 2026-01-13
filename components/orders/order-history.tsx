'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, User as UserIcon } from 'lucide-react'

interface HistoryEntry {
  id: string
  changeType: string
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  description: string
  createdAt: Date
  user: {
    name: string
    email: string
  }
}

interface OrderHistoryProps {
  history: HistoryEntry[]
}

const changeTypeColors: Record<string, { bg: string; text: string }> = {
  STATUS_UPDATE: { bg: 'bg-blue-50', text: 'text-blue-700' },
  ORDER_EDIT: { bg: 'bg-purple-50', text: 'text-purple-700' },
  ITEM_ADDED: { bg: 'bg-green-50', text: 'text-green-700' },
  ITEM_REMOVED: { bg: 'bg-red-50', text: 'text-red-700' },
}

export function OrderHistory({ history }: OrderHistoryProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Order History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">No history records yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Order History ({history.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry) => {
            const colorStyle = changeTypeColors[entry.changeType] || {
              bg: 'bg-slate-50',
              text: 'text-slate-700',
            }

            return (
              <div
                key={entry.id}
                className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`${colorStyle.bg} ${colorStyle.text}`}>
                      {entry.changeType.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                        dateStyle: 'medium',
                      })}{' '}
                      {new Date(entry.createdAt).toLocaleTimeString('en-IN', {
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-900 mb-2">{entry.description}</p>

                {entry.fieldName && (entry.oldValue || entry.newValue) && (
                  <div className="flex items-center gap-4 text-xs text-slate-600 mt-2 pt-2 border-t border-slate-100">
                    {entry.oldValue && (
                      <div>
                        <span className="text-slate-500">From: </span>
                        <span className="font-mono bg-red-50 text-red-700 px-2 py-0.5 rounded">
                          {entry.oldValue}
                        </span>
                      </div>
                    )}
                    {entry.newValue && (
                      <div>
                        <span className="text-slate-500">To: </span>
                        <span className="font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded">
                          {entry.newValue}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                  <UserIcon className="h-3 w-3" />
                  <span>
                    {entry.user.name} ({entry.user.email})
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
