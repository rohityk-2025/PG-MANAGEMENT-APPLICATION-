import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, AlertTriangle, Zap, CheckCircle2, Clock, X } from 'lucide-react'
import { api } from '../../lib/api'
import { Card, Btn, Input, Select, Textarea, Badge, Empty, Skel, SectionHeader, Modal } from '../../components/ui'
import { timeAgo } from '../../lib/utils'
import toast from 'react-hot-toast'

const CATEGORIES = ['wifi','food','plumbing','electrical','cleanliness','furniture','security','noise','other']

// Quick-fill title suggestions per category to help tenants submit faster
const SUGGESTIONS = {
  wifi:        ['Internet is very slow', 'No connectivity in my room', 'WiFi password not working'],
  food:        ['Food quality is poor', 'Food not served on time', 'Menu needs improvement'],
  plumbing:    ['Water tap is leaking', 'Bathroom drainage blocked', 'No hot water available'],
  electrical:  ['Light bulb not working', 'Power socket broken', 'Fan is very noisy'],
  cleanliness: ['Room not cleaned today', 'Common area is dirty', 'Dustbin not emptied'],
  furniture:   ['Chair is broken', 'Cupboard door not closing', 'Mattress needs replacement'],
  security:    ['Main gate lock broken', 'CCTV not working'],
  noise:       ['Too much noise at night', 'Neighbour playing loud music'],
  other:       [],
}

const URGENCY_CONFIG = [
  { value: 'urgent',   label: 'Urgent',       sub: 'Needs immediate attention', icon: Zap,           ring: 'border-red-400    bg-red-50'   },
  { value: 'moderate', label: 'Moderate',      sub: 'Should be addressed soon',  icon: AlertTriangle, ring: 'border-amber-400  bg-amber-50' },
  { value: 'low',      label: 'Low Priority',  sub: 'When convenient',           icon: CheckCircle2,  ring: 'border-green-400  bg-green-50' },
]

const STATUS_COLORS = {
  open:          'bg-orange-50 text-orange-700 border border-orange-200',
  under_process: 'bg-blue-50 text-blue-700 border border-blue-200',
  assigned:      'bg-purple-50 text-purple-700 border border-purple-200',
  resolved:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
  closed:        'bg-slate-100 text-slate-500 border border-slate-200',
}

const EMPTY_FORM = { category: 'other', title: '', description: '', urgency: 'moderate' }

export default function TenantComplaints() {
  const qc = useQueryClient()
  const [filter, setFilter]   = useState('all')
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY_FORM)
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }))

  // Fetch all complaints for this tenant
  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['tenant-complaints'],
    queryFn:  () => api.get('/api/complaints'),
  })

  // Filter by selected tab
  const filtered = complaints.filter(c => {
    if (filter === 'all')      return true
    if (filter === 'open')     return ['open', 'under_process', 'assigned'].includes(c.status)
    if (filter === 'resolved') return ['resolved', 'closed'].includes(c.status)
    return true
  })

  const submit = useMutation({
    mutationFn: () => api.post('/api/complaints', form),
    onSuccess: () => {
      toast.success('Complaint submitted successfully')
      setModal(false)
      setForm(EMPTY_FORM)
      qc.invalidateQueries(['tenant-complaints'])
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="My Complaints" />
        <Btn size="sm" onClick={() => { setForm(EMPTY_FORM); setModal(true) }}>
          <Plus className="w-3.5 h-3.5" /> New
        </Btn>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all',      label: 'All' },
          { key: 'open',     label: 'Open' },
          { key: 'resolved', label: 'Resolved' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
              filter === f.key
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-[#E8E9F2] text-[#6B7280] hover:border-[#C4C8E8]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Complaints list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skel key={i} className="h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Empty
          icon={AlertTriangle}
          title="No complaints found"
          body="Tap the New button above to raise an issue."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-semibold text-sm text-[#0D0D12] flex-1">{c.title}</p>
                <span className={`badge flex-shrink-0 ${STATUS_COLORS[c.status] || STATUS_COLORS.open}`}>
                  {c.status?.replace(/_/g, ' ')}
                </span>
              </div>
              {c.description && (
                <p className="text-xs text-[#6B7280] line-clamp-2 mb-2">{c.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
                <span className="capitalize">{c.category?.replace(/_/g, ' ')}</span>
                <span>·</span>
                <span className={`font-medium capitalize ${c.urgency === 'urgent' ? 'text-red-500' : c.urgency === 'moderate' ? 'text-amber-500' : 'text-emerald-600'}`}>
                  {c.urgency}
                </span>
                <span>·</span>
                <span>{timeAgo(c.created_at)}</span>
              </div>
              {c.resolution_note && (
                <div className="mt-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-xs text-emerald-700"><span className="font-semibold">Resolution:</span> {c.resolution_note}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* New complaint modal */}
      {modal && (
        <Modal title="Raise a Complaint" onClose={() => setModal(false)} size="lg">
          <div className="space-y-4">

            {/* Category chips */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setForm(f => ({ ...f, category: cat, title: '' }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                      form.category === cat
                        ? 'bg-brand-500 text-white'
                        : 'bg-[#F4F5FA] text-[#6B7280] hover:bg-[#E8E9F2]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick-fill suggestions for the selected category */}
            {SUGGESTIONS[form.category]?.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide mb-2">Quick Select</label>
                <div className="space-y-1">
                  {SUGGESTIONS[form.category].map(s => (
                    <button
                      key={s}
                      onClick={() => setForm(f => ({ ...f, title: s }))}
                      className="w-full text-left text-sm px-3 py-2 rounded-xl bg-[#F4F5FA] hover:bg-[#E8E9F2] text-[#374151] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Input
              label="Title *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Describe the issue briefly"
            />

            {/* Urgency selector */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide mb-2">Urgency *</label>
              <div className="space-y-2">
                {URGENCY_CONFIG.map(u => {
                  const Icon = u.icon
                  return (
                    <button
                      key={u.value}
                      onClick={() => setForm(f => ({ ...f, urgency: u.value }))}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        form.urgency === u.value ? u.ring : 'border-[#E8E9F2] bg-white hover:border-[#C4C8E8]'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0 text-[#6B7280]" strokeWidth={1.8} />
                      <div>
                        <p className="text-sm font-semibold text-[#0D0D12]">{u.label}</p>
                        <p className="text-xs text-[#9CA3AF]">{u.sub}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <Textarea
              label="Description"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the issue in more detail (optional)"
            />

            <div className="flex gap-2 pt-1">
              <Btn variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Btn>
              <Btn
                className="flex-1"
                onClick={() => submit.mutate()}
                loading={submit.isPending}
                disabled={!form.title}
              >
                Submit Complaint
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
