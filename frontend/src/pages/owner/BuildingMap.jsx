import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, BedDouble, Users, CheckCircle2, AlertCircle, Wrench, Clock, Filter } from 'lucide-react'
import { api } from '../../lib/api'
import { useProperty } from '../../hooks/useProperty'
import { Card, Empty, Skel, SectionHeader, PropPicker, Badge, Avatar } from '../../components/ui'
import { Modal } from '../../components/ui'
import { formatRupees, formatDate } from '../../lib/utils'

// Bed icon colors keyed by status — used throughout the visual map
const BED_STATUS_CONFIG = {
  vacant:        { bg: '#22C55E', text: '#FFFFFF', border: '#16A34A', label: 'Vacant',        icon: CheckCircle2 },
  occupied:      { bg: '#EF4444', text: '#FFFFFF', border: '#DC2626', label: 'Occupied',       icon: Users       },
  notice_period: { bg: '#F59E0B', text: '#FFFFFF', border: '#D97706', label: 'Notice Period',  icon: Clock       },
  maintenance:   { bg: '#94A3B8', text: '#FFFFFF', border: '#64748B', label: 'Maintenance',    icon: Wrench      },
  reserved:      { bg: '#3B82F6', text: '#FFFFFF', border: '#2563EB', label: 'Reserved',       icon: AlertCircle },
}

// A single bed icon rendered inside the room card on the map
function BedIcon({ bed, onClick }) {
  const cfg = BED_STATUS_CONFIG[bed.status] || BED_STATUS_CONFIG.vacant

  return (
    <button
      onClick={() => onClick(bed)}
      title={`Bed ${bed.bed_number} — ${cfg.label}${bed.tenant ? ` (${bed.tenant.full_name})` : ''}`}
      className="relative group flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:scale-110 hover:shadow-lg active:scale-95 cursor-pointer"
      style={{ background: cfg.bg + '18', border: `2px solid ${cfg.border}` }}
    >
      {/* Bed icon shape made with CSS */}
      <div className="relative w-10 h-7 rounded-md flex items-center justify-center" style={{ background: cfg.bg }}>
        {/* Headboard */}
        <div className="absolute left-0 top-0 bottom-0 w-3 rounded-l-md" style={{ background: cfg.border }} />
        {/* Pillow */}
        <div className="absolute left-3 top-1 w-3 h-2.5 bg-white/40 rounded-sm" />
        {/* Mattress lines */}
        <div className="absolute left-3 bottom-1 right-1 h-0.5 bg-white/30 rounded" />
      </div>

      {/* Bed number label */}
      <span className="font-mono text-xs font-bold leading-none" style={{ color: cfg.border }}>
        {bed.bed_number}
      </span>

      {/* Tenant name tooltip on hover */}
      {bed.tenant && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1A1A2E] text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {bed.tenant.full_name}
        </div>
      )}
    </button>
  )
}

// A room card showing all its beds
function RoomCard({ room }) {
  const [selectedBed, setSelectedBed] = useState(null)
  const occupiedCount = room.beds?.filter(b => b.status === 'occupied').length || 0
  const allOccupied   = occupiedCount === room.beds?.length

  return (
    <>
      <Card className={`p-3 ${allOccupied ? 'border-red-200 bg-red-50/30' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="font-display font-bold text-[#0D0D12] text-sm">Room {room.room_number}</span>
            <span className="ml-2 text-xs text-[#9CA3AF] capitalize">{room.room_type}</span>
          </div>
          <span className="text-xs text-[#6B7280]">{formatRupees(room.base_rent)}/mo</span>
        </div>

        {/* Bed icons grid */}
        <div className="flex flex-wrap gap-2 mt-2">
          {(room.beds || []).map(bed => (
            <BedIcon key={bed.id} bed={bed} onClick={setSelectedBed} />
          ))}
          {(!room.beds || room.beds.length === 0) && (
            <p className="text-xs text-[#9CA3AF] italic">No beds configured</p>
          )}
        </div>

        {/* Occupancy bar */}
        {room.beds?.length > 0 && (
          <div className="mt-3 h-1 bg-[#E8E9F2] rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${(occupiedCount / room.beds.length) * 100}%` }}
            />
          </div>
        )}
      </Card>

      {/* Bed detail modal */}
      {selectedBed && (
        <Modal title={`Bed ${selectedBed.bed_number} — Room ${room.room_number}`} onClose={() => setSelectedBed(null)}>
          <BedDetailPanel bed={selectedBed} onClose={() => setSelectedBed(null)} />
        </Modal>
      )}
    </>
  )
}

