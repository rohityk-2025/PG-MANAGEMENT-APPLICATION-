import { useQuery } from '@tanstack/react-query'
import { CreditCard, AlertCircle, Home, Clock, BadgeCheck } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

function StatCard({ icon: Icon, label, value, sub, color = 'text-slate-900', bg = 'bg-white' }) {
  return (
    <div className={`${bg} rounded-2xl border border-slate-200 p-4 flex items-start gap-3`}>
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`font-display text-xl mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function TenantDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-dash'],
    queryFn:  () => api.get('/api/dashboard/tenant'),
  })

  const tenancy = data?.tenancy     || {}
  const rent    = data?.current_rent || null
  const complaints = data?.recent_complaints || []

  if (isLoading) return (
    <div className="px-4 py-6 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />)}
    </div>
  )

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-2xl text-slate-900">
          Hello, {user?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {tenancy.property?.name ? `${tenancy.property.name} · Room ${tenancy.room?.room_number} · Bed ${tenancy.bed?.bed_number}` : 'Welcome to PGManager'}
        </p>
      </div>

      {/* Verification badge */}
      {user?.is_approved && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
          <BadgeCheck className="w-4 h-4 text-blue-500" />
          <p className="text-sm text-blue-700 font-medium">Verified Tenant</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Home}       label="Room"     value={tenancy.room?.room_number || 'N/A'}  sub={tenancy.room?.room_type} />
        <StatCard icon={CreditCard} label="Monthly"  value={tenancy.rent_amount ? `INR ${Number(tenancy.rent_amount).toLocaleString('en-IN')}` : 'N/A'} sub="Rent" />
        {rent && (
          <>
            <StatCard icon={Clock}       label="This Month" value={rent.status === 'paid' ? 'Paid' : 'Pending'} color={rent.status==='paid'?'text-emerald-600':'text-amber-600'} />
            <StatCard icon={AlertCircle} label="Due Date"   value={rent.due_date ? new Date(rent.due_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : 'N/A'} />
          </>
        )}
      </div>

      {/* Current rent card */}
      {rent && rent.status !== 'paid' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="font-semibold text-amber-800 mb-1">Rent Due</p>
          <p className="text-2xl font-display text-amber-900">INR {Number(rent.amount_due).toLocaleString('en-IN')}</p>
          <p className="text-xs text-amber-700 mt-1">For {rent.month_year}</p>
          <button onClick={() => navigate('/tenant/rent')}
            className="mt-3 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors">
            View Payment Details
          </button>
        </div>
      )}

      {/* Tenancy info */}
      {tenancy.property && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <p className="font-semibold text-slate-800 mb-2">Your PG</p>
          <p className="text-sm text-slate-600">{tenancy.property.name}</p>
          {tenancy.property.contact_phone && <p className="text-sm text-slate-500">Contact: {tenancy.property.contact_phone}</p>}
          {tenancy.check_in_date && <p className="text-sm text-slate-500">Check-in: {new Date(tenancy.check_in_date).toLocaleDateString('en-IN')}</p>}
        </div>
      )}

      {/* Recent complaints */}
      {complaints.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="font-semibold text-slate-800 mb-3">Recent Complaints</p>
          <div className="space-y-2">
            {complaints.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <p className="text-sm text-slate-700 truncate flex-1">{c.title}</p>
                <span className={`ml-2 shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${c.status==='resolved'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
