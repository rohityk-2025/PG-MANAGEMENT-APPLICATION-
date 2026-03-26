import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth)

// Proxy to rent records for backward compatibility
r.get('/', asyncHandler(async (req, res) => {
  const { property_id, month, year } = req.query
  let q = db.from('rent_records').select(`
    id, month, year, amount_due, amount_paid, status, payment_mode, paid_date,
    tenant:users!tenant_id(full_name,phone), tenancy:tenancies!tenancy_id(room:rooms(room_number))
  `).order('created_at', { ascending: false })
  if (property_id) q = q.eq('property_id', property_id)
  if (month) q = q.eq('month', Number(month))
  if (year)  q = q.eq('year',  Number(year))
  const { data, error } = await q
  if (error) return res.status(400).json({ error: error.message })
  res.json(data || [])
}))

export default r
