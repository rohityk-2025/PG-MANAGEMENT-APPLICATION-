import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth)

// GET /api/dashboard/owner  — high-level stats for the owner
r.get('/owner', role('owner'), asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const today = new Date()
  const month = today.getMonth() + 1
  const year  = today.getFullYear()

  const [{ data: props }, { data: tenancies }, { data: beds }, { data: complaints }, { data: rentThisMonth }, { data: expenses }] = await Promise.all([
    db.from('properties').select('id,name,city').eq('organization_id', orgId).eq('is_active', true),
    db.from('tenancies').select('id,property_id').eq('is_active', true),
    db.from('beds').select('id,status,property_id'),
    db.from('complaints').select('id,status').neq('status','resolved').neq('status','closed'),
    db.from('rent_records').select('amount_due,amount_paid,status').eq('month', month).eq('year', year),
    db.from('expenses').select('amount')
      .gte('date', `${year}-${String(month).padStart(2,'0')}-01`)
      .lte('date', today.toISOString().split('T')[0]),
  ])

  const totalBeds   = beds?.length || 0
  const occupiedBeds = beds?.filter(b => b.status === 'occupied').length || 0
  const totalRent   = rentThisMonth?.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount_paid||0), 0) || 0
  const totalExp    = expenses?.reduce((s, e) => s + Number(e.amount||0), 0) || 0

  res.json({
    total_properties: props?.length || 0,
    total_tenants:    tenancies?.length || 0,
    total_beds:       totalBeds,
    vacant_beds:      totalBeds - occupiedBeds,
    occupancy_rate:   totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    open_complaints:  complaints?.length || 0,
    rent_collected:   totalRent,
    expenses_this_month: totalExp,
    properties:       props || [],
  })
}))

// GET /api/dashboard/manager?property_id=xxx
r.get('/manager', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { property_id } = req.query
  if (!property_id) return res.status(400).json({ error: 'property_id required' })

  const today = new Date()
  const month = today.getMonth() + 1
  const year  = today.getFullYear()

  const [{ data: tenancies }, { data: beds }, { data: complaints }, { data: rent }, { data: pendingUsers }] = await Promise.all([
    db.from('tenancies').select('id').eq('property_id', property_id).eq('is_active', true),
    db.from('beds').select('id,status').eq('property_id', property_id),
    db.from('complaints').select('id,status').eq('property_id', property_id).neq('status','resolved').neq('status','closed'),
    db.from('rent_records').select('amount_due,amount_paid,status').eq('property_id', property_id).eq('month', month).eq('year', year),
    db.from('tenancies').select('tenant_id,tenant:users!tenant_id(is_approved)').eq('property_id', property_id).eq('is_active', true),
  ])

  const totalDue   = rent?.reduce((s,r) => s + Number(r.amount_due||0), 0) || 0
  const collected  = rent?.filter(r => r.status === 'paid').reduce((s,r) => s + Number(r.amount_paid||0), 0) || 0
  const pending    = pendingUsers?.filter(t => t.tenant?.is_approved === false).length || 0
  const vacantBeds = beds?.filter(b => b.status === 'vacant').length || 0

  res.json({
    total_tenants:      tenancies?.length || 0,
    vacant_beds:        vacantBeds,
    pending_approvals:  pending,
    open_complaints:    complaints?.length || 0,
    rent_expected:      totalDue,
    rent_collected:     collected,
    rent_pct:           totalDue > 0 ? Math.round((collected / totalDue) * 100) : 0,
  })
}))

// GET /api/dashboard/tenant
r.get('/tenant', role('tenant'), asyncHandler(async (req, res) => {
  const uid  = req.user.id
  const today = new Date()
  const month = today.getMonth() + 1
  const year  = today.getFullYear()

  const [{ data: tenancy }, { data: rent }, { data: complaints }, { data: bgv }] = await Promise.all([
    db.from('tenancies').select('*, room:rooms(room_number,room_type), bed:beds(bed_number), property:properties(name,city,logo_url,upi_id)')
      .eq('tenant_id', uid).eq('is_active', true).maybeSingle(),
    db.from('rent_records').select('*').eq('tenant_id', uid).eq('month', month).eq('year', year).maybeSingle(),
    db.from('complaints').select('id,title,status,urgency,created_at').eq('tenant_id', uid).order('created_at',{ascending:false}).limit(3),
    db.from('background_verifications').select('police_verification,aadhaar_verification,work_verification').eq('tenant_id', uid).maybeSingle(),
  ])

  res.json({ tenancy, current_rent: rent, recent_complaints: complaints || [], verification: bgv })
}))

export default r
