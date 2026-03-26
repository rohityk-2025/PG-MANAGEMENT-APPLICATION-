import { useQuery } from '@tanstack/react-query'
import { Users, BedDouble, AlertTriangle, TrendingUp, Building2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useProperty } from '../../hooks/useProperty'
import { api } from '../../lib/api'
import { StatCard, Card, PropPicker, Skel } from '../../components/ui'
import { formatRupees } from '../../lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function Dashboard() {
  const { user } = useAuth()
  const { properties, selectedId, select } = useProperty()

  const { data: ownerStats }   = useQuery({ queryKey: ['dash-owner'],  queryFn: () => api.get('/api/dashboard/owner'),  enabled: user?.role === 'owner' })
  const { data: managerStats } = useQuery({ queryKey: ['dash-manager', selectedId], queryFn: () => api.get(`/api/dashboard/manager?property_id=${selectedId}`), enabled: user?.role === 'manager' && !!selectedId })
  const { data: tenantStats }  = useQuery({ queryKey: ['dash-tenant'],  queryFn: () => api.get('/api/dashboard/tenant'),  enabled: user?.role === 'tenant' })

  if (user?.role === 'tenant') {
    const t = tenantStats?.tenancy, r = tenantStats?.current_rent
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-[#0D0D12]">My Dashboard</h1>
        {t ? (
          <>
            <Card className="p-5">
              <p className="font-semibold text-[#374151]">{t.property?.name}</p>
              <p className="text-sm text-[#6B7280]">Room {t.room?.room_number} · Bed {t.bed?.bed_number}</p>
              <p className="font-display text-2xl font-bold text-brand-500 mt-2">{formatRupees(t.rent_amount)}<span className="text-sm text-[#9CA3AF] font-normal">/month</span></p>
            </Card>
            {r && (
              <Card className="p-5">
                <p className="font-semibold text-sm text-[#374151] mb-2">This Month</p>
                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-[#9CA3AF]">Due</p><p className="font-bold text-[#0D0D12]">{formatRupees(r.amount_due)}</p></div>
                  <div><p className="text-xs text-[#9CA3AF]">Status</p><span className={`badge ${r.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'} border`}>{r.status}</span></div>
                </div>
              </Card>
            )}
          </>
        ) : <p className="text-[#9CA3AF] text-sm">No active tenancy found.</p>}
      </div>
    )
  }

  const s = user?.role === 'owner' ? ownerStats : managerStats

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0D0D12]">Dashboard</h1>
          <p className="text-[#6B7280] text-sm">Good to see you, {user?.full_name?.split(' ')[0]}</p>
        </div>
        {user?.role !== 'owner' && <PropPicker properties={properties} selectedId={selectedId} onSelect={select} />}
      </div>

      {!s ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skel key={i} className="h-24" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {user?.role === 'owner' ? <>
              <StatCard label="Properties"     value={s.total_properties || 0} icon={Building2}    color="brand" />
              <StatCard label="Total Tenants"  value={s.total_tenants    || 0} icon={Users}         color="green" />
              <StatCard label="Vacant Beds"    value={s.vacant_beds      || 0} icon={BedDouble}     color="amber" />
              <StatCard label="Open Complaints" value={s.open_complaints  || 0} icon={AlertTriangle} color="red"   />
            </> : <>
              <StatCard label="Active Tenants"   value={s.total_tenants     || 0} icon={Users}         color="brand" />
              <StatCard label="Vacant Beds"      value={s.vacant_beds       || 0} icon={BedDouble}     color="green" />
              <StatCard label="Pending Approvals" value={s.pending_approvals || 0} icon={CheckCircle2}  color="amber" />
              <StatCard label="Open Complaints"  value={s.open_complaints   || 0} icon={AlertTriangle} color="red"   />
            </>}
          </div>

          {user?.role === 'manager' && s.rent_expected > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-sm text-[#374151]">Rent Collection — This Month</p>
                <span className="font-display text-2xl font-bold text-brand-500">{s.rent_pct}%</span>
              </div>
              <div className="h-2 bg-[#E8E9F2] rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${s.rent_pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-[#9CA3AF] mt-2">
                <span>Collected: {formatRupees(s.rent_collected)}</span>
                <span>Expected: {formatRupees(s.rent_expected)}</span>
              </div>
            </Card>
          )}

          {user?.role === 'owner' && ownerStats?.properties?.length > 0 && (
            <Card className="p-5">
              <p className="font-semibold text-sm text-[#374151] mb-3">Properties Overview</p>
              <div className="space-y-2">
                {ownerStats.properties.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-[#374151]">{p.name}</span>
                    <span className="text-[#9CA3AF] text-xs">{p.city}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
