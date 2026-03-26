import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'
import PDFDocument from 'pdfkit'
import https from 'https'
import http from 'http'

const r = Router()
r.use(auth)

// GET /api/verification/:tenant_id  — fetch verification record for a tenant
r.get('/:tenant_id', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const { data, error } = await db.from('background_verifications')
    .select('*').eq('tenant_id', req.params.tenant_id).maybeSingle()

  if (!data) {
    // Auto-create if missing — happens when tenant was added before this feature
    const { data: created } = await db.from('background_verifications')
      .insert({ tenant_id: req.params.tenant_id }).select().single()
    return res.json({ verification: created })
  }
  res.json({ verification: data })
}))

// PATCH /api/verification/:tenant_id  — update verification statuses/notes
r.patch('/:tenant_id', role('owner', 'manager'), asyncHandler(async (req, res) => {
  const allowed = [
    'police_verification', 'police_notes', 'police_verified_date',
    'aadhaar_verification', 'aadhaar_notes', 'aadhaar_verified_date',
    'work_verification', 'work_notes', 'work_verified_date',
  ]
  const updates = {}
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })

  // Record who did the verification and when
  if (updates.police_verification  === 'verified') { updates.police_verified_by  = req.user.id; updates.police_verified_date  = new Date().toISOString().split('T')[0] }
  if (updates.aadhaar_verification === 'verified') { updates.aadhaar_verified_by = req.user.id; updates.aadhaar_verified_date = new Date().toISOString().split('T')[0] }
  if (updates.work_verification    === 'verified') { updates.work_verified_by    = req.user.id; updates.work_verified_date    = new Date().toISOString().split('T')[0] }

  const { data, error } = await db.from('background_verifications')
    .upsert({ tenant_id: req.params.tenant_id, ...updates }, { onConflict: 'tenant_id' })
    .select().single()

  if (error) return res.status(400).json({ error: error.message })

  // Check if all 3 verifications are done and auto-approve the tenant
  if (data.police_verification === 'verified' && data.aadhaar_verification === 'verified' && data.work_verification === 'verified') {
    await db.from('users').update({ is_approved: true }).eq('id', req.params.tenant_id)
  }

  res.json({ verification: data })
}))

