import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QrCode, Copy, Upload, Check, CreditCard, AlertCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { Card, Btn, Input, Badge, Empty, Skel, SectionHeader, Modal } from '../../components/ui'
import { formatRupees, formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'

// Upload a payment screenshot to Supabase storage and return its URL
async function uploadScreenshot(file, recordId) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
  const ext  = file.name.split('.').pop()
  const path = `${recordId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('payments').upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('payments').getPublicUrl(path)
  return data.publicUrl
}

const STATUS_STYLE = {
  paid:                 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending:              'bg-amber-50 text-amber-700 border border-amber-200',
  overdue:              'bg-red-50 text-red-600 border border-red-200',
  pending_confirmation: 'bg-purple-50 text-purple-700 border border-purple-200',
  waived:               'bg-slate-100 text-slate-500 border border-slate-200',
}

export default function TenantRent() {
  const qc = useQueryClient()
  const [filter, setFilter]     = useState('all')
  const [payModal, setPayModal] = useState(null) // holds the rent record being paid
  const [screenshot, setScreenshot] = useState(null)
  const [txnId, setTxnId]       = useState('')
  const [uploading, setUploading] = useState(false)

  // Fetch rent records for this tenant
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['tenant-rent'],
    queryFn:  () => api.get('/api/rent/my'),
  })

  // Fetch tenancy to show PG payment details (UPI, QR code)
  const { data: dashData } = useQuery({
    queryKey: ['tenant-dash'],
    queryFn:  () => api.get('/api/dashboard/tenant'),
  })
  const property = dashData?.tenancy?.property

  const filtered = records.filter(r =>
    filter === 'all' || r.status === filter
  )

  function copy(text) {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const submitPayment = useMutation({
    mutationFn: async (record) => {
      setUploading(true)
      let screenshotUrl = null
      if (screenshot) {
        screenshotUrl = await uploadScreenshot(screenshot, record.id)
      }
      await api.patch(`/api/rent/${record.id}/submit`, {
        payment_screenshot_url: screenshotUrl,
        transaction_id: txnId,
      })
    },
    onSuccess: () => {
      toast.success('Payment submitted — awaiting manager confirmation')
      setPayModal(null)
      setScreenshot(null)
      setTxnId('')
      qc.invalidateQueries(['tenant-rent'])
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setUploading(false),
  })

  return (
    <div className="space-y-4">
      <SectionHeader title="Rent & Payments" />

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', 'pending', 'overdue', 'paid'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold capitalize whitespace-nowrap transition-colors flex-shrink-0 ${
              filter === f
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-[#E8E9F2] text-[#6B7280] hover:border-[#C4C8E8]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skel key={i} className="h-24" />)}</div>
      ) : filtered.length === 0 ? (
        <Empty icon={CreditCard} title="No records found" body="No rent records for this filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className="p-4">
              {/* Month + status row */}
              <div className="flex items-center justify-between mb-2">
                <p className="font-display font-bold text-[#0D0D12]">
                  {new Date(r.year, r.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                </p>
                <span className={`badge ${STATUS_STYLE[r.status] || STATUS_STYLE.pending}`}>
                  {r.status?.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Amount */}
              <p className="font-display text-2xl font-bold text-[#0D0D12] mb-1">
                {formatRupees(r.amount_due)}
              </p>

              {/* Due date */}
              {r.due_date && (
                <p className="text-xs text-[#9CA3AF] mb-3">Due: {formatDate(r.due_date)}</p>
              )}

              {/* Paid info */}
              {r.status === 'paid' && (
                <div className="bg-emerald-50 rounded-xl p-3 space-y-1 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700">Paid {formatDate(r.paid_date)}</span>
                  </div>
                  {r.payment_mode && <p className="text-xs text-emerald-600">{r.payment_mode?.toUpperCase()}</p>}
                  {r.transaction_id && <p className="font-mono text-xs text-emerald-600">Txn: {r.transaction_id}</p>}
                  {r.receipt_number && <p className="text-xs text-emerald-600">Receipt: {r.receipt_number}</p>}
                </div>
              )}

              {/* Pending confirmation notice */}
              {r.status === 'pending_confirmation' && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 mb-2">
                  <p className="text-xs text-purple-700 font-medium">
                    Payment submitted — waiting for manager to confirm.
                  </p>
                </div>
              )}

              {/* Overdue warning */}
              {r.status === 'overdue' && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-600 font-medium">Payment is overdue. Please pay immediately.</p>
                </div>
              )}

              {/* Pay Now button for pending/overdue */}
              {(r.status === 'pending' || r.status === 'overdue') && (
                <Btn className="w-full mt-1" size="sm" onClick={() => setPayModal(r)}>
                  Pay Now
                </Btn>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Pay Now modal */}
      {payModal && (
        <Modal
          title={`Pay — ${new Date(payModal.year, payModal.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`}
          onClose={() => { setPayModal(null); setScreenshot(null); setTxnId('') }}
          size="lg"
        >
          <div className="space-y-4">
            <div className="bg-[#F4F5FA] rounded-2xl p-4 text-center">
              <p className="text-xs text-[#9CA3AF] mb-1">Amount Due</p>
              <p className="font-display text-3xl font-bold text-[#0D0D12]">{formatRupees(payModal.amount_due)}</p>
            </div>

            {/* PG payment details */}
            {property && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Pay To</p>

                {property.qr_code_url && (
                  <div className="flex justify-center">
                    <img src={property.qr_code_url} alt="QR Code" className="w-44 h-44 rounded-2xl border border-[#E8E9F2] object-cover" />
                  </div>
                )}

                {property.upi_id && (
                  <div className="flex items-center justify-between bg-[#F4F5FA] rounded-xl px-4 py-3">
                    <div>
                      <p className="text-xs text-[#9CA3AF]">UPI ID</p>
                      <p className="font-mono text-sm font-semibold text-[#0D0D12]">{property.upi_id}</p>
                    </div>
                    <button onClick={() => copy(property.upi_id)} className="w-8 h-8 flex items-center justify-center hover:bg-[#E8E9F2] rounded-lg transition-colors">
                      <Copy className="w-3.5 h-3.5 text-[#6B7280]" />
                    </button>
                  </div>
                )}

                {property.upi_phone && (
                  <div className="flex items-center justify-between bg-[#F4F5FA] rounded-xl px-4 py-3">
                    <div>
                      <p className="text-xs text-[#9CA3AF]">UPI Phone</p>
                      <p className="font-mono text-sm font-semibold text-[#0D0D12]">{property.upi_phone}</p>
                    </div>
                    <button onClick={() => copy(property.upi_phone)} className="w-8 h-8 flex items-center justify-center hover:bg-[#E8E9F2] rounded-lg transition-colors">
                      <Copy className="w-3.5 h-3.5 text-[#6B7280]" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Upload screenshot */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">
                Payment Screenshot *
              </label>
              <label className={`flex items-center gap-3 w-full h-11 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${screenshot ? 'border-brand-500 bg-brand-50' : 'border-[#E8E9F2] hover:border-[#C4C8E8]'}`}>
                <Upload className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                <span className="text-sm text-[#6B7280] truncate">
                  {screenshot ? screenshot.name : 'Tap to upload screenshot'}
                </span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => setScreenshot(e.target.files?.[0] || null)} />
              </label>
            </div>

            <Input
              label="Transaction ID / UTR *"
              value={txnId}
              onChange={e => setTxnId(e.target.value)}
              placeholder="e.g. 402812345678"
            />

            <div className="flex gap-2 pt-1">
              <Btn variant="outline" className="flex-1" onClick={() => setPayModal(null)}>Cancel</Btn>
              <Btn
                className="flex-1"
                loading={uploading || submitPayment.isPending}
                disabled={!txnId}
                onClick={() => submitPayment.mutate(payModal)}
              >
                Submit Payment
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
