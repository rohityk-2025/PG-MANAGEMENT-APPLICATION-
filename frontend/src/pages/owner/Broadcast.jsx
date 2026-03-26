import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Plus, Trash2, AlertCircle, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { Btn, Modal, Input, Card, Empty, Skel, SectionHeader } from '../../components/ui'
import { useProperty } from '../../hooks/useProperty'
import { timeAgo } from '../../lib/utils'
import toast from 'react-hot-toast'

const EMPTY = { title: '', message: '', is_important: false, audience_type: 'all' }

export default function BroadcastPage() {
  const { properties, selectedId, select } = useProperty()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState(EMPTY)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ['broadcasts', selectedId],
    queryFn:  () => api.get(`/api/broadcasts?property_id=${selectedId}`),
    enabled:  !!selectedId,
  })

  const create = useMutation({
    mutationFn: (d) => api.post('/api/broadcasts', { ...d, property_id: selectedId }),
    onSuccess: () => { qc.invalidateQueries(['broadcasts']); setModal(false); setForm(EMPTY); toast.success('Broadcast sent') },
    onError: (e) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: (id) => api.delete(`/api/broadcasts/${id}`),
    onSuccess: () => { qc.invalidateQueries(['broadcasts']); toast.success('Deleted') },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Broadcasts"
        right={
          <div className="flex gap-2">
            <select value={selectedId} onChange={e => select(e.target.value)} className="h-9 pl-3 pr-8 text-xs border border-[#E8E9F2] rounded-xl outline-none bg-white">
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Btn size="sm" onClick={() => { setForm(EMPTY); setModal(true) }}>
              <Plus className="w-3.5 h-3.5" /> New Broadcast
            </Btn>
          </div>
        }
      />

      {isLoading ? <div className="space-y-2">{[1,2].map(i => <Skel key={i} className="h-20" />)}</div>
      : broadcasts.length === 0 ? <Empty icon={Megaphone} title="No broadcasts yet" action={{ label: 'Send Broadcast', onClick: () => setModal(true) }} />
      : (
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-[#0D0D12]">{b.title}</p>
                    {b.is_important && <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">Important</span>}
                  </div>
                  <p className="text-sm text-[#6B7280] mt-1">{b.message}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-[#9CA3AF]">
                    <Clock className="w-3 h-3" />
                    <span>{timeAgo(b.created_at)}</span>
                    <span>· To: {b.audience_type}</span>
                    {b.sent_by_user?.full_name && <span>· By {b.sent_by_user.full_name}</span>}
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm('Delete this broadcast?')) del.mutate(b.id) }}
                  className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="New Broadcast" onClose={() => setModal(false)}>
          <div className="space-y-3">
            <Input label="Title *" value={form.title} onChange={set('title')} placeholder="Notice for all tenants" />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Message *</label>
              <textarea
                value={form.message} onChange={set('message')} rows={4} placeholder="Write your message here..."
                className="w-full px-3.5 py-2.5 border border-[#E8E9F2] hover:border-[#C4C8E8] focus:border-brand-500 rounded-xl text-sm outline-none resize-none transition-colors focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_important}
                  onChange={e => setForm(f => ({ ...f, is_important: e.target.checked }))}
                  className="w-4 h-4 rounded accent-brand-500"
                />
                <span className="text-sm text-[#374151]">Mark as Important</span>
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <Btn variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Btn>
              <Btn className="flex-1" onClick={() => create.mutate(form)} loading={create.isPending} disabled={!form.title || !form.message}>
                Send Broadcast
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
