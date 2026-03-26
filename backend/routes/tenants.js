import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth)

// GET /api/tenants?property_id=xxx  — list active tenancies for a property
r.get('/', asyncHandler(async (req, res) => {
  const { property_id } = req.query
  if (!property_id) return res.status(400).json({ error: 'property_id is required' })

  const { data, error } = await db.from('tenancies').select(`
    id, check_in_date, check_out_date, rent_amount, deposit_amount,
    deposit_paid, notice_given_date, is_active, notes,
    tenant:users!tenant_id (
      id, full_name, email, phone, whatsapp_no, profile_photo_url,
      is_approved, occupation, institute_or_company, gender,
      aadhaar_front_url, aadhaar_back_url, pan_card_url, driving_license_url,
      passport_url, date_of_birth, permanent_address, guardian_name, guardian_phone
    ),
    room:rooms ( id, room_number, room_type, base_rent ),
    bed:beds ( id, bed_number, status )
  `)
  .eq('property_id', property_id)
  .eq('is_active', true)
  .order('created_at', { ascending: false })

  if (error) return res.status(400).json({ error: error.message })
  res.json(data || [])
}))

// GET /api/tenants/:id  — full tenant detail (used in TenantDetail page)
r.get('/:id', asyncHandler(async (req, res) => {
  const { data: tenancy, error } = await db.from('tenancies').select(`
    id, check_in_date, check_out_date, rent_amount, deposit_amount,
    deposit_paid, notice_given_date, is_active, notes, payment_frequency, rent_due_day,
    tenant:users!tenant_id (
      id, full_name, email, phone, whatsapp_no, profile_photo_url,
      is_approved, occupation, institute_or_company, gender, date_of_birth,
      permanent_address, current_city, guardian_name, guardian_phone, guardian_address,
      aadhaar_front_url, aadhaar_back_url, pan_card_url, driving_license_url, passport_url,
      created_at
    ),
    room:rooms ( id, room_number, room_type, base_rent ),
    bed:beds ( id, bed_number ),
    property:properties ( id, name, logo_url )
  `)
  .eq('tenant_id', req.params.id)
  .eq('is_active', true)
  .maybeSingle()

  if (error) return res.status(400).json({ error: error.message })

  // Fetch verification record separately
  const { data: verification } = await db.from('background_verifications')
    .select('*').eq('tenant_id', req.params.id).maybeSingle()

  // Fetch rent records for this tenant
  const { data: rentRecords } = await db.from('rent_records')
    .select('id, month, year, month_year, amount_due, amount_paid, status, payment_mode, paid_date, receipt_number, transaction_id, payment_screenshot_url')
    .eq('tenant_id', req.params.id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  // Fetch complaints
  const { data: complaints } = await db.from('complaints')
    .select('id, title, description, category, urgency, status, created_at')
    .eq('tenant_id', req.params.id)
    .order('created_at', { ascending: false })

  res.json({
    tenancy,
    user: tenancy?.tenant,
    verification: verification || null,
    rentRecords: rentRecords || [],
    complaints:  complaints  || [],
  })
}))

// POST /api/tenants  — create user account and assign bed
r.post('/', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const {
    full_name, email, password, phone, whatsapp_no, property_id,
    room_id, bed_id, rent_amount, deposit_amount, check_in_date,
    occupation, gender, institute_or_company, permanent_address,
    guardian_name, guardian_phone,
  } = req.body

  if (!full_name || !email || !password || !property_id)
    return res.status(400).json({ error: 'full_name, email, password, property_id are required' })

  // Check if email already exists
  const { data: existing } = await db.from('users').select('id,role').eq('email', email).maybeSingle()
  let userId

  if (existing) {
    // Allow re-assigning an existing user who is already a tenant in this system
    if (existing.role !== 'tenant') return res.status(400).json({ error: 'This email belongs to a non-tenant user' })
    userId = existing.id
  } else {
    // Create fresh user account
    const password_hash = await bcrypt.hash(password, 12)
    const { data: newUser, error: ue } = await db.from('users').insert({
      full_name, email, password_hash,
      phone: phone || null, whatsapp_no: whatsapp_no || null,
      role: 'tenant', is_approved: false, is_active: true,
      occupation: occupation || null, gender: gender || null,
      institute_or_company: institute_or_company || null,
      permanent_address: permanent_address || null,
      guardian_name: guardian_name || null, guardian_phone: guardian_phone || null,
    }).select('id').single()
    if (ue) return res.status(400).json({ error: ue.message })
    userId = newUser.id
  }

  // Create the tenancy record linking user to bed
  const { data: tenancy, error: te } = await db.from('tenancies').insert({
    tenant_id:    userId,
    property_id,
    room_id:      room_id   || null,
    bed_id:       bed_id    || null,
    rent_amount:  Number(rent_amount) || 0,
    deposit_amount: Number(deposit_amount) || 0,
    check_in_date: check_in_date || new Date().toISOString().split('T')[0],
    is_active:    true,
    assigned_by:  req.user.id,
  }).select('id').single()

  if (te) return res.status(400).json({ error: te.message })

  // Auto-create a background verification record for this tenant
  await db.from('background_verifications').upsert({ tenant_id: userId }, { onConflict: 'tenant_id', ignoreDuplicates: true })

  res.json({ ok: true, tenancy_id: tenancy.id })
}))

// PATCH /api/tenants/:id  — update tenancy (checkout, notice, etc.)
r.patch('/:id', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { is_active, check_out_date, notice_given_date, notes, rent_amount, deposit_amount } = req.body
  const update = {}
  if (is_active         !== undefined) update.is_active         = is_active
  if (check_out_date    !== undefined) update.check_out_date    = check_out_date
  if (notice_given_date !== undefined) update.notice_given_date = notice_given_date
  if (notes             !== undefined) update.notes             = notes
  if (rent_amount       !== undefined) update.rent_amount       = Number(rent_amount)
  if (deposit_amount    !== undefined) update.deposit_amount    = Number(deposit_amount)

  const { data, error } = await db.from('tenancies').update(update).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

// POST /api/tenants/approve/:user_id  — approve tenant after verification
r.post('/approve/:user_id', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { data, error } = await db.from('users').update({ is_approved: true }).eq('id', req.params.user_id).select('id,full_name,is_approved').single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

export default r

// PATCH /api/tenants/me/documents  — tenant uploads their own documents
r.patch('/me/documents', asyncHandler(async (req, res) => {
  const allowed = ['profile_photo_url','aadhaar_front_url','aadhaar_back_url','pan_card_url','driving_license_url','passport_url']
  const updates = {}
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields provided' })
  const { data, error } = await db.from('users').update(updates).eq('id', req.user.id).select('id,full_name').single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))
