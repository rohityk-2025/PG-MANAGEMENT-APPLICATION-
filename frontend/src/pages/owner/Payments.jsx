import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Banknote, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../../lib/api'
import { Btn, Modal, Input, Select, Textarea, Empty, Skel, Card, Badge, PropPicker, SectionHeader } from '../../components/ui'
import { useProperty } from '../../hooks/useProperty'
import toast from 'react-hot-toast'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function Payments() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth()+1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [tab,   setTab]   = useState('all')
  const [modal, setModal] = useState(null)
  const [form,  setForm]  = useState({ payment_mode:'cash', paid_date:'', txn_id:'', notes:'' })
  const { properties, selectedId, select } = useProperty()
  const qc = useQueryClient()
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const { data:payments=[], isLoading } = useQuery({
    queryKey:['payments',selectedId,month,year],
    queryFn:()=>api.get(`/api/payments?property_id=${selectedId}&month=${month}&year=${year}`),
    enabled:!!selectedId,
  })

  const generate = useMutation({
    mutationFn:()=>api.post('/api/payments/generate',{property_id:selectedId,month,year}),
    onSuccess:d=>{ qc.invalidateQueries(['payments']); toast.success(`${d.generated} records created`) },
    onError:e=>toast.error(e.message),
  })
  const markPaid = useMutation({
    mutationFn:({id,...d})=>api.patch(`/api/payments/${id}/pay`,d),
    onSuccess:()=>{ qc.invalidateQueries(['payments']); setModal(null); toast.success('Marked as paid ✓') },
  })

  const list = tab==='all' ? payments : payments.filter(p=>p.status===tab)
  const collected = payments.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.amount),0)

  return (
    <div className="space-y-5">
      <SectionHeader title="Payments"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <PropPicker properties={properties} selectedId={selectedId} onSelect={select}/>
            <select className="h-9 border-2 border-[#E2E4EE] rounded-xl px-2.5 text-sm font-semibold outline-none bg-white" value={month} onChange={e=>setMonth(+e.target.value)}>
              {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
            <select className="h-9 border-2 border-[#E2E4EE] rounded-xl px-2.5 text-sm font-semibold outline-none bg-white" value={year} onChange={e=>setYear(+e.target.value)}>
              {[2024,2025,2026].map(y=><option key={y}>{y}</option>)}
            </select>
            <Btn size="sm" variant="outline" onClick={()=>generate.mutate()} loading={generate.isPending}>Generate</Btn>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          {l:'Collected', v:`₹${collected.toLocaleString('en-IN')}`, c:'text-emerald-600'},
          {l:'Pending',   v:payments.filter(p=>p.status==='pending').length, c:'text-amber-600'},
          {l:'Total',     v:payments.length, c:'text-[#0D0D12]'},
        ].map(({l,v,c})=>(
          <Card key={l} className="p-4">
            <p className="text-xs text-[#AEAFC0] font-semibold uppercase tracking-wider mb-1">{l}</p>
            <p className={`font-display text-xl font-bold ${c}`}>{v}</p>
          </Card>
        ))}
      </div>

      <div className="flex gap-1.5">
        {['all','paid','pending'].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${tab===t?'bg-[#1C1C28] text-white':'bg-white border-2 border-[#E2E4EE] text-[#64657A] hover:border-[#1C1C28]'}`}>
            {t}
          </button>
        ))}
      </div>

      {isLoading ? <div className="space-y-2">{[1,2,3].map(i=><Skel key={i} className="h-16"/>)}</div>
      : list.length===0 ? <Empty icon={Banknote} title="No records" body={payments.length===0?'Click Generate to create records for this month.':'No matching records.'}/>
      : (
        <div className="space-y-2">
          {list.map(p=>(
            <Card key={p.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[#0D0D12]">{p.tenants?.users?.name}</p>
                <p className="text-xs text-[#AEAFC0]">Rm {p.tenants?.rooms?.room_number} · ₹{Number(p.amount).toLocaleString('en-IN')}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {p.status==='paid'
                  ? <><Badge variant="green">Paid</Badge><span className="text-xs text-[#AEAFC0]">{p.paid_date}</span></>
                  : <><Badge variant="yellow">Pending</Badge>
                     <Btn size="sm" variant="success" onClick={()=>{ setModal(p); setForm({payment_mode:'cash',paid_date:new Date().toISOString().split('T')[0],txn_id:'',notes:''}) }}>
                       <CheckCircle2 className="w-3.5 h-3.5"/>Pay
                     </Btn>
                    </>
                }
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Confirm Payment" onClose={()=>setModal(null)}>
          <p className="text-sm text-[#64657A] mb-4">
            Tenant: <strong className="text-[#0D0D12]">{modal.tenants?.users?.name}</strong> · ₹{Number(modal.amount).toLocaleString('en-IN')}
          </p>
          <div className="space-y-3">
            <Select label="Mode" value={form.payment_mode} onChange={set('payment_mode')}>
              {['cash','upi','bank','cheque'].map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
            </Select>
            <Input label="Date" type="date" value={form.paid_date} onChange={set('paid_date')}/>
            <Input label="Txn / Ref ID" value={form.txn_id} onChange={set('txn_id')} placeholder="Optional"/>
            <Textarea label="Notes" value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional"/>
            <Btn className="w-full" onClick={()=>markPaid.mutate({id:modal.id,...form})} loading={markPaid.isPending}>Confirm</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
