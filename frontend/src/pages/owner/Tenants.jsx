import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Phone, BedDouble, LogOut, ChevronRight, BadgeCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { Btn, Modal, Input, Select, Empty, Skel, Card, SectionHeader, Avatar, Badge } from '../../components/ui'
import { useProperty } from '../../hooks/useProperty'
import { useAuth } from '../../context/AuthContext'
import { formatRupees, formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'

const EMPTY = {
  full_name: '', email: '', phone: '', password: '',
  room_id: '', bed_id: '', rent_amount: '', deposit_amount: '',
  check_in_date: '', occupation: '', gender: '',
}

export default function Tenants() {
  const { properties, selectedId, select } = useProperty()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState(EMPTY)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  // Fetch tenants (tenancies) for selected property
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants', selectedId],
    queryFn:  () => api.get(`/api/tenants?property_id=${selectedId}`),
    enabled:  !!selectedId,
  })

  // Fetch floors+rooms+beds for the assignment dropdowns
  const { data: floors = [] } = useQuery({
    queryKey: ['floors', selectedId],
    queryFn:  () => api.get(`/api/rooms/${selectedId}/floors`),
    enabled:  !!selectedId && modal,
  })

  // Available vacant beds from selected room
  const selectedRoom = floors.flatMap(f => f.rooms || []).find(r => r.id === form.room_id)
  const vacantBeds   = (selectedRoom?.beds || []).filter(b => b.status === 'vacant')

  const create = useMutation({
    mutationFn: (d) => api.post('/api/tenants', { ...d, property_id: selectedId, rent_amount: Number(d.rent_amount) || 0, deposit_amount: Number(d.deposit_amount) || 0 }),
    onSuccess: () => { qc.invalidateQueries(['tenants']); qc.invalidateQueries(['floors']); setModal(false); toast.success('Tenant added successfully') },
    onError: (e) => toast.error(e.message),
  })

  const checkout = useMutation({
    mutationFn: (id) => api.patch(`/api/tenants/${id}`, { is_active: false, check_out_date: new Date().toISOString().split('T')[0] }),
    onSuccess: () => { qc.invalidateQueries(['tenants']); qc.invalidateQueries(['floors']); toast.success('Tenant checked out') },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Tenants"
        right={
          <div className="flex items-center gap-2">
            <select value={selectedId} onChange={e => select(e.target.value)} className="h-9 pl-3 pr-8 text-xs border border-[#E8E9F2] rounded-xl outline-none bg-white">
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Btn size="sm" onClick={() => { setForm(EMPTY); setModal(true) }}>
              <Plus className="w-3.5 h-3.5" /> Add Tenant
            </Btn>
          </div>
        }
      />

      {/* Summary */}
      {tenants.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-xl">{tenants.length} Active Tenants</span>
          <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-xl">
            {tenants.filter(t => !t.tenant?.is_approved).length} Pending Approval
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skel key={i} className="h-20" />)}</div>
      ) : tenants.length === 0 ? (
        <Empty icon={Users} title="No tenants yet" body="Add tenants and assign them to beds." action={{ label: 'Add Tenant', onClick: () => setModal(true) }} />
      ) : (
        <div className="space-y-2">
          {tenants.map(t => {
            const tenant = t.tenant || {}
            return (
              <Card key={t.id} className="p-4 hover:border-brand-200 transition-colors cursor-pointer" onClick={() => navigate(`/${user.role}/tenants/${tenant.id}`)}>
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <Avatar name={tenant.full_name} src={tenant.profile_photo_url} size={11} />
                    {tenant.is_approved && (
                      <BadgeCheck className="absolute -bottom-0.5 -right-0.5 w-4 h-4 text-blue-500 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-[#0D0D12]">{tenant.full_name}</p>
                      {!tenant.is_approved && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold border border-amber-200">Pending</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#9CA3AF] mt-0.5 flex-wrap">
                      {tenant.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{tenant.phone}</span>}
                      {t.room && <span className="flex items-center gap-1"><BedDouble className="w-3 h-3" />Rm {t.room.room_number}</span>}
                      {t.bed && <span>Bed {t.bed.bed_number}</span>}
                      <span>Since {formatDate(t.check_in_date)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[#0D0D12]">{formatRupees(t.rent_amount)}<span className="text-[#9CA3AF] font-normal text-xs">/mo</span></p>
                      <button
                        onClick={e => { e.stopPropagation(); if (confirm(`Check out ${tenant.full_name}?`)) checkout.mutate(t.id) }}
                        className="text-xs text-red-400 hover:text-red-600 font-medium flex items-center gap-1 mt-0.5"
                      >
                        <LogOut className="w-3 h-3" /> Check Out
                      </button>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#C4C8E8]" />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Tenant Modal */}
      {modal && (
        <Modal title="Add New Tenant" onClose={() => setModal(false)} size="lg">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Full Name *" value={form.full_name} onChange={set('full_name')} placeholder="Rahul Sharma" />
              <Input label="Email *" type="email" value={form.email} onChange={set('email')} placeholder="rahul@email.com" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="9876543210" />
              <Input label="Password *" type="password" value={form.password} onChange={set('password')} placeholder="Set a login password" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Room</label>
                <select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value, bed_id: '' }))} className="w-full h-10 border border-[#E8E9F2] rounded-xl px-3.5 text-sm outline-none focus:border-brand-500">
                  <option value="">Select a room</option>
                  {floors.flatMap(fl => (fl.rooms || []).map(r => (
                    <option key={r.id} value={r.id}>Floor {fl.floor_number} — Room {r.room_number} ({r.room_type})</option>
                  )))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Bed</label>
                <select value={form.bed_id} onChange={set('bed_id')} className="w-full h-10 border border-[#E8E9F2] rounded-xl px-3.5 text-sm outline-none focus:border-brand-500" disabled={!form.room_id}>
                  <option value="">Select a bed</option>
                  {vacantBeds.map(b => <option key={b.id} value={b.id}>Bed {b.bed_number}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Monthly Rent (Rs.)" type="number" value={form.rent_amount} onChange={set('rent_amount')} placeholder="6000" />
              <Input label="Deposit (Rs.)" type="number" value={form.deposit_amount} onChange={set('deposit_amount')} placeholder="12000" />
              <Input label="Check-in Date" type="date" value={form.check_in_date} onChange={set('check_in_date')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Occupation" value={form.occupation} onChange={set('occupation')} placeholder="Student / Engineer" />
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Gender</label>
                <select value={form.gender} onChange={set('gender')} className="w-full h-10 border border-[#E8E9F2] rounded-xl px-3.5 text-sm outline-none focus:border-brand-500">
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Btn variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Btn>
              <Btn className="flex-1" onClick={() => create.mutate(form)} loading={create.isPending} disabled={!form.full_name || !form.email || !form.password}>
                Add Tenant
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
