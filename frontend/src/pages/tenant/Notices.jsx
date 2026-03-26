import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Megaphone, AlertCircle, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { Card, Empty, Skel, SectionHeader } from '../../components/ui'
import { timeAgo } from '../../lib/utils'

export default function TenantNotices() {
  const qc = useQueryClient()

  // Fetch broadcasts for this tenant's property (backend filters by tenancy)
  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ['tenant-broadcasts'],
    queryFn:  () => api.get('/api/broadcasts/my'),
  })

  return (
    <div className="space-y-4">
      <SectionHeader title="Notices" subtitle="Messages from your PG manager" />

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skel key={i} className="h-20" />)}</div>
      ) : broadcasts.length === 0 ? (
        <Empty icon={Megaphone} title="No notices yet" body="Your manager hasn't sent any notices." />
      ) : (
        <div className="space-y-3">
          {broadcasts.map(b => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${b.is_important ? 'bg-red-100' : 'bg-brand-50'}`}>
                  {b.is_important
                    ? <AlertCircle className="w-4.5 h-4.5 text-red-500" />
                    : <Megaphone className="w-4.5 h-4.5 text-brand-500" />
                  }
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-sm text-[#0D0D12]">{b.title}</p>
                    {b.is_important && (
                      <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold border border-red-200">Important</span>
                    )}
                  </div>
                  <p className="text-sm text-[#6B7280]">{b.message}</p>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-[#9CA3AF]">
                    <Clock className="w-3 h-3" />
                    <span>{timeAgo(b.created_at)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
