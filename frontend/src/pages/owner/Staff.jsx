import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCog, Plus, UserX, Mail, Phone, Shield } from 'lucide-react'
import { api } from '../../lib/api'
import { Btn, Modal, Input, Card, Empty, Skel, SectionHeader, Avatar, Badge } from '../../components/ui'
import toast from 'react-hot-toast'

const EMPTY = { full_name: '', email: '', password: '', phone: '', userRole: 'manager', staff_role_label: '' }

export default function Staff() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState(EMPTY)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn:  () => api.get('/api/staff'),
  })

  const create = useMutation({
    mutationFn: (d) => api.post('/api/auth/create-staff', d),
    onSuccess: () => { qc.invalidateQueries(['staff']); setModal(false); setForm(EMPTY); toast.success('Staff account created') },
    onError: (e) => toast.error(e.message),
  })

  const toggle = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/api/staff/${id}`, { is_active }),
    onSuccess: () => { qc.invalidateQueries(['staff']); toast.success('Status updated') },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Staff Management"
        right={
          <Btn size="sm" onClick={() => { setForm(EMPTY); setModal(true) }}>
            <Plus className="w-3.5 h-3.5" /> Add Staff
          </Btn>
        }
      />

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skel key={i} className="h-16" />)}</div>
      ) : staff.length === 0 ? (
        <Empty icon={UserCog} title="No staff yet" body="Add managers or staff members here." action={{ label: 'Add Staff', onClick: () => setModal(true) }} />
      ) : (
        <div className="space-y-2">
          {staff.map(s => (
            <Card key={s.id} className="p-4 flex items-center gap-3">
              <Avatar name={s.full_name} size={10} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-[#0D0D12]">{s.full_name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.role === 'manager' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                    {s.staff_role_label || s.role}
                  </span>
                  {!s.is_active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">Inactive</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-[#9CA3AF] mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>
                  {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
                </div>
              </div>
              <button
                onClick={() => toggle.mutate({ id: s.id, is_active: !s.is_active })}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${s.is_active ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
              >
                {s.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Add Staff / Manager" onClose={() => setModal(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full Name *" value={form.full_name} onChange={set('full_name')} placeholder="Ravi Kumar" />
              <Input label="Email *" type="email" value={form.email} onChange={set('email')} placeholder="ravi@pgname.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Password *" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 chars" />
              <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="9876543210" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Role *</label>
                <select value={form.userRole} onChange={set('userRole')} className="w-full h-10 border border-[#E8E9F2] rounded-xl px-3.5 text-sm outline-none focus:border-brand-500">
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              <Input label="Role Label" value={form.staff_role_label} onChange={set('staff_role_label')} placeholder="e.g. Caretaker" />
            </div>
            <div className="flex gap-2 pt-2">
              <Btn variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Btn>
              <Btn className="flex-1" onClick={() => create.mutate(form)} loading={create.isPending} disabled={!form.full_name || !form.email || !form.password}>
                Create Account
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
