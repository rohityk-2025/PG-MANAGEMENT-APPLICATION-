import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Pencil, Trash2, MapPin, Phone, CreditCard } from 'lucide-react'
import { api } from '../../lib/api'
import { Btn, Modal, Input, Empty, Skel, Card, SectionHeader } from '../../components/ui'
import toast from 'react-hot-toast'

// Empty form — field names match exactly what the backend expects
const EMPTY = {
  name:          '',
  street_address: '',
  city:          '',
  state:         '',
  pin_code:      '',
  contact_phone: '',
  upi_id:        '',
  upi_phone:     '',
}

export default function Properties() {
  const [modal, setModal] = useState(null)  // null | 'add' | property object (for edit)
  const [form, setForm]   = useState(EMPTY)
  const qc = useQueryClient()
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn:  () => api.get('/api/properties'),
  })

  const create = useMutation({
    mutationFn: (d) => api.post('/api/properties', d),
    onSuccess: (data) => {
      qc.invalidateQueries(['properties'])
      qc.invalidateQueries(['my-properties'])
      setModal(null)
      toast.success(`"${data.name}" created`)
    },
    onError: (e) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, ...d }) => api.patch(`/api/properties/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries(['properties'])
      qc.invalidateQueries(['my-properties'])
      setModal(null)
      toast.success('Property updated')
    },
    onError: (e) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: (id) => api.delete(`/api/properties/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['properties'])
      qc.invalidateQueries(['my-properties'])
      toast.success('Property deleted')
    },
    onError: (e) => toast.error(e.message),
  })

  function openAdd() {
    setForm(EMPTY)
    setModal('add')
  }

  function openEdit(p) {
    setForm({
      name:           p.name          || '',
      street_address: p.street_address || '',
      city:           p.city          || '',
      state:          p.state         || '',
      pin_code:       p.pin_code      || '',
      contact_phone:  p.contact_phone  || '',
      upi_id:         p.upi_id        || '',
      upi_phone:      p.upi_phone     || '',
    })
    setModal(p)
  }

  function save() {
    if (!form.name.trim()) return toast.error('Property name is required')
    if (modal === 'add') {
      create.mutate(form)
    } else {
      update.mutate({ id: modal.id, ...form })
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Properties"
        right={
          <Btn onClick={openAdd} size="sm">
            <Plus className="w-3.5 h-3.5" /> Add Property
          </Btn>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map(i => <Skel key={i} className="h-36" />)}
        </div>
      ) : properties.length === 0 ? (
        <Empty
          icon={Building2}
          title="No properties yet"
          body="Add your first PG property to get started."
          action={{ label: 'Add Property', onClick: openAdd }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(p => (
            <Card key={p.id} className="p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-brand-500" strokeWidth={1.5} />
                </div>
                {/* Edit and delete buttons appear on hover */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 hover:bg-[#F4F5FA] rounded-lg transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${p.name}"?`)) del.mutate(p.id) }}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              <p className="font-display font-bold text-[#0D0D12] mb-1">{p.name}</p>

              {(p.street_address || p.city) && (
                <p className="text-xs text-[#9CA3AF] flex items-center gap-1 mb-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {[p.street_address, p.city, p.state].filter(Boolean).join(', ')}
                </p>
              )}
              {p.contact_phone && (
                <p className="text-xs text-[#9CA3AF] flex items-center gap-1 mb-1">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  {p.contact_phone}
                </p>
              )}
              {p.upi_id && (
                <p className="text-xs text-brand-500 font-medium flex items-center gap-1 mt-2">
                  <CreditCard className="w-3 h-3 flex-shrink-0" />
                  {p.upi_id}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <Modal
          title={modal === 'add' ? 'Add New Property' : `Edit — ${modal.name}`}
          onClose={() => setModal(null)}
          size="lg"
        >
          <div className="space-y-3">
            <Input
              label="Property Name *"
              value={form.name}
              onChange={set('name')}
              placeholder="Sunrise Boys PG"
            />
            <Input
              label="Street Address"
              value={form.street_address}
              onChange={set('street_address')}
              placeholder="123 MG Road, Near Bus Stand"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input label="City"     value={form.city}     onChange={set('city')}     placeholder="Pune" />
              <Input label="State"    value={form.state}    onChange={set('state')}    placeholder="Maharashtra" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="PIN Code"      value={form.pin_code}      onChange={set('pin_code')}      placeholder="411001" />
              <Input label="Contact Phone" value={form.contact_phone} onChange={set('contact_phone')} placeholder="9876543210" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="UPI ID"    value={form.upi_id}    onChange={set('upi_id')}    placeholder="owner@upi" />
              <Input label="UPI Phone" value={form.upi_phone} onChange={set('upi_phone')} placeholder="9876543210" />
            </div>

            <div className="flex gap-2 pt-2">
              <Btn variant="outline" className="flex-1" onClick={() => setModal(null)}>
                Cancel
              </Btn>
              <Btn
                className="flex-1"
                onClick={save}
                loading={create.isPending || update.isPending}
                disabled={!form.name.trim()}
              >
                {modal === 'add' ? 'Create Property' : 'Save Changes'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
