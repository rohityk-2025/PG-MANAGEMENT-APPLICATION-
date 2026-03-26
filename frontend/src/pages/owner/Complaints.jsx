import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, CheckCircle, Clock, AlertCircle, User } from 'lucide-react'
import { api } from '../../lib/api'
import { Card, Empty, Skel, SectionHeader, Badge } from '../../components/ui'
import { Btn, Modal } from '../../components/ui'
import { useProperty } from '../../hooks/useProperty'
import { timeAgo } from '../../lib/utils'
import toast from 'react-hot-toast'

const URGENCY_STYLE = {
  urgent:   'bg-red-100 text-red-700',
  moderate: 'bg-amber-100 text-amber-700',
  low:      'bg-blue-100 text-blue-700',
}

const STATUS_OPTIONS = ['open','under_process','assigned','resolved','closed']

export default function Complaints() {
  const { properties, selectedId, select } = useProperty()
  const qc = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [note, setNote]         = useState('')

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['complaints', selectedId],
    queryFn:  () => api.get(`/api/complaints?property_id=${selectedId}`),
    enabled:  !!selectedId,
  })

  const update = useMutation({
    mutationFn: ({ id, status, resolution_note }) => api.patch(`/api/complaints/${id}`, { status, resolution_note }),
    onSuccess: () => { qc.invalidateQueries(['complaints']); setSelected(null); toast.success('Complaint updated') },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Complaints"
        right={
          <select value={selectedId} onChange={e => select(e.target.value)} className="h-9 pl-3 pr-8 text-xs border border-[#E8E9F2] rounded-xl outline-none bg-white">
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        }
      />

      {/* Status summary */}
      {complaints.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            { l: 'Open',     v: complaints.filter(c=>c.status==='open').length,     c:'bg-red-50 text-red-700' },
            { l: 'In Progress', v: complaints.filter(c=>c.status==='under_process'||c.status==='assigned').length, c:'bg-amber-50 text-amber-700' },
            { l: 'Resolved', v: complaints.filter(c=>c.status==='resolved'||c.status==='closed').length, c:'bg-emerald-50 text-emerald-700' },
          ].map(({ l, v, c }) => (
            <span key={l} className={`${c} text-xs font-semibold px-3 py-1.5 rounded-xl`}>{v} {l}</span>
          ))}
        </div>
      )}

      {isLoading ? <div className="space-y-2">{[1,2,3].map(i => <Skel key={i} className="h-20" />)}</div>
      : complaints.length === 0 ? <Empty icon={MessageSquare} title="No complaints yet" />
      : (
        <div className="space-y-2">
          {complaints.map(c => (
            <Card key={c.id} className="p-4 cursor-pointer hover:border-brand-300 transition-colors" onClick={() => { setSelected(c); setNote(c.resolution_note || '') }}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${URGENCY_STYLE[c.urgency] || 'bg-slate-100 text-slate-500'}`}>
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-[#0D0D12]">{c.title}</p>
                    <Badge status={c.status} />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold capitalize ${URGENCY_STYLE[c.urgency]}`}>{c.urgency}</span>
                  </div>
                  {c.description && <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{c.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-[#9CA3AF]">
                    {c.tenant && <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.tenant.full_name}</span>}
                    <span className="capitalize">{c.category?.replace(/_/g,' ')}</span>
                    <span>{timeAgo(c.created_at)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail/Update Modal */}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge status={selected.status} />
              <span className={`text-xs px-2 py-1 rounded-xl font-semibold capitalize ${URGENCY_STYLE[selected.urgency]}`}>{selected.urgency}</span>
              <span className="text-xs px-2 py-1 rounded-xl bg-[#F4F5FA] text-[#374151] capitalize">{selected.category?.replace(/_/g,' ')}</span>
            </div>
            {selected.description && <p className="text-sm text-[#6B7280]">{selected.description}</p>}
            {selected.tenant && (
              <div className="flex items-center gap-2 text-sm text-[#374151]">
                <User className="w-4 h-4 text-[#9CA3AF]" />
                <span>{selected.tenant.full_name}</span>
                {selected.tenant.phone && <span className="text-[#9CA3AF]">· {selected.tenant.phone}</span>}
              </div>
            )}

            {/* Photos */}
            {selected.photo_urls?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {selected.photo_urls.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-20 h-20 object-cover rounded-xl border border-[#E8E9F2]" />
                ))}
              </div>
            )}

            {/* Status update */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Update Status</label>
              <select
                value={selected.status}
                onChange={e => setSelected(s => ({ ...s, status: e.target.value }))}
                className="w-full h-10 border border-[#E8E9F2] rounded-xl px-3.5 text-sm outline-none focus:border-brand-500"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Resolution Note</label>
              <textarea
                value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Describe what was done to resolve this..."
                className="w-full px-3.5 py-2.5 border border-[#E8E9F2] rounded-xl text-sm outline-none resize-none focus:border-brand-500"
              />
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" className="flex-1" onClick={() => setSelected(null)}>Cancel</Btn>
              <Btn className="flex-1" onClick={() => update.mutate({ id: selected.id, status: selected.status, resolution_note: note })} loading={update.isPending}>
                Update Complaint
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
