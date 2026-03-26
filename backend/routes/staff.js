import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth, role('owner'))

r.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await db.from('users')
    .select('id,full_name,email,phone,role,staff_role_label,is_active,created_at')
    .eq('organization_id', req.user.organization_id)
    .in('role', ['manager', 'staff'])
    .order('created_at', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  res.json(data || [])
}))

r.patch('/:id', asyncHandler(async (req, res) => {
  const { is_active, staff_role_label, phone } = req.body
  const update = {}
  if (is_active !== undefined) update.is_active = is_active
  if (staff_role_label !== undefined) update.staff_role_label = staff_role_label
  if (phone !== undefined) update.phone = phone
  const { data, error } = await db.from('users').update(update).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

export default r
