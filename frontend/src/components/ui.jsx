import { Loader2, AlertCircle, Home, ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'

// ─── Button ──────────────────────────────────────────────────────────────────
export function Btn({ children, variant = 'primary', size = 'md', loading, disabled, onClick, className, type = 'button' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-[.97] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'
  const sizes = { sm: 'h-8 px-3.5 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' }
  const variants = {
    primary: 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm',
    secondary: 'bg-brand-50 hover:bg-brand-100 text-brand-700',
    outline: 'border border-[#E8E9F2] bg-white hover:bg-[#F4F5FA] text-[#374151]',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    ghost: 'hover:bg-[#F4F5FA] text-[#374151]',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={`${base} ${sizes[size]} ${variants[variant]} ${className || ''}`}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  )
}

// ─── Input ───────────────────────────────────────────────────────────────────
// bg-white is explicit so autofill yellow never bleeds through.
// text-[#0D0D12] is set directly and also via -webkit-text-fill-color in CSS.
export function Input({ label, error, className, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">{label}</label>}
      <input
        {...props}
        className={`w-full h-10 px-3.5 bg-white border ${error ? 'border-red-400 focus:border-red-500' : 'border-[#E8E9F2] hover:border-[#C4C8E8] focus:border-brand-500'} rounded-xl text-sm text-[#0D0D12] placeholder:text-[#9CA3AF] outline-none transition-colors focus:ring-2 focus:ring-brand-500/20 ${className || ''}`}
        style={{ color: '#0D0D12', backgroundColor: '#ffffff', ...props.style }}
      />
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  )
}

// ─── Select ──────────────────────────────────────────────────────────────────
export function Select({ label, error, children, className, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">{label}</label>}
      <div className="relative">
        <select
          {...props}
          className={`w-full h-10 pl-3.5 pr-9 bg-white border ${error ? 'border-red-400' : 'border-[#E8E9F2] hover:border-[#C4C8E8] focus:border-brand-500'} rounded-xl text-sm text-[#0D0D12] outline-none appearance-none transition-colors focus:ring-2 focus:ring-brand-500/20 ${className || ''}`}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea({ label, error, rows = 3, className, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">{label}</label>}
      <textarea
        rows={rows}
        {...props}
        style={{ color: '#0D0D12', backgroundColor: '#ffffff', ...props.style }}
        className={`w-full px-3.5 py-2.5 bg-white border ${error ? 'border-red-400' : 'border-[#E8E9F2] hover:border-[#C4C8E8] focus:border-brand-500'} rounded-xl text-sm text-[#0D0D12] placeholder:text-[#9CA3AF] outline-none resize-none transition-colors focus:ring-2 focus:ring-brand-500/20 ${className || ''}`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, className, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-[#E8E9F2] shadow-sm ${onClick ? 'cursor-pointer hover:border-brand-200 hover:shadow-md transition-all' : ''} ${className || ''}`}
    >
      {children}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, size = 'md' }) {
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative w-full ${widths[size]} bg-white rounded-3xl shadow-2xl p-6 fade-in`}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-bold text-[#0D0D12]">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F4F5FA] text-[#9CA3AF] hover:text-[#374151] transition-colors text-xl leading-none">&times;</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ─── Badge ───────────────────────────────────────────────────────────────────
const BADGE_STYLES = {
  vacant:       'bg-emerald-50 text-emerald-700 border border-emerald-200',
  occupied:     'bg-red-50 text-red-600 border border-red-200',
  notice_period:'bg-amber-50 text-amber-700 border border-amber-200',
  maintenance:  'bg-slate-100 text-slate-500 border border-slate-200',
  reserved:     'bg-blue-50 text-blue-700 border border-blue-200',
  paid:         'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending:      'bg-amber-50 text-amber-700 border border-amber-200',
  overdue:      'bg-red-50 text-red-600 border border-red-200',
  pending_confirmation: 'bg-purple-50 text-purple-700 border border-purple-200',
  open:         'bg-orange-50 text-orange-600 border border-orange-200',
  resolved:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
  under_process:'bg-blue-50 text-blue-700 border border-blue-200',
  verified:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected:     'bg-red-50 text-red-600 border border-red-200',
  active:       'bg-emerald-50 text-emerald-700 border border-emerald-200',
  inactive:     'bg-slate-100 text-slate-500 border border-slate-200',
}

export function Badge({ status, children, className }) {
  const style = BADGE_STYLES[status] || 'bg-slate-100 text-slate-600 border border-slate-200'
  return (
    <span className={`badge ${style} ${className || ''}`}>
      {children || status?.replace(/_/g, ' ')}
    </span>
  )
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
export function Avatar({ name, src, size = 10, className }) {
  const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?'
  const colors   = ['bg-brand-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-rose-500']
  const color    = colors[(name?.charCodeAt(0) || 0) % colors.length]
  if (src) {
    return <img src={src} alt={name} className={`w-${size} h-${size} rounded-full object-cover ${className || ''}`} />
  }
  return (
    <div className={`w-${size} h-${size} ${color} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className || ''}`}
      style={{ fontSize: `${size * 0.35}px` }}>
      {initials}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
export function Empty({ icon: Icon = Home, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-brand-500" strokeWidth={1.5} />
      </div>
      <p className="font-display font-bold text-[#0D0D12] text-lg mb-1">{title}</p>
      {body && <p className="text-[#6B7280] text-sm mb-5 max-w-xs">{body}</p>}
      {action && <Btn onClick={action.onClick} size="sm">{action.label}</Btn>}
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
export function Skel({ className }) {
  return <div className={`animate-pulse bg-[#E8E9F2] rounded-xl ${className || ''}`} />
}

// ─── Property Picker ─────────────────────────────────────────────────────────
export function PropPicker({ properties, selectedId, onSelect }) {
  if (!properties?.length) return null
  return (
    <Select value={selectedId} onChange={e => onSelect(e.target.value)} className="h-9 text-xs min-w-[130px]">
      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Select>
  )
}

// ─── Section header ──────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 className="font-display text-xl font-bold text-[#0D0D12]">{title}</h1>
        {subtitle && <p className="text-[#6B7280] text-sm mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, color = 'brand', trend, sub }) {
  const colors = {
    brand:   'bg-brand-50 text-brand-600',
    green:   'bg-emerald-50 text-emerald-600',
    red:     'bg-red-50 text-red-600',
    amber:   'bg-amber-50 text-amber-600',
    purple:  'bg-violet-50 text-violet-600',
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[#6B7280] text-xs font-medium">{label}</p>
        {Icon && <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" strokeWidth={2} />
        </div>}
      </div>
      <p className="font-display text-2xl font-bold text-[#0D0D12]">{value}</p>
      {sub  && <p className="text-[#9CA3AF] text-xs mt-1">{sub}</p>}
      {trend !== undefined && (
        <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend >= 0 ? '+' : ''}{trend}% vs last month
        </p>
      )}
    </Card>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-brand-500' : 'bg-[#E8E9F2]'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'left-5' : 'left-0.5'}`} />
      </div>
      {label && <span className="text-sm text-[#374151]">{label}</span>}
    </label>
  )
}
