import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth)

// GET /api/rent?property_id=xxx&month=6&year=2025
r.get('/', asyncHandler(async (req, res) => {
  const { property_id, month, year, tenant_id } = req.query

  if (req.user.role === 'tenant') {
    const { data } = await db.from('rent_records').select('*')
      .eq('tenant_id', req.user.id).order('year', { ascending: false }).order('month', { ascending: false })
    return res.json({ records: data || [] })
  }

  let q = db.from('rent_records').select(`
    id, month, year, month_year, amount_due, amount_paid, status,
    payment_mode, paid_date, receipt_number, transaction_id, payment_screenshot_url,
    tenant:users!tenant_id ( full_name, phone, profile_photo_url ),
    tenancy:tenancies!tenancy_id ( room:rooms(room_number), bed:beds(bed_number) )
  `).order('year', { ascending: false }).order('month', { ascending: false })

  if (property_id && property_id !== 'all') q = q.eq('property_id', property_id)
  if (month)     q = q.eq('month', Number(month))
  if (year)      q = q.eq('year', Number(year))
  if (tenant_id) q = q.eq('tenant_id', tenant_id)

  const { data, error } = await q
  if (error) return res.status(400).json({ error: error.message })
  res.json({ records: data || [] })
}))

// POST /api/rent/generate  — generate rent records for all active tenants in a property for a given month
r.post('/generate', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { property_id, month, year } = req.body
  if (!property_id || !month || !year) return res.status(400).json({ error: 'property_id, month, year required' })

  // Fetch all active tenancies for this property
  const { data: tenancies } = await db.from('tenancies')
    .select('id,tenant_id,rent_amount').eq('property_id', property_id).eq('is_active', true)
  if (!tenancies?.length) return res.status(400).json({ error: 'No active tenants found' })

  // Skip tenants who already have a record for this month
  const { data: existing } = await db.from('rent_records')
    .select('tenancy_id').eq('property_id', property_id).eq('month', month).eq('year', year)
  const existingIds = new Set((existing || []).map(e => e.tenancy_id))

  const newRecords = tenancies
    .filter(t => !existingIds.has(t.id))
    .map(t => ({
      tenancy_id:  t.id,
      tenant_id:   t.tenant_id,
      property_id,
      month:       Number(month),
      year:        Number(year),
      amount_due:  t.rent_amount,
      status:      'pending',
    }))

  if (!newRecords.length) return res.json({ generated: 0, message: 'Records already exist for this month' })

  const { data, error } = await db.from('rent_records').insert(newRecords).select()
  if (error) return res.status(400).json({ error: error.message })
  res.json({ generated: data.length })
}))

// POST /api/rent/:id/confirm  — manager marks a payment as confirmed/paid
r.post('/:id/confirm', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { amount_paid, paid_date, payment_mode, transaction_id, notes } = req.body

  const { data, error } = await db.from('rent_records').update({
    status:        'paid',
    amount_paid:   Number(amount_paid),
    paid_date:     paid_date || new Date().toISOString().split('T')[0],
    payment_mode:  payment_mode || 'cash',
    transaction_id: transaction_id || null,
    notes:          notes || null,
    confirmed_by:   req.user.id,
    confirmed_at:   new Date().toISOString(),
  }).eq('id', req.params.id).select().single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

// POST /api/rent/:id/screenshot  — tenant uploads payment screenshot
r.post('/:id/screenshot', asyncHandler(async (req, res) => {
  const { screenshot_url } = req.body
  if (!screenshot_url) return res.status(400).json({ error: 'screenshot_url required' })

  const { data, error } = await db.from('rent_records').update({
    payment_screenshot_url: screenshot_url,
    status: 'pending_confirmation',
  }).eq('id', req.params.id).eq('tenant_id', req.user.id).select().single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

r.patch('/:id/overdue', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { data, error } = await db.from('rent_records').update({ status: 'overdue' }).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

export default r

// GET /api/rent/my  — tenant gets their own rent records (clean dedicated endpoint)
r.get('/my', asyncHandler(async (req, res) => {
  const { data, error } = await db.from('rent_records')
    .select('id, month, year, month_year, amount_due, amount_paid, status, payment_mode, paid_date, receipt_number, transaction_id, payment_screenshot_url, due_date')
    .eq('tenant_id', req.user.id)
    .order('year',  { ascending: false })
    .order('month', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  res.json(data || [])
}))

// PATCH /api/rent/:id/submit  — tenant submits payment screenshot + txn ID
// This moves the record to pending_confirmation status for the manager to confirm
r.patch('/:id/submit', asyncHandler(async (req, res) => {
  const { payment_screenshot_url, transaction_id } = req.body
  if (!transaction_id) return res.status(400).json({ error: 'Transaction ID is required' })

  // Make sure this record belongs to the requesting tenant
  const { data: record } = await db.from('rent_records')
    .select('id, tenant_id, status')
    .eq('id', req.params.id)
    .single()

  if (!record) return res.status(404).json({ error: 'Record not found' })
  if (record.tenant_id !== req.user.id) return res.status(403).json({ error: 'Not your record' })
  if (record.status === 'paid') return res.status(400).json({ error: 'Already marked as paid' })

  const { data, error } = await db.from('rent_records')
    .update({
      payment_screenshot_url: payment_screenshot_url || null,
      transaction_id,
      status: 'pending_confirmation',
    })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))
