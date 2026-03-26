import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth)

// GET /api/properties  — list properties the current user can access
r.get('/', asyncHandler(async (req, res) => {
  let q = db.from('properties')
    .select('id,name,city,state,street_address,pin_code,logo_url,is_active,upi_id,upi_phone,contact_phone')
    .eq('is_active', true)

  if (req.user.role === 'owner') {
    // Owner always gets their org id fresh from DB in case JWT was issued before org was linked
    const orgId = await getOrgId(req.user)
    if (!orgId) return res.json([])
    q = q.eq('organization_id', orgId)
  } else if (req.user.role === 'manager') {
    // Manager only sees properties they are explicitly assigned to
    const { data: assigned } = await db.from('property_staff')
      .select('property_id').eq('user_id', req.user.id)
    const ids = assigned?.map(a => a.property_id) || []
    if (!ids.length) return res.json([])
    q = q.in('id', ids)
  }

  const { data, error } = await q.order('name')
  if (error) return res.status(400).json({ error: error.message })
  res.json(data || [])
}))

// GET /api/properties/:id  — full property detail with floors, rooms, beds
r.get('/:id', asyncHandler(async (req, res) => {
  const { data: property, error } = await db.from('properties')
    .select(`
      *,
      floors (
        id, floor_number, floor_label,
        rooms (
          id, room_number, room_type, base_rent, is_active,
          beds ( id, bed_number, status )
        )
      )
    `)
    .eq('id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: 'Property not found' })

  // Sort floors by number, rooms alphabetically for consistent display order
  if (property.floors) {
    property.floors.sort((a, b) => a.floor_number - b.floor_number)
    property.floors.forEach(f => {
      if (f.rooms) f.rooms.sort((a, b) => a.room_number.localeCompare(b.room_number))
    })
  }

  res.json({ property })
}))

// POST /api/properties  — create a new property under the owner's organization
r.post('/', role('owner'), asyncHandler(async (req, res) => {
  const { name, street_address, city, state, pin_code, contact_phone, upi_id, upi_phone, logo_url } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Property name is required' })

  // Always fetch org_id fresh from DB — the JWT may be stale if issued before
  // the organization was created during the same signup flow
  const orgId = await getOrgId(req.user)
  if (!orgId) {
    return res.status(400).json({
      error: 'No organization linked to your account. Please sign out and sign back in.',
    })
  }

  const { data, error } = await db.from('properties').insert({
    name:            name.trim(),
    street_address:  street_address  || null,
    city:            city            || null,
    state:           state           || null,
    pin_code:        pin_code        || null,
    contact_phone:   contact_phone   || null,
    upi_id:          upi_id          || null,
    upi_phone:       upi_phone       || null,
    logo_url:        logo_url        || null,
    organization_id: orgId,
    is_active:       true,
  }).select().single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

// PATCH /api/properties/:id  — update property details
r.patch('/:id', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const allowed = ['name','street_address','city','state','pin_code','contact_phone','upi_id','upi_phone','logo_url','qr_code_url']
  const update = {}
  allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k] })

  const { data, error } = await db.from('properties')
    .update(update).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

// DELETE /api/properties/:id  — soft-delete (mark inactive, never hard delete)
r.delete('/:id', role('owner'), asyncHandler(async (req, res) => {
  const orgId = await getOrgId(req.user)
  const { data, error } = await db.from('properties')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .eq('organization_id', orgId)
    .select('id')
    .single()

  if (error || !data) return res.status(404).json({ error: 'Property not found or not yours' })
  res.json({ ok: true })
}))

// Helper: get the organization_id for a user, always from DB to avoid stale JWT
async function getOrgId(jwtUser) {
  // If the JWT already has it, use it directly (fast path)
  if (jwtUser.organization_id) return jwtUser.organization_id

  // Otherwise fetch fresh from DB (happens when JWT was issued during signup
  // before the organization row was created and linked)
  const { data } = await db.from('users')
    .select('organization_id').eq('id', jwtUser.id).single()
  return data?.organization_id || null
}

export default r