// Panel shown inside the modal when a bed is clicked
function BedDetailPanel({ bed, onClose }) {
  const cfg = BED_STATUS_CONFIG[bed.status] || BED_STATUS_CONFIG.vacant

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: cfg.bg + '15' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: cfg.bg }}>
          <BedDouble className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-[#0D0D12]">Bed {bed.bed_number}</p>
          <Badge status={bed.status} />
        </div>
      </div>

      {/* Tenant info if occupied */}
      {bed.tenant && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Avatar name={bed.tenant.full_name} src={bed.tenant.profile_photo_url} size={12} />
            <div>
              <p className="font-semibold text-[#0D0D12]">{bed.tenant.full_name}</p>
              <p className="text-xs text-[#6B7280]">{bed.tenant.phone}</p>
            </div>
          </div>
          {bed.check_in && (
            <div className="mt-3 pt-3 border-t border-[#E8E9F2] grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[#9CA3AF]">Check-in</p>
                <p className="font-medium text-[#374151]">{formatDate(bed.check_in)}</p>
              </div>
              {bed.rent_amount && (
                <div>
                  <p className="text-[#9CA3AF]">Rent</p>
                  <p className="font-medium text-[#374151]">{formatRupees(bed.rent_amount)}/mo</p>
                </div>
              )}
              {bed.notice_given && (
                <div className="col-span-2">
                  <p className="text-amber-600 font-medium">Notice given: {formatDate(bed.notice_given)}</p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {bed.status === 'vacant' && (
        <p className="text-center text-[#22C55E] font-medium text-sm py-2">This bed is available for new tenant</p>
      )}
    </div>
  )
}

// Status filter button
function FilterBtn({ status, active, count, onClick }) {
  const cfg = BED_STATUS_CONFIG[status]
  return (
    <button
      onClick={() => onClick(active ? 'all' : status)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border-2 ${
        active
          ? 'text-white shadow-sm'
          : 'bg-white text-[#374151] border-[#E8E9F2] hover:border-[#C4C8E8]'
      }`}
      style={active ? { background: cfg.bg, borderColor: cfg.border } : {}}
    >
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.bg }} />
      {cfg.label}
      {count > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${active ? 'bg-white/30' : 'bg-[#F4F5FA]'}`}>{count}</span>}
    </button>
  )
}

export default function BuildingMap() {
  const { properties, selectedId, select } = useProperty()
  const [filter, setFilter] = useState('all')

  // Fetch the full building map data from the map endpoint
  const { data: mapData, isLoading } = useQuery({
    queryKey: ['building-map', selectedId, filter],
    queryFn: () => api.get(`/api/map/${selectedId}?filter=${filter}`),
    enabled: !!selectedId,
  })

  const floors  = mapData?.floors  || []
  const summary = mapData?.summary || {}

  return (
    <div className="space-y-5 pb-10">
      <SectionHeader
        title="Building Map"
        subtitle="Visual overview of all floors, rooms, and beds"
        right={<PropPicker properties={properties} selectedId={selectedId} onSelect={select} />}
      />

      {/* Summary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { key: 'total',         label: 'Total Beds',     color: '#5B6AF0' },
          { key: 'occupied',      label: 'Occupied',       color: '#EF4444' },
          { key: 'vacant',        label: 'Vacant',         color: '#22C55E' },
          { key: 'notice_period', label: 'Notice Period',  color: '#F59E0B' },
          { key: 'maintenance',   label: 'Maintenance',    color: '#94A3B8' },
        ].map(s => (
          <Card key={s.key} className="p-3 text-center">
            <p className="font-display text-2xl font-bold" style={{ color: s.color }}>{summary[s.key] || 0}</p>
            <p className="text-xs text-[#6B7280] mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filter bar — clicking a filter shows only beds of that type */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] mr-1">
          <Filter className="w-3.5 h-3.5" /> Filter:
        </span>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${filter === 'all' ? 'bg-brand-500 text-white border-brand-600' : 'bg-white text-[#374151] border-[#E8E9F2] hover:border-[#C4C8E8]'}`}
        >
          All Beds
        </button>
        {Object.keys(BED_STATUS_CONFIG).map(status => (
          <FilterBtn
            key={status}
            status={status}
            active={filter === status}
            count={summary[status] || 0}
            onClick={setFilter}
          />
        ))}
      </div>

      {/* Building floors and rooms */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="space-y-2">
              <Skel className="h-6 w-32" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1,2,3,4].map(j => <Skel key={j} className="h-28" />)}
              </div>
            </div>
          ))}
        </div>
      ) : floors.length === 0 ? (
        <Empty icon={Building2} title="No floors added yet" body="Add floors and rooms to see the visual building map." />
      ) : (
        <div className="space-y-6">
          {floors.map(floor => (
            <div key={floor.id}>
              {/* Floor header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-[#0D0D12]">{floor.floor_label}</h3>
                  <p className="text-xs text-[#9CA3AF]">{floor.rooms?.length || 0} rooms on this floor</p>
                </div>
              </div>

              {/* Rooms grid */}
              {(!floor.rooms || floor.rooms.length === 0) ? (
                <p className="text-sm text-[#9CA3AF] italic pl-11">No rooms on this floor yet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pl-11">
                  {floor.rooms.map(room => (
                    <RoomCard key={room.id} room={room} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Color legend */}
      <Card className="p-4">
        <p className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-3">Bed Status Legend</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(BED_STATUS_CONFIG).map(([status, cfg]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="w-5 h-4 rounded" style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }} />
              <span className="text-xs text-[#374151]">{cfg.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
