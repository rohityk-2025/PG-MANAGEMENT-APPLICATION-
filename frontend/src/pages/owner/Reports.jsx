import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileDown, BarChart3, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Calendar, Filter } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from 'recharts'
import { api, buildQuery } from '../../lib/api'
import { useProperty } from '../../hooks/useProperty'
import { Btn, Card, SectionHeader, PropPicker, Skel, Empty, StatCard } from '../../components/ui'
import { formatRupees, formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'

const PERIOD_OPTIONS = [
  { value: 'today',    label: 'Today'       },
  { value: 'week',     label: 'This Week'   },
  { value: 'month',    label: 'This Month'  },
  { value: 'quarter',  label: 'Quarter'     },
  { value: 'halfyear', label: '6 Months'    },
  { value: 'year',     label: 'This Year'   },
  { value: 'lastyear', label: 'Last Year'   },
  { value: 'custom',   label: 'Custom Range'},
]

const CHART_COLORS = ['#5B6AF0','#22C55E','#EF4444','#F59E0B','#8B5CF6','#06B6D4','#F97316']

// Custom tooltip that looks nice on recharts
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#E8E9F2] rounded-2xl shadow-xl p-3 text-xs">
      <p className="font-bold text-[#0D0D12] mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-[#6B7280] capitalize">{p.name?.replace(/_/g,' ')}</span>
          <span className="font-semibold ml-auto pl-4">
            {typeof p.value === 'number' && p.value > 999 ? formatRupees(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// Comparison card showing change between two periods
function ComparisonCard({ label, current, previous, isAmount }) {
  const diff = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null
  const isUp  = diff > 0
  return (
    <Card className="p-4">
      <p className="text-[#6B7280] text-xs font-medium mb-2">{label}</p>
      <p className="font-display text-xl font-bold text-[#0D0D12]">
        {isAmount ? formatRupees(current) : current}
      </p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-[#9CA3AF]">
          vs {isAmount ? formatRupees(previous) : previous}
        </p>
        {diff !== null && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
            {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(diff)}%
          </span>
        )}
      </div>
    </Card>
  )
}

export default function Reports() {
  const { properties, selectedId, select } = useProperty()
  const [reportType, setReportType]   = useState('collections')
  const [period, setPeriod]           = useState('month')
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')
  const [compareType, setCompareType] = useState('month')

  // Build query params for the report API call
  const queryParams = buildQuery({
    property_id: selectedId,
    period:      period !== 'custom' ? period : undefined,
    start:       period === 'custom' ? customFrom : undefined,
    end:         period === 'custom' ? customTo   : undefined,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['report', reportType, period, customFrom, customTo, selectedId],
    queryFn: () => api.get(`/api/reports/${reportType}${queryParams}`),
    enabled: !!selectedId && (period !== 'custom' || (customFrom && customTo)),
  })

  // Comparison report data (month vs month, year vs year, etc.)
  const { data: comparison } = useQuery({
    queryKey: ['report-comparison', compareType, selectedId],
    queryFn: () => api.get(`/api/reports/comparison?property_id=${selectedId}&compare=${compareType}`),
    enabled: !!selectedId && reportType === 'comparison',
  })

  // Trigger a download from the backend Excel/PDF endpoint
  const download = async (format) => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token   = localStorage.getItem('pg_token')
    const type    = reportType === 'comparison' ? 'collections' : reportType

    try {
      const resp = await fetch(`${baseUrl}/api/reports/${type}/${format}${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) throw new Error('Download failed')
      const blob = await resp.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `pgmanager-${type}-report.${format === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed. Please try again.')
    }
  }

  const rows    = data?.rows    || []
  const stats   = data?.stats   || {}
  const chart   = data?.chart   || data?.chart_category || data?.chart_monthly || []
  const chartMo = data?.chart_monthly || []
  const chartCat = data?.chart_category || []

  return (
    <div className="space-y-5 pb-10">
      <SectionHeader
        title="Reports"
        subtitle="Financial and operational reports with charts and exports"
        right={
          <div className="flex items-center gap-2">
            <PropPicker properties={properties} selectedId={selectedId} onSelect={select} />
            <Btn size="sm" variant="outline" onClick={() => download('pdf')}>
              <FileDown className="w-3.5 h-3.5" /> PDF
            </Btn>
            <Btn size="sm" variant="outline" onClick={() => download('excel')}>
              <BarChart3 className="w-3.5 h-3.5" /> Excel
            </Btn>
          </div>
        }
      />

      {/* Report type tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {[
          { key: 'collections',    label: 'Collections'    },
          { key: 'expenses',       label: 'Expenses'       },
          { key: 'income_expense', label: 'P&L Overview'   },
          { key: 'occupancy',      label: 'Occupancy'      },
          { key: 'comparison',     label: 'Comparison'     },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setReportType(t.key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              reportType === t.key ? 'bg-brand-500 text-white shadow-sm' : 'bg-white border border-[#E8E9F2] text-[#374151] hover:border-brand-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date filter row */}
      <Card className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-[#6B7280]" />
          <span className="text-xs font-semibold text-[#6B7280] mr-1">Period:</span>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                period === opt.value ? 'bg-brand-500 text-white' : 'bg-[#F4F5FA] text-[#374151] hover:bg-[#E8E9F2]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-3 mt-3">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="h-9 px-3 border border-[#E8E9F2] rounded-xl text-sm outline-none focus:border-brand-500" />
            <span className="text-[#9CA3AF] text-sm">to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="h-9 px-3 border border-[#E8E9F2] rounded-xl text-sm outline-none focus:border-brand-500" />
          </div>
        )}
      </Card>

      {/* Comparison report section */}
      {reportType === 'comparison' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#6B7280]">Compare:</span>
            {[
              { value: 'month',    label: 'Month vs Month' },
              { value: 'halfyear', label: '6M vs 6M'       },
              { value: 'year',     label: 'Year vs Year'   },
            ].map(opt => (
              <button key={opt.value} onClick={() => setCompareType(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${compareType === opt.value ? 'bg-brand-500 text-white' : 'bg-white border border-[#E8E9F2] text-[#374151]'}`}>
                {opt.label}
              </button>
            ))}
          </div>

          {comparison && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ComparisonCard label="Income" current={comparison.current?.income} previous={comparison.previous?.income} isAmount />
                <ComparisonCard label="Expenses" current={comparison.current?.expense} previous={comparison.previous?.expense} isAmount />
                <ComparisonCard label="Net Profit" current={comparison.current?.profit} previous={comparison.previous?.profit} isAmount />
              </div>

              <Card className="p-4">
                <p className="font-display font-bold text-[#0D0D12] mb-4 text-sm">Period Comparison</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={[
                    { period: comparison.previous?.label, income: comparison.previous?.income, expense: comparison.previous?.expense, profit: comparison.previous?.profit },
                    { period: comparison.current?.label,  income: comparison.current?.income,  expense: comparison.current?.expense,  profit: comparison.current?.profit  },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fontFamily: 'Inter' }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `Rs.${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="income"  fill="#22C55E" radius={[4,4,0,0]} name="Income" />
                    <Bar dataKey="expense" fill="#EF4444" radius={[4,4,0,0]} name="Expense" />
                    <Bar dataKey="profit"  fill="#5B6AF0" radius={[4,4,0,0]} name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <div className="flex gap-2">
                <Btn variant="outline" onClick={() => download('pdf')} className="flex-1">
                  <FileDown className="w-4 h-4" /> Download Comparison PDF
                </Btn>
                <Btn variant="outline" onClick={() => download('excel')} className="flex-1">
                  <BarChart3 className="w-4 h-4" /> Download Comparison Excel
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Normal report content */}
      {reportType !== 'comparison' && (
        <>
          {isLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skel key={i} className="h-20" />)}</div>
              <Skel className="h-56 rounded-2xl" />
              <Skel className="h-64 rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Stats row */}
              {Object.keys(stats).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(stats).map(([k, v]) => (
                    <Card key={k} className="p-4">
                      <p className="text-[#9CA3AF] text-xs capitalize mb-1">{k.replace(/_/g,' ')}</p>
                      <p className="font-display text-xl font-bold text-[#0D0D12]">
                        {typeof v === 'number' && v > 999 ? formatRupees(v) : v}
                      </p>
                    </Card>
                  ))}
                </div>
              )}

              {/* Charts */}
              {reportType === 'collections' && chart.length > 0 && (
                <Card className="p-4">
                  <p className="font-display font-bold text-[#0D0D12] mb-4 text-sm">Monthly Collections</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="expected"  fill="#E8E9F2" radius={[4,4,0,0]} name="Expected" />
                      <Bar dataKey="collected" fill="#5B6AF0" radius={[4,4,0,0]} name="Collected" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {reportType === 'expenses' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {chartCat.length > 0 && (
                    <Card className="p-4">
                      <p className="font-display font-bold text-[#0D0D12] mb-4 text-sm">By Category</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={chartCat} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) => `${category} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                            {chartCat.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={v => formatRupees(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </Card>
                  )}
                  {chartMo.length > 0 && (
                    <Card className="p-4">
                      <p className="font-display font-bold text-[#0D0D12] mb-4 text-sm">Monthly Trend</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartMo}>
                          <defs>
                            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#EF4444" stopOpacity={0}   />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="total" stroke="#EF4444" fill="url(#expGrad)" strokeWidth={2} name="Expenses" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Card>
                  )}
                </div>
              )}

              {reportType === 'income_expense' && chart.length > 0 && (
                <Card className="p-4">
                  <p className="font-display font-bold text-[#0D0D12] mb-4 text-sm">Income vs Expense vs Profit</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chart}>
                      <defs>
                        <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#22C55E" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="proGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#5B6AF0" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#5B6AF0" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="income"  stroke="#22C55E" fill="url(#incGrad)" strokeWidth={2} name="Income"  />
                      <Area type="monotone" dataKey="expense" stroke="#EF4444" fill="none"          strokeWidth={2} name="Expense" strokeDasharray="5 3" />
                      <Area type="monotone" dataKey="profit"  stroke="#5B6AF0" fill="url(#proGrad)" strokeWidth={2} name="Profit"  />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {reportType === 'occupancy' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <p className="font-display font-bold text-[#0D0D12] mb-4 text-sm">Bed Status Distribution</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={data?.chart || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                          {(data?.chart || []).map((item, i) => <Cell key={i} fill={item.fill} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                  {data?.stats && (
                    <Card className="p-4">
                      <p className="font-display font-bold text-[#0D0D12] mb-4 text-sm">Occupancy Stats</p>
                      <div className="space-y-3">
                        {Object.entries(data.stats).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between">
                            <span className="text-sm text-[#6B7280] capitalize">{k.replace(/_/g,' ')}</span>
                            <span className="font-semibold text-[#0D0D12]">{v}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Data table */}
              {rows.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E8E9F2] flex items-center justify-between">
                    <p className="font-display font-bold text-[#0D0D12] text-sm">{rows.length} records</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#F4F5FA]">
                        <tr>
                          {Object.keys(rows[0] || {}).map(k => (
                            <th key={k} className="px-4 py-3 text-left font-semibold text-[#6B7280] uppercase tracking-wide whitespace-nowrap">
                              {k.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}>
                            {Object.entries(row).map(([k, v], j) => (
                              <td key={j} className="px-4 py-3 text-[#374151] whitespace-nowrap">
                                {k === 'status' ? (
                                  <span className={`badge ${
                                    v === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    v === 'overdue' ? 'bg-red-50 text-red-600 border-red-200' :
                                    'bg-amber-50 text-amber-700 border-amber-200'
                                  } border`}>{v}</span>
                                ) : typeof v === 'number' && v > 999 ? formatRupees(v)
                                : v ?? '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {rows.length === 0 && !isLoading && (
                <Empty icon={BarChart3} title="No data for this period" body="Try changing the date range or property filter." />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
