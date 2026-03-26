import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Receipt, Plus, Trash2, IndianRupee } from 'lucide-react'
import { api } from '../../lib/api'
import { Btn, Modal, Input, Card, Empty, Skel, SectionHeader } from '../../components/ui'
import { useProperty } from '../../hooks/useProperty'
import { formatRupees, formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'

const CATEGORIES = ['plumbing','electrical','cleaning','furniture','food','water','maintenance','salary','other']
const EMPTY = { title: '', category: 'other', amount: '', date: '', notes: '', description: '' }

const CAT_COLORS = {
  plumbing: 'bg-blue-50 text-blue-700', electrical: 'bg-yellow-50 text-yellow-700',
  cleaning: 'bg-teal-50 text-teal-700', furniture: 'bg-purple-50 text-purple-700',
  food: 'bg-orange-50 text-orange-700', water: 'bg-cyan-50 text-cyan-700',
  maintenance: 'bg-slate-50 text-slate-700', salary: 'bg-pink-50 text-pink-700',
  other: 'bg-gray-50 text-gray-700',
}

export default function Expenses() {
  const { properties, selectedId, select } = useProperty()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState(EMPTY)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', selectedId],
    queryFn:  () => api.get(`/api/expenses?property_id=${selectedId}`),
    enabled:  !!selectedId,
  })

  const create = useMutation({
    mutationFn: (d) => api.post('/api/expenses', { ...d, property_id: selectedId }),
    onSuccess: () => { qc.invalidateQueries(['expenses']); setModal(false); setForm(EMPTY); toast.success('Expense recorded') },
    onError: (e) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: (id) => api.delete(`/api/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries(['expenses']); toast.success('Deleted') },
    onError: (e) => toast.error(e.message),
  })

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date); const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, e) => s + Number(e.amount || 0), 0)

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Expenses"
        right={
          <div className="flex gap-2">
            <select value={selectedId} onChange={e => select(e.target.value)} className="h-9 pl-3 pr-8 text-xs border border-[#E8E9F2] rounded-xl outline-none bg-white">
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Btn size="sm" onClick={() => { setForm(EMPTY); setModal(true) }}>
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </Btn>
          </div>
        }
      />

      {/* Summary */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs text-[#9CA3AF] font-medium mb-1">This Month</p>
            <p className="font-display text-xl font-bold text-[#0D0D12]">{formatRupees(thisMonth)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-[#9CA3AF] font-medium mb-1">Total Shown</p>
            <p className="font-display text-xl font-bold text-[#0D0D12]">{formatRupees(total)}</p>
          </Card>
        </div>
      )}

      {isLoading ? <div className="space-y-2">{[1,2,3].map(i => <Skel key={i} className="h-16" />)}</div>
      : expenses.length === 0 ? <Empty icon={Receipt} title="No expenses yet" action={{ label: 'Add Expense', onClick: () => setModal(true) }} />
      : (
        <div className="space-y-2">
          {expenses.map(e => (
            <Card key={e.id} className="p-4 flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-xl font-semibold capitalize flex-shrink-0 ${CAT_COLORS[e.category] || CAT_COLORS.other}`}>
                {e.category}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[#0D0D12]">{e.title}</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">{formatDate(e.date)}{e.notes ? ` · ${e.notes}` : ''}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <p className="font-bold text-[#0D0D12]">{formatRupees(e.amount)}</p>
                <button onClick={() => { if (confirm('Delete expense?')) del.mutate(e.id) }} className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Add Expense" onClose={() => setModal(false)}>
          <div className="space-y-3">
            <Input label="Title *" value={form.title} onChange={set('title')} placeholder="Plumber visit" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Category</label>
                <select value={form.category} onChange={set('category')} className="w-full h-10 border border-[#E8E9F2] rounded-xl px-3.5 text-sm outline-none focus:border-brand-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                </select>
              </div>
              <Input label="Amount (Rs.) *" type="number" value={form.amount} onChange={set('amount')} placeholder="500" />
            </div>
            <Input label="Date" type="date" value={form.date} onChange={set('date')} />
            <Input label="Notes" value={form.notes} onChange={set('notes')} placeholder="Optional notes" />
            <div className="flex gap-2 pt-2">
              <Btn variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Btn>
              <Btn className="flex-1" onClick={() => create.mutate(form)} loading={create.isPending} disabled={!form.title || !form.amount}>
                Add Expense
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