// Helper: fetch a URL and return it as a buffer (for embedding images in PDF)
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    proto.get(url, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// GET /api/verification/:tenant_id/pdf  — generate police verification application form PDF
r.get('/:tenant_id/pdf', role('owner', 'manager'), asyncHandler(async (req, res) => {
  // Fetch full tenant profile including all document URLs
  const { data: user, error: userErr } = await db.from('users').select('*').eq('id', req.params.tenant_id).single()
  if (userErr || !user) return res.status(404).json({ error: 'Tenant not found' })

  const { data: tenancy } = await db.from('tenancies')
    .select('*, room:rooms(room_number,floor:floors(floor_label)), bed:beds(bed_number), property:properties(name,street_address,city,state,pin_code,contact_phone,logo_url)')
    .eq('tenant_id', req.params.tenant_id).eq('is_active', true).maybeSingle()

  const { data: bgv } = await db.from('background_verifications')
    .select('*').eq('tenant_id', req.params.tenant_id).maybeSingle()

  const property = tenancy?.property

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="verification-form-${user.full_name?.replace(/\s+/g,'-')}.pdf"`)

  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  doc.pipe(res)

  // Header bar
  doc.rect(0, 0, doc.page.width, 110).fill('#1A1A2E')
  if (property?.name) {
    doc.fillColor('#818CF8').font('Helvetica-Bold').fontSize(20).text(property.name, 60, 20)
  }
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text('TENANT VERIFICATION FORM', 60, 50)
  doc.font('Helvetica').fontSize(9).fillColor('#94A3B8')
  if (property) doc.text(`${property.street_address || ''}, ${property.city || ''} ${property.pin_code || ''}`, 60, 72)
  doc.text('For Police Verification Use Only', 60, 86)

  // Verification status badges
  const allVerified = bgv?.police_verification === 'verified' && bgv?.aadhaar_verification === 'verified' && bgv?.work_verification === 'verified'
  if (allVerified) {
    doc.roundedRect(doc.page.width - 150, 30, 110, 30, 5).fill('#22C55E')
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text('VERIFIED', doc.page.width - 130, 42)
  }

  let y = 130

  // Profile photo + basic info side by side
  if (user.profile_photo_url) {
    try {
      const imgBuf = await fetchBuffer(user.profile_photo_url)
      doc.roundedRect(50, y, 100, 120, 4).stroke('#E2E8F0')
      doc.image(imgBuf, 52, y + 2, { width: 96, height: 116 })
    } catch { /* skip if photo fails to load */ }
  }

  const infoX = 170
  doc.fillColor('#1A1A2E').font('Helvetica-Bold').fontSize(16).text(user.full_name || '', infoX, y)
  doc.font('Helvetica').fontSize(10).fillColor('#6B7280')
  doc.text(`Email: ${user.email || 'N/A'}`,                               infoX, y + 24)
  doc.text(`Phone: ${user.phone || 'N/A'}`,                               infoX, y + 38)
  doc.text(`Gender: ${user.gender || 'N/A'}`,                             infoX, y + 52)
  doc.text(`Date of Birth: ${user.date_of_birth || 'N/A'}`,               infoX, y + 66)
  doc.text(`Occupation: ${user.occupation || 'N/A'}`,                     infoX, y + 80)
  doc.text(`Institute/Company: ${user.institute_or_company || 'N/A'}`,    infoX, y + 94)
  if (tenancy) {
    doc.fillColor('#5B6AF0').font('Helvetica-Bold')
    doc.text(`Room: ${tenancy.room?.room_number || 'N/A'} | Bed: ${tenancy.bed?.bed_number || 'N/A'} | Check-in: ${tenancy.check_in_date || 'N/A'}`, infoX, y + 110)
  }

  y += 145

  // Section: Address
  doc.rect(50, y, doc.page.width - 100, 22).fill('#F0F1F5')
  doc.fillColor('#1A1A2E').font('Helvetica-Bold').fontSize(11).text('ADDRESS DETAILS', 58, y + 6)
  y += 28
  doc.font('Helvetica').fontSize(10).fillColor('#374151')
  doc.text(`Permanent Address: ${user.permanent_address || 'N/A'}`, 58, y)
  y += 18
  doc.text(`Current City: ${user.current_city || 'N/A'}`, 58, y); y += 18
  doc.text(`Guardian Name: ${user.guardian_name || 'N/A'}  |  Guardian Phone: ${user.guardian_phone || 'N/A'}`, 58, y); y += 18
  doc.text(`Guardian Address: ${user.guardian_address || 'N/A'}`, 58, y); y += 24

  // Section: Documents with images
  doc.rect(50, y, doc.page.width - 100, 22).fill('#F0F1F5')
  doc.fillColor('#1A1A2E').font('Helvetica-Bold').fontSize(11).text('IDENTITY DOCUMENTS', 58, y + 6)
  y += 28

  const docImages = [
    { label: 'Aadhaar Card (Front)', url: user.aadhaar_front_url },
    { label: 'Aadhaar Card (Back)',  url: user.aadhaar_back_url  },
    { label: 'PAN Card',             url: user.pan_card_url      },
    { label: 'Driving License',      url: user.driving_license_url },
  ].filter(d => d.url)

  // Lay out document images in a 2-column grid
  let docX = 58, docY = y
  for (let i = 0; i < docImages.length; i++) {
    const docItem = docImages[i]
    const col = i % 2
    const row = Math.floor(i / 2)
    const imgX = 58 + col * 240
    const imgY = docY + row * 110

    if (imgY + 110 > doc.page.height - 80) { doc.addPage(); docY = 50 }

    doc.roundedRect(imgX - 2, imgY - 2, 224, 104, 4).stroke('#E2E8F0')
    doc.fillColor('#6B7280').font('Helvetica-Bold').fontSize(8).text(docItem.label, imgX, imgY - 14)

    try {
      const imgBuf = await fetchBuffer(docItem.url)
      doc.image(imgBuf, imgX, imgY, { width: 220, height: 100, fit: [220, 100] })
    } catch {
      doc.fillColor('#94A3B8').fontSize(8).text('Image not available', imgX + 80, imgY + 42)
    }
  }
  y = docY + Math.ceil(docImages.length / 2) * 110 + 20

  // Section: Verification status
  if (y + 100 > doc.page.height - 80) { doc.addPage(); y = 50 }
  doc.rect(50, y, doc.page.width - 100, 22).fill('#F0F1F5')
  doc.fillColor('#1A1A2E').font('Helvetica-Bold').fontSize(11).text('VERIFICATION STATUS', 58, y + 6)
  y += 28

  const statuses = [
    { label: 'Police Verification', val: bgv?.police_verification  || 'pending', date: bgv?.police_verified_date  },
    { label: 'Aadhaar Verification', val: bgv?.aadhaar_verification || 'pending', date: bgv?.aadhaar_verified_date },
    { label: 'Work/Study Verification', val: bgv?.work_verification || 'pending', date: bgv?.work_verified_date   },
  ]

  statuses.forEach(s => {
    const color = s.val === 'verified' ? '#22C55E' : s.val === 'rejected' ? '#EF4444' : '#F59E0B'
    doc.roundedRect(58, y, 200, 22, 4).fill(color + '22')
    doc.fillColor(color).font('Helvetica-Bold').fontSize(9).text(s.label, 64, y + 6)
    doc.fillColor(color).text(s.val.toUpperCase(), 230, y + 6)
    if (s.date) {
      doc.fillColor('#6B7280').font('Helvetica').text(`Verified: ${s.date}`, 320, y + 6)
    }
    y += 28
  })

  // Signature boxes at the bottom
  y += 10
  if (y + 80 > doc.page.height - 60) { doc.addPage(); y = 50 }
  doc.font('Helvetica').fontSize(9).fillColor('#374151')
  const sigBoxes = [
    { x: 58,  label: 'Tenant Signature' },
    { x: 225, label: 'Manager Signature' },
    { x: 392, label: 'Police Officer Signature' },
  ]
  sigBoxes.forEach(box => {
    doc.rect(box.x, y, 140, 50).stroke('#CBD5E1')
    doc.text(box.label, box.x + 10, y + 56)
  })

  // Footer
  y += 80
  doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill('#F0F1F5')
  doc.fillColor('#9CA3AF').fontSize(7).font('Helvetica')
  doc.text(`Generated by PGManager on ${new Date().toLocaleString('en-IN')} | This form is for official verification purposes only`, 50, doc.page.height - 24)

  doc.end()
}))

export default r
