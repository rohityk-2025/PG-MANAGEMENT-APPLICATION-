import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth)

r.get('/', asyncHandler(async (req, res) => {
  const { property_id } = req.query
  let q = db.from('broadcasts').select('*, sent_by_user:users!sent_by(full_name)').order('created_at', { ascending: false })
  if (property_id) q = q.eq('property_id', property_id)
  const { data, error } = await q
  if (error) return res.status(400).json({ error: error.message })
  res.json(data || [])
}))

r.post('/', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { title, message, property_id, is_important, audience_type } = req.body
  if (!title || !message || !property_id) return res.status(400).json({ error: 'title, message, property_id required' })
  const { data, error } = await db.from('broadcasts').insert({
    title, message, property_id, is_important: !!is_important,
    audience_type: audience_type || 'all', sent_by: req.user.id,
  }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

r.delete('/:id', role('owner', 'manager'), asyncHandler(async (req, res) => {
  await db.from('broadcasts').delete().eq('id', req.params.id)
  res.json({ ok: true })
}))

export default r

// GET /api/broadcasts/my  — get broadcasts for the tenant's own property
r.get('/my', asyncHandler(async (req, res) => {
  // Find the tenant's active tenancy to get their property
  const { data: tenancy } = await db.from('tenancies')
    .select('property_id')
    .eq('tenant_id', req.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!tenancy) return res.json([])

  const { data, error } = await db.from('broadcasts')
    .select('id, title, message, is_important, audience_type, created_at')
    .eq('property_id', tenancy.property_id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(400).json({ error: error.message })
  res.json(data || [])
}))
