import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth)

r.get('/', asyncHandler(async (req, res) => {
  if (req.user.role === 'tenant') {
    const { data } = await db.from('complaints').select('*')
      .eq('tenant_id', req.user.id).order('created_at', { ascending: false })
    return res.json(data || [])
  }
  const { property_id } = req.query
  if (!property_id) return res.status(400).json({ error: 'property_id required' })
  const { data, error } = await db.from('complaints')
    .select('*, tenant:users!tenant_id(full_name,phone,profile_photo_url)')
    .eq('property_id', property_id).order('created_at', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  res.json(data || [])
}))

r.post('/', asyncHandler(async (req, res) => {
  const { title, description, category, urgency, property_id, photo_urls } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })

  let propId = property_id
  if (req.user.role === 'tenant') {
    const { data: t } = await db.from('tenancies').select('property_id').eq('tenant_id', req.user.id).eq('is_active', true).maybeSingle()
    if (!t) return res.status(400).json({ error: 'No active tenancy found' })
    propId = t.property_id
  }

  const { data, error } = await db.from('complaints').insert({
    title, description, category: category || 'other', urgency: urgency || 'moderate',
    property_id: propId, tenant_id: req.user.id, photo_urls: photo_urls || [], status: 'open',
  }).select().single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

r.patch('/:id', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { status, resolution_note, assigned_to } = req.body
  const update = {}
  if (status !== undefined) update.status = status
  if (resolution_note !== undefined) update.resolution_note = resolution_note
  if (assigned_to !== undefined) update.assigned_to = assigned_to
  if (status === 'resolved') { update.resolved_by = req.user.id; update.resolved_at = new Date().toISOString() }

  const { data, error } = await db.from('complaints').update(update).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

export default r
