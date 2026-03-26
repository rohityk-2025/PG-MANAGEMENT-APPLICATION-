import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BedDouble, Plus, Pencil, Trash2, Layers, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api'
import { Btn, Modal, Input, Empty, Skel, Card, SectionHeader } from '../../components/ui'
import { useProperty } from '../../hooks/useProperty'
import { useAuth } from '../../context/AuthContext'
import { formatRupees } from '../../lib/utils'
import toast from 'react-hot-toast'

// Status dot color per bed status
const BED_DOT = {
  vacant:        'bg-emerald-500',
  occupied:      'bg-red-500',
  notice_period: 'bg-amber-400',
  maintenance:   'bg-slate-400',
  reserved:      'bg-blue-500',
}

const ROOM_TYPE_STYLE = {
  single:    'bg-sky-50 text-sky-700 border border-sky-200',
  double:    'bg-violet-50 text-violet-700 border border-violet-200',
  triple:    'bg-amber-50 text-amber-700 border border-amber-200',
  dormitory: 'bg-rose-50 text-rose-700 border border-rose-200',
}

const EMPTY_ROOM = { floor_id: '', room_number: '', room_type: 'double', base_rent: '', bed_count: '' }
const EMPTY_FLOOR = { floor_number: '', floor_label: '' }

export default function Rooms() {
  const { properties, selectedId, selectedProperty, select } = useProperty()
  const { user } = useAuth()
  const qc = useQueryClient()

  const [roomModal, setRoomModal]   = useState(null) // null | 'add' | room object
  const [floorModal, setFloorModal] = useState(false)
  const [roomForm, setRoomForm]     = useState(EMPTY_ROOM)
  const [floorForm, setFloorForm]   = useState(EMPTY_FLOOR)
  const [expanded, setExpanded]     = useState({}) // which floor cards are expanded

  const setR = (k) => (e) => setRoomForm(f => ({ ...f, [k]: e.target.value }))
  const setF = (k) => (e) => setFloorForm(f => ({ ...f, [k]: e.target.value }))

  // Fetch floors with their rooms and beds
  const { data: floors = [], isLoading } = useQuery({
    queryKey: ['floors', selectedId],
    queryFn:  () => api.get(`/api/rooms/${selectedId}/floors`),
    enabled:  !!selectedId,
  })

  // Fetch all rooms (needed for room add/edit dropdown of floors)
  const { data: allRooms = [] } = useQuery({
    queryKey: ['rooms', selectedId],
    queryFn:  () => api.get(`/api/rooms?property_id=${selectedId}`),
    enabled:  !!selectedId,
  })

  const addFloor = useMutation({
    mutationFn: (d) => api.post('/api/rooms/floors', { ...d, property_id: selectedId, floor_number: Number(d.floor_number) }),
    onSuccess: () => { qc.invalidateQueries(['floors', selectedId]); setFloorModal(false); setFloorForm(EMPTY_FLOOR); toast.success('Floor added') },
    onError: (e) => toast.error(e.message),
  })

  const addRoom = useMutation({
    mutationFn: (d) => api.post('/api/rooms', { ...d, property_id: selectedId, base_rent: Number(d.base_rent) || 0, bed_count: Number(d.bed_count) || undefined }),
    onSuccess: () => { qc.invalidateQueries(['floors', selectedId]); qc.invalidateQueries(['rooms', selectedId]); setRoomModal(null); toast.success('Room added with beds') },
    onError: (e) => toast.error(e.message),
  })

  const editRoom = useMutation({
    mutationFn: ({ id, ...d }) => api.patch(`/api/rooms/${id}`, { ...d, base_rent: Number(d.base_rent) || 0 }),
    onSuccess: () => { qc.invalidateQueries(['floors', selectedId]); setRoomModal(null); toast.success('Room updated') },
    onError: (e) => toast.error(e.message),
  })

  const deleteRoom = useMutation({
    mutationFn: (id) => api.delete(`/api/rooms/${id}`),
    onSuccess: () => { qc.invalidateQueries(['floors', selectedId]); toast.success('Room removed') },
    onError: (e) => toast.error(e.message),
  })

  function openEditRoom(room) {
    setRoomForm({ floor_id: room.floor_id, room_number: room.room_number, room_type: room.room_type, base_rent: String(room.base_rent || ''), bed_count: '' })
    setRoomModal(room)
  }

  function saveRoom() {
    if (roomModal === 'add') addRoom.mutate(roomForm)
    else editRoom.mutate({ id: roomModal.id, room_number: roomForm.room_number, room_type: roomForm.room_type, base_rent: roomForm.base_rent })
  }

  function toggleFloor(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Summary counts across all floors
  const allBeds  = floors.flatMap(f => (f.rooms || []).flatMap(r => r.beds || []))
  const occupied = allBeds.filter(b => b.status === 'occupied').length
  const vacant   = allBeds.filter(b => b.status === 'vacant').length

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Rooms & Beds"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Property picker */}
            <select
              value={selectedId}
              onChange={e => select(e.target.value)}
              className="h-9 pl-3 pr-8 text-xs border border-[#E8E9F2] rounded-xl outline-none bg-white text-[#374151]"
            >
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Btn size="sm" variant="outline" onClick={() => setFloorModal(true)}>
              <Layers className="w-3.5 h-3.5" /> Add Floor
            </Btn>
            <Btn size="sm" onClick={() => { setRoomForm(EMPTY_ROOM); setRoomModal('add') }}>
              <Plus className="w-3.5 h-3.5" /> Add Room
            </Btn>
          </div>
        }
      />

      {/* Summary chips */}
      {allBeds.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            { l: 'Total Beds', v: allBeds.length,   c: 'bg-[#F0F1F5] text-[#374151]' },
            { l: 'Occupied',   v: occupied,           c: 'bg-red-50 text-red-600' },
            { l: 'Vacant',     v: vacant,             c: 'bg-emerald-50 text-emerald-700' },
            { l: 'Floors',     v: floors.length,      c: 'bg-blue-50 text-blue-700' },
          ].map(({ l, v, c }) => (
            <span key={l} className={`${c} text-xs font-semibold px-3 py-1.5 rounded-xl`}>
              {v} {l}
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <Skel key={i} className="h-32" />)}</div>
      ) : floors.length === 0 ? (
        <Empty
          icon={BedDouble}
          title="No floors yet"
          body="Add a floor first, then add rooms to it."
          action={{ label: 'Add Floor', onClick: () => setFloorModal(true) }}
        />
      ) : (
        <div className="space-y-3">
          {floors.map(floor => {
            const isOpen  = expanded[floor.id] !== false // default open
            const flBeds  = (floor.rooms || []).flatMap(r => r.beds || [])
            const flVacant = flBeds.filter(b => b.status === 'vacant').length

            return (
              <Card key={floor.id} className="overflow-hidden p-0">
                {/* Floor header row */}
                <button
                  onClick={() => toggleFloor(floor.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F4F5FA] transition-colors text-left"
                >
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                    : <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
                  }
                  <span className="font-display font-bold text-[#0D0D12]">{floor.floor_label}</span>
                  <span className="text-xs text-[#9CA3AF] ml-1">Floor {floor.floor_number}</span>
                  <span className="ml-auto text-xs text-[#9CA3AF]">
                    {floor.rooms?.length || 0} rooms · {flVacant} vacant
                  </span>
                </button>

                {/* Rooms grid */}
                {isOpen && (
                  <div className="px-4 pb-4">
                    {(!floor.rooms || floor.rooms.length === 0) ? (
                      <p className="text-xs text-[#9CA3AF] py-3 text-center">
                        No rooms on this floor.{' '}
                        <button
                          onClick={() => { setRoomForm({ ...EMPTY_ROOM, floor_id: floor.id }); setRoomModal('add') }}
                          className="text-brand-500 hover:underline"
                        >
                          Add one
                        </button>
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-1">
                        {floor.rooms.map(room => {
                          const beds = room.beds || []
                          const roomOccupied = beds.filter(b => b.status === 'occupied').length
                          return (
                            <div
                              key={room.id}
                              className="group relative bg-white border-2 border-[#E8E9F2] hover:border-brand-400 rounded-2xl p-3 transition-all"
                            >
                              {/* Room header */}
                              <div className="flex items-start justify-between mb-1.5">
                                <span className="font-display font-bold text-[#0D0D12] text-base leading-tight">
                                  {room.room_number}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-semibold capitalize ${ROOM_TYPE_STYLE[room.room_type] || 'bg-slate-50 text-slate-600'}`}>
                                  {room.room_type}
                                </span>
                              </div>
                              <p className="text-xs text-[#9CA3AF] font-medium mb-2">
                                {formatRupees(room.base_rent)}/mo
                              </p>

                              {/* Bed status dots */}
                              <div className="flex flex-wrap gap-1 mb-2">
                                {beds.map(bed => (
                                  <div
                                    key={bed.id}
                                    className={`w-5 h-5 rounded-md flex items-center justify-center ${BED_DOT[bed.status] || 'bg-slate-200'}`}
                                    title={`Bed ${bed.bed_number} — ${bed.status}`}
                                  >
                                    <span className="text-white font-bold text-[9px]">{bed.bed_number}</span>
                                  </div>
                                ))}
                                {beds.length === 0 && (
                                  <span className="text-[10px] text-[#9CA3AF]">No beds</span>
                                )}
                              </div>

                              <p className="text-[10px] text-[#9CA3AF]">
                                {roomOccupied}/{beds.length} occupied
                              </p>

                              {/* Edit/Delete buttons on hover */}
                              <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEditRoom(room)}
                                  className="flex-1 h-7 bg-[#F4F5FA] hover:bg-brand-50 rounded-lg transition-colors flex items-center justify-center"
                                >
                                  <Pencil className="w-3 h-3 text-[#6B7280]" />
                                </button>
                                <button
                                  onClick={() => { if (confirm(`Delete room ${room.room_number}?`)) deleteRoom.mutate(room.id) }}
                                  className="flex-1 h-7 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center"
                                >
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Floor Modal */}
      {floorModal && (
        <Modal title="Add Floor" onClose={() => setFloorModal(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Floor Number *" type="number" value={floorForm.floor_number} onChange={setF('floor_number')} placeholder="1" />
              <Input label="Label" value={floorForm.floor_label} onChange={setF('floor_label')} placeholder="Ground Floor" />
            </div>
            <div className="flex gap-2 pt-2">
              <Btn variant="outline" className="flex-1" onClick={() => setFloorModal(false)}>Cancel</Btn>
              <Btn className="flex-1" onClick={() => addFloor.mutate(floorForm)} loading={addFloor.isPending} disabled={!floorForm.floor_number}>
                Add Floor
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Add/Edit Room Modal */}
      {roomModal && (
        <Modal title={roomModal === 'add' ? 'Add Room' : `Edit Room ${roomModal.room_number}`} onClose={() => setRoomModal(null)}>
          <div className="space-y-3">
            {/* Floor selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Floor *</label>
              <select
                value={roomForm.floor_id}
                onChange={e => setRoomForm(f => ({ ...f, floor_id: e.target.value }))}
                className="w-full h-10 border border-[#E8E9F2] rounded-xl px-3.5 text-sm outline-none focus:border-brand-500"
              >
                <option value="">Select floor</option>
                {floors.map(fl => <option key={fl.id} value={fl.id}>{fl.floor_label} (Floor {fl.floor_number})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Room Number *" value={roomForm.room_number} onChange={setR('room_number')} placeholder="101" />
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Room Type</label>
                <select
                  value={roomForm.room_type}
                  onChange={setR('room_type')}
                  className="w-full h-10 border border-[#E8E9F2] rounded-xl px-3.5 text-sm outline-none focus:border-brand-500"
                >
                  {['single','double','triple','dormitory'].map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Monthly Rent (Rs.)" type="number" value={roomForm.base_rent} onChange={setR('base_rent')} placeholder="6000" />
              {roomModal === 'add' && (
                <Input label="Number of Beds" type="number" value={roomForm.bed_count} onChange={setR('bed_count')} placeholder="Auto by type" />
              )}
            </div>
            {roomModal === 'add' && (
              <p className="text-xs text-[#9CA3AF]">
                Leave beds blank to auto-create: single=1, double=2, triple=3. You can also enter a custom count.
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <Btn variant="outline" className="flex-1" onClick={() => setRoomModal(null)}>Cancel</Btn>
              <Btn
                className="flex-1"
                onClick={saveRoom}
                loading={addRoom.isPending || editRoom.isPending}
                disabled={!roomForm.room_number || (roomModal === 'add' && !roomForm.floor_id)}
              >
                {roomModal === 'add' ? 'Add Room' : 'Save Changes'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
