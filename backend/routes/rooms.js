import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth)

// GET /api/rooms?property_id=xxx  — list all rooms with their beds for a property
r.get('/', asyncHandler(async (req, res) => {
  const { property_id } = req.query
  if (!property_id) return res.status(400).json({ error: 'property_id is required' })

  const { data, error } = await db.from('rooms')
    .select(`
      id, room_number, room_type, base_rent, is_active, floor_id,
      floors ( id, floor_number, floor_label ),
      beds ( id, bed_number, status )
    `)
    .eq('property_id', property_id)
    .eq('is_active', true)
    .order('room_number')

  if (error) return res.status(400).json({ error: error.message })
  res.json(data || [])
}))

// POST /api/rooms  — create a room and auto-generate the beds based on room type
r.post('/', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { property_id, floor_id, room_number, room_type, base_rent, bed_count, amenities } = req.body
  if (!property_id || !floor_id || !room_number)
    return res.status(400).json({ error: 'property_id, floor_id, and room_number are required' })

  // Create the room first
  const { data: room, error: roomErr } = await db.from('rooms').insert({
    property_id, floor_id, room_number,
    room_type: room_type || 'double',
    base_rent: Number(base_rent) || 0,
    amenities: amenities || {},
  }).select().single()

  if (roomErr) return res.status(400).json({ error: roomErr.message })

  // Determine how many beds to create
  // Owner can specify a custom count or we default by room type
  const typeDefaults = { single: 1, double: 2, triple: 3, dormitory: 6 }
  const numBeds = Number(bed_count) || typeDefaults[room_type] || 2

  // Create each bed with a label like A, B, C or 1, 2, 3
  const bedLabels = ['A','B','C','D','E','F','G','H']
  const bedInserts = Array.from({ length: numBeds }, (_, i) => ({
    room_id:    room.id,
    property_id,
    bed_number: bedLabels[i] || String(i + 1),
    status:     'vacant',
  }))

  const { error: bedErr } = await db.from('beds').insert(bedInserts)
  if (bedErr) return res.status(400).json({ error: bedErr.message })

  // Return the room with its fresh beds
  const { data: full } = await db.from('rooms')
    .select('*, floors(*), beds(*)')
    .eq('id', room.id).single()

  res.json(full)
}))

// PATCH /api/rooms/:id  — update room details
r.patch('/:id', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { room_number, room_type, base_rent, is_active, amenities } = req.body
  const update = {}
  if (room_number !== undefined) update.room_number = room_number
  if (room_type   !== undefined) update.room_type   = room_type
  if (base_rent   !== undefined) update.base_rent   = Number(base_rent)
  if (is_active   !== undefined) update.is_active   = is_active
  if (amenities   !== undefined) update.amenities   = amenities

  const { data, error } = await db.from('rooms').update(update).eq('id', req.params.id).select('*, beds(*)').single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

// DELETE /api/rooms/:id  — only allowed if all beds are vacant
r.delete('/:id', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { data: beds } = await db.from('beds').select('status').eq('room_id', req.params.id)
  const hasOccupied = beds?.some(b => b.status === 'occupied' || b.status === 'notice_period')
  if (hasOccupied) return res.status(400).json({ error: 'Cannot delete a room with occupied or notice-period beds' })

  await db.from('rooms').update({ is_active: false }).eq('id', req.params.id)
  res.json({ ok: true })
}))

// GET /api/rooms/:property_id/floors  — fetch floors with rooms for this property
r.get('/:property_id/floors', asyncHandler(async (req, res) => {
  const { data: floors, error } = await db.from('floors')
    .select(`
      id, floor_number, floor_label,
      rooms ( id, room_number, room_type, base_rent, beds(id, bed_number, status) )
    `)
    .eq('property_id', req.params.property_id)
    .order('floor_number')

  if (error) return res.status(400).json({ error: error.message })
  res.json(floors || [])
}))

// POST /api/rooms/floors  — add a new floor to a property
r.post('/floors', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { property_id, floor_number, floor_label } = req.body
  if (!property_id || floor_number === undefined)
    return res.status(400).json({ error: 'property_id and floor_number are required' })

  const { data, error } = await db.from('floors').insert({
    property_id, floor_number, floor_label: floor_label || `Floor ${floor_number}`,
  }).select().single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

export default r
