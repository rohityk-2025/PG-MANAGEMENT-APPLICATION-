import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'

const r = Router()

// Build a JWT containing just enough info to avoid extra DB lookups per request
const signToken = (user) => jwt.sign(
  {
    id:              user.id,
    email:           user.email,
    role:            user.role,
    full_name:       user.full_name,
    organization_id: user.organization_id,
    is_approved:     user.is_approved,
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
)

// POST /api/auth/register  — self-signup for tenants only
// Manager/Owner accounts are created by the owner through the dashboard
r.post('/register', asyncHandler(async (req, res) => {
  const {
    full_name, email, password, phone, whatsapp_no,
    date_of_birth, gender, occupation, institute_or_company,
    permanent_address, guardian_name, guardian_phone,
  } = req.body

  if (!full_name || !email || !password)
    return res.status(400).json({ error: 'Full name, email, and password are required' })

  // Check if email is already taken
  const { data: exists } = await db.from('users').select('id').eq('email', email).maybeSingle()
  if (exists) return res.status(400).json({ error: 'This email is already registered' })

  const password_hash = await bcrypt.hash(password, 12)

  const { data: user, error } = await db.from('users').insert({
    full_name, email, password_hash, phone: phone || null,
    whatsapp_no: whatsapp_no || null, role: 'tenant',
    date_of_birth: date_of_birth || null, gender: gender || null,
    occupation: occupation || null, institute_or_company: institute_or_company || null,
    permanent_address: permanent_address || null,
    guardian_name: guardian_name || null, guardian_phone: guardian_phone || null,
    is_approved: false, is_active: true,
  }).select('id,full_name,email,role,phone,organization_id,is_approved').single()

  if (error) return res.status(400).json({ error: error.message })

  res.json({ token: signToken(user), user })
}))

// POST /api/auth/login  — works for all roles
r.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' })

  const { data: user } = await db.from('users')
    .select('*').eq('email', email).eq('is_active', true).maybeSingle()

  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: 'Invalid email or password' })

  const { password_hash, ...safeUser } = user
  res.json({ token: signToken(safeUser), user: safeUser })
}))

// GET /api/auth/me  — fetch fresh user data (called on app load)
r.get('/me', auth, asyncHandler(async (req, res) => {
  const { data, error } = await db.from('users')
    .select('id,full_name,email,role,phone,whatsapp_no,profile_photo_url,organization_id,is_approved,is_active,created_at')
    .eq('id', req.user.id).single()
  if (error) return res.status(404).json({ error: 'User not found' })
  res.json(data)
}))

// POST /api/auth/create-owner  — initial owner setup (no auth needed for first account)
// Owner creates their account along with an organization
r.post('/create-owner', asyncHandler(async (req, res) => {
  const { full_name, email, password, phone, org_name } = req.body
  if (!full_name || !email || !password || !org_name)
    return res.status(400).json({ error: 'Full name, email, password, and PG name are required' })

  const { data: exists } = await db.from('users').select('id').eq('email', email).maybeSingle()
  if (exists) return res.status(400).json({ error: 'Email already registered' })

  const password_hash = await bcrypt.hash(password, 12)

  // Create organization first, then the owner user
  const { data: org, error: orgErr } = await db.from('organizations')
    .insert({ name: org_name }).select().single()
  if (orgErr) return res.status(400).json({ error: orgErr.message })

  const { data: user, error: userErr } = await db.from('users').insert({
    full_name, email, password_hash, phone: phone || null,
    role: 'owner', organization_id: org.id, is_approved: true, is_active: true,
  }).select('id,full_name,email,role,organization_id,is_approved').single()
  if (userErr) return res.status(400).json({ error: userErr.message })

  // Link organization back to the owner now that we have the user id
  await db.from('organizations').update({ owner_id: user.id }).eq('id', org.id)

  // Sign token AFTER org is linked so organization_id is always present in the JWT
  const fullUser = { ...user, organization_id: org.id }
  res.json({ token: signToken(fullUser), user: fullUser })
}))

// POST /api/auth/create-staff  — owner creates manager or staff account
r.post('/create-staff', auth, role('owner'), asyncHandler(async (req, res) => {
  const { full_name, email, password, phone, userRole, property_id, staff_role_label } = req.body
  if (!full_name || !email || !password || !userRole)
    return res.status(400).json({ error: 'Full name, email, password, and role are required' })

  const { data: exists } = await db.from('users').select('id').eq('email', email).maybeSingle()
  if (exists) return res.status(400).json({ error: 'Email already taken' })

  const password_hash = await bcrypt.hash(password, 12)

  const { data: user, error } = await db.from('users').insert({
    full_name, email, password_hash, phone: phone || null,
    role: userRole, organization_id: req.user.organization_id,
    staff_role_label: staff_role_label || null,
    is_approved: true, is_active: true,
  }).select('id,full_name,email,role').single()

  if (error) return res.status(400).json({ error: error.message })

  // Assign to property if provided
  if (property_id) {
    await db.from('property_staff').insert({ property_id, user_id: user.id })
  }

  res.json({ user })
}))

// PATCH /api/auth/change-password
r.patch('/change-password', auth, asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Both current and new password are required' })

  const { data: user } = await db.from('users').select('password_hash').eq('id', req.user.id).single()
  if (!(await bcrypt.compare(current_password, user.password_hash)))
    return res.status(401).json({ error: 'Current password is incorrect' })

  const password_hash = await bcrypt.hash(new_password, 12)
  await db.from('users').update({ password_hash }).eq('id', req.user.id)
  res.json({ ok: true })
}))

export default r
