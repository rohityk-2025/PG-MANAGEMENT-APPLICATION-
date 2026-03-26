import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

const r = Router()
r.use(auth, role('owner', 'manager'))

// Helper: parse date filter params and return start/end dates
function getDateRange(query) {
  const { period, start, end, year, month } = query
  const today = new Date()

  if (start && end) return { from: start, to: end }
  if (period === 'today') {
    const d = today.toISOString().split('T')[0]
    return { from: d, to: d }
  }
  if (period === 'week') {
    const mon = new Date(today)
    mon.setDate(today.getDate() - today.getDay() + 1)
    return { from: mon.toISOString().split('T')[0], to: today.toISOString().split('T')[0] }
  }
  if (period === 'month') {
    const from = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`
    return { from, to: today.toISOString().split('T')[0] }
  }
  if (period === 'quarter') {
    const q = Math.floor(today.getMonth() / 3)
    const from = new Date(today.getFullYear(), q * 3, 1).toISOString().split('T')[0]
    return { from, to: today.toISOString().split('T')[0] }
  }
  if (period === 'halfyear') {
    const from = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split('T')[0]
    return { from, to: today.toISOString().split('T')[0] }
  }
  if (period === 'year') {
    return { from: `${today.getFullYear()}-01-01`, to: today.toISOString().split('T')[0] }
  }
  if (period === 'lastyear') {
    const y = today.getFullYear() - 1
    return { from: `${y}-01-01`, to: `${y}-12-31` }
  }
  // Default: last 30 days
  const from = new Date(today)
  from.setDate(today.getDate() - 30)
  return { from: from.toISOString().split('T')[0], to: today.toISOString().split('T')[0] }
}

// GET /api/reports/collections  — rent collection report with monthly breakdown
r.get('/collections', asyncHandler(async (req, res) => {
  const { from, to } = getDateRange(req.query)
  const { property_id } = req.query

  let q = db.from('rent_records').select(`
    id, month, year, month_year, amount_due, amount_paid, status,
    payment_mode, paid_date, receipt_number, transaction_id,
    tenant:users!tenant_id ( full_name, phone ),
    tenancy:tenancies!tenancy_id (
      room:rooms ( room_number, floor:floors ( floor_label ) )
    )
  `)
  .gte('created_at', from + 'T00:00:00')
  .lte('created_at', to + 'T23:59:59')
  .order('year', { ascending: false })
  .order('month', { ascending: false })

  if (property_id && property_id !== 'all') q = q.eq('property_id', property_id)

  const { data: rows = [], error } = await q
  if (error) return res.status(400).json({ error: error.message })

  // Build monthly chart data
  const monthMap = {}
  rows.forEach(r => {
    const key = r.month_year || `${r.year}-${String(r.month).padStart(2,'0')}`
    if (!monthMap[key]) monthMap[key] = { month: key, expected: 0, collected: 0, pending: 0, overdue: 0 }
    monthMap[key].expected += Number(r.amount_due) || 0
    if (r.status === 'paid') monthMap[key].collected += Number(r.amount_paid) || 0
    if (r.status === 'pending') monthMap[key].pending++
    if (r.status === 'overdue') monthMap[key].overdue++
  })

  const stats = {
    total_expected:  rows.reduce((s, r) => s + Number(r.amount_due   || 0), 0),
    total_collected: rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount_paid || 0), 0),
    pending_count:   rows.filter(r => r.status === 'pending').length,
    overdue_count:   rows.filter(r => r.status === 'overdue').length,
    paid_count:      rows.filter(r => r.status === 'paid').length,
  }
  stats.collection_rate = stats.total_expected > 0
    ? Math.round((stats.total_collected / stats.total_expected) * 100)
    : 0

  res.json({ rows, stats, chart: Object.values(monthMap).sort((a,b) => a.month.localeCompare(b.month)) })
}))

// GET /api/reports/expenses  — expense report with category breakdown
r.get('/expenses', asyncHandler(async (req, res) => {
  const { from, to } = getDateRange(req.query)
  const { property_id } = req.query

  let q = db.from('expenses').select(`
    id, title, category, amount, date, description,
    property:properties ( name ),
    added_by_user:users!added_by ( full_name )
  `)
  .gte('date', from).lte('date', to)
  .order('date', { ascending: false })

  if (property_id && property_id !== 'all') q = q.eq('property_id', property_id)

  const { data: rows = [], error } = await q
  if (error) return res.status(400).json({ error: error.message })

  // Group by category for pie chart
  const catMap = {}
  rows.forEach(r => {
    catMap[r.category] = (catMap[r.category] || 0) + Number(r.amount || 0)
  })

  // Monthly totals for bar chart
  const monthMap = {}
  rows.forEach(r => {
    const key = r.date?.substring(0, 7)
    if (!monthMap[key]) monthMap[key] = { month: key, total: 0 }
    monthMap[key].total += Number(r.amount || 0)
  })

  res.json({
    rows,
    stats: {
      total: rows.reduce((s, r) => s + Number(r.amount || 0), 0),
      count: rows.length,
    },
    chart_category: Object.entries(catMap).map(([category, amount]) => ({ category, amount })),
    chart_monthly:  Object.values(monthMap).sort((a,b) => a.month.localeCompare(b.month)),
  })
}))

// GET /api/reports/comparison  — compare two periods (last month vs this month, etc.)
r.get('/comparison', asyncHandler(async (req, res) => {
  const { property_id, compare } = req.query
  const today = new Date()

  let current_from, current_to, prev_from, prev_to, label_current, label_prev

  if (compare === 'month') {
    const cm = today.getMonth() + 1, cy = today.getFullYear()
    const pm = cm === 1 ? 12 : cm - 1, py = cm === 1 ? cy - 1 : cy
    current_from = `${cy}-${String(cm).padStart(2,'0')}-01`
    current_to   = today.toISOString().split('T')[0]
    prev_from    = `${py}-${String(pm).padStart(2,'0')}-01`
    prev_to      = new Date(cy, cm - 1, 0).toISOString().split('T')[0]
    label_current = 'This Month'; label_prev = 'Last Month'
  } else if (compare === 'halfyear') {
    current_from = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split('T')[0]
    current_to   = today.toISOString().split('T')[0]
    prev_from    = new Date(today.getFullYear(), today.getMonth() - 11, 1).toISOString().split('T')[0]
    prev_to      = new Date(today.getFullYear(), today.getMonth() - 6, 0).toISOString().split('T')[0]
    label_current = 'Last 6 Months'; label_prev = 'Previous 6 Months'
  } else {
    // Year comparison (default)
    const cy = today.getFullYear()
    current_from = `${cy}-01-01`; current_to = today.toISOString().split('T')[0]
    prev_from = `${cy-1}-01-01`; prev_to = `${cy-1}-12-31`
    label_current = `${cy}`; label_prev = `${cy - 1}`
  }

  // Fetch rent and expense data for both periods
  const fetchData = async (from, to) => {
    let rentQ = db.from('rent_records').select('amount_due,amount_paid,status')
      .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
    let expQ  = db.from('expenses').select('amount').gte('date', from).lte('date', to)
    if (property_id && property_id !== 'all') {
      rentQ = rentQ.eq('property_id', property_id)
      expQ  = expQ.eq('property_id', property_id)
    }
    const [{ data: rent = [] }, { data: exp = [] }] = await Promise.all([rentQ, expQ])
    const income  = rent.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount_paid || 0), 0)
    const expense = exp.reduce((s, e) => s + Number(e.amount || 0), 0)
    return { income, expense, profit: income - expense, expected: rent.reduce((s,r) => s + Number(r.amount_due||0), 0) }
  }

  const [curr, prev] = await Promise.all([
    fetchData(current_from, current_to),
    fetchData(prev_from, prev_to),
  ])

  const diff = (a, b) => b === 0 ? null : Math.round(((a - b) / b) * 100)

  res.json({
    current:  { ...curr, label: label_current, from: current_from, to: current_to },
    previous: { ...prev, label: label_prev, from: prev_from, to: prev_to },
    changes: {
      income_pct:  diff(curr.income, prev.income),
      expense_pct: diff(curr.expense, prev.expense),
      profit_pct:  diff(curr.profit, prev.profit),
    },
  })
}))

// GET /api/reports/occupancy  — bed occupancy stats
r.get('/occupancy', asyncHandler(async (req, res) => {
  const { property_id } = req.query

  let q = db.from('beds').select('id,status,property_id,room:rooms(room_number,floor:floors(floor_label))')
  if (property_id && property_id !== 'all') q = q.eq('property_id', property_id)
  const { data: beds = [] } = await q

  const total    = beds.length
  const occupied = beds.filter(b => b.status === 'occupied').length
  const vacant   = beds.filter(b => b.status === 'vacant').length
  const notice   = beds.filter(b => b.status === 'notice_period').length
  const maint    = beds.filter(b => b.status === 'maintenance').length

  res.json({
    stats: {
      total_beds: total, occupied, vacant, notice_period: notice, maintenance: maint,
      occupancy_rate: total > 0 ? Math.round((occupied / total) * 100) : 0,
    },
    chart: [
      { name: 'Occupied',      value: occupied,  fill: '#EF4444' },
      { name: 'Vacant',        value: vacant,    fill: '#22C55E' },
      { name: 'Notice Period', value: notice,    fill: '#F59E0B' },
      { name: 'Maintenance',   value: maint,     fill: '#94A3B8' },
    ],
  })
}))

// GET /api/reports/income_expense  — P&L overview
r.get('/income_expense', asyncHandler(async (req, res) => {
  const { from, to } = getDateRange(req.query)
  const { property_id } = req.query

  let rentQ = db.from('rent_records').select('month_year,amount_paid,status')
    .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
  let expQ = db.from('expenses').select('date,amount').gte('date', from).lte('date', to)

  if (property_id && property_id !== 'all') {
    rentQ = rentQ.eq('property_id', property_id)
    expQ  = expQ.eq('property_id', property_id)
  }

  const [{ data: rents = [] }, { data: expenses = [] }] = await Promise.all([rentQ, expQ])

  const months = {}
  rents.filter(r => r.status === 'paid').forEach(r => {
    const m = r.month_year || 'unknown'
    if (!months[m]) months[m] = { month: m, income: 0, expense: 0 }
    months[m].income += Number(r.amount_paid || 0)
  })
  expenses.forEach(e => {
    const m = e.date?.substring(0,7) || 'unknown'
    if (!months[m]) months[m] = { month: m, income: 0, expense: 0 }
    months[m].expense += Number(e.amount || 0)
  })

  const chart = Object.values(months)
    .map(m => ({ ...m, profit: m.income - m.expense }))
    .sort((a,b) => a.month.localeCompare(b.month))

  const total_income  = chart.reduce((s, r) => s + r.income, 0)
  const total_expense = chart.reduce((s, r) => s + r.expense, 0)

  res.json({
    chart,
    stats: { total_income, total_expense, net_profit: total_income - total_expense },
  })
}))

// GET /api/reports/collections/excel  — download Excel file
r.get('/collections/excel', asyncHandler(async (req, res) => {
  const { from, to } = getDateRange(req.query)
  const { property_id } = req.query

  let q = db.from('rent_records').select(`
    month_year, amount_due, amount_paid, status, payment_mode, paid_date, receipt_number,
    tenant:users!tenant_id ( full_name, phone ),
    tenancy:tenancies!tenancy_id ( room:rooms ( room_number ) )
  `).gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
  if (property_id && property_id !== 'all') q = q.eq('property_id', property_id)

  const { data: rows = [] } = await q

  // Fetch property name for the report header
  let propertyName = 'All Properties'
  if (property_id && property_id !== 'all') {
    const { data: prop } = await db.from('properties').select('name').eq('id', property_id).single()
    if (prop) propertyName = prop.name
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'PGManager'
  const ws = wb.addWorksheet('Rent Collection')

  // Title and metadata rows
  ws.mergeCells('A1:G1')
  ws.getCell('A1').value = `Rent Collection Report — ${propertyName}`
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1A1A2E' } }
  ws.getCell('A1').alignment = { horizontal: 'center' }

  ws.mergeCells('A2:G2')
  ws.getCell('A2').value = `Period: ${from} to ${to}`
  ws.getCell('A2').font  = { size: 10, color: { argb: 'FF6B7280' } }
  ws.getCell('A2').alignment = { horizontal: 'center' }

  ws.addRow([])

  // Headers
  const headers = ['Tenant Name', 'Phone', 'Room', 'Month', 'Amount Due', 'Amount Paid', 'Status', 'Payment Mode', 'Paid Date', 'Receipt No.']
  const headerRow = ws.addRow(headers)
  headerRow.eachCell(cell => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B6AF0' } }
    cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF3730A3' } } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Data rows with alternating colors
  rows.forEach((row, i) => {
    const dataRow = ws.addRow([
      row.tenant?.full_name || '',
      row.tenant?.phone     || '',
      row.tenancy?.room?.room_number || '',
      row.month_year        || '',
      Number(row.amount_due  || 0),
      Number(row.amount_paid || 0),
      row.status            || '',
      row.payment_mode      || '',
      row.paid_date         || '',
      row.receipt_number    || '',
    ])
    const bg = i % 2 === 0 ? 'FFF8F9FF' : 'FFFFFFFF'
    dataRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    })
    // Highlight overdue rows in red
    if (row.status === 'overdue') {
      dataRow.getCell(7).font = { color: { argb: 'FFEF4444' }, bold: true }
    }
    if (row.status === 'paid') {
      dataRow.getCell(7).font = { color: { argb: 'FF22C55E' }, bold: true }
    }
  })

  // Summary totals at the bottom
  ws.addRow([])
  const total_due = rows.reduce((s, r) => s + Number(r.amount_due || 0), 0)
  const total_paid = rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount_paid || 0), 0)
  const sumRow = ws.addRow(['', '', '', 'TOTAL', total_due, total_paid, '', '', '', ''])
  sumRow.getCell(4).font = { bold: true }
  sumRow.getCell(5).font = { bold: true, color: { argb: 'FF5B6AF0' } }
  sumRow.getCell(6).font = { bold: true, color: { argb: 'FF22C55E' } }
  sumRow.getCell(5).numFmt = '₹#,##0.00'
  sumRow.getCell(6).numFmt = '₹#,##0.00'

  // Format currency columns and auto-fit columns
  ws.getColumn(5).numFmt = '₹#,##0.00'
  ws.getColumn(6).numFmt = '₹#,##0.00'
  ws.columns.forEach(col => { col.width = 18 })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="rent-collection-${from}-${to}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
}))

// GET /api/reports/expenses/excel  — download expenses as Excel
r.get('/expenses/excel', asyncHandler(async (req, res) => {
  const { from, to } = getDateRange(req.query)
  const { property_id } = req.query

  let q = db.from('expenses').select(`
    date, category, title, description, amount,
    property:properties(name),
    added_by_user:users!added_by(full_name)
  `).gte('date', from).lte('date', to).order('date', { ascending: false })
  if (property_id && property_id !== 'all') q = q.eq('property_id', property_id)

  const { data: rows = [] } = await q

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Expenses')

  ws.mergeCells('A1:F1')
  ws.getCell('A1').value = 'Expense Report'
  ws.getCell('A1').font  = { bold: true, size: 14, color: { argb: 'FF1A1A2E' } }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.mergeCells('A2:F2')
  ws.getCell('A2').value = `Period: ${from} to ${to}`
  ws.getCell('A2').font  = { size: 10, color: { argb: 'FF6B7280' } }
  ws.getCell('A2').alignment = { horizontal: 'center' }
  ws.addRow([])

  const headerRow = ws.addRow(['Date', 'Category', 'Title', 'Description', 'Amount', 'Added By'])
  headerRow.eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } }
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  rows.forEach((row, i) => {
    const dr = ws.addRow([
      row.date, row.category, row.title, row.description || '',
      Number(row.amount || 0), row.added_by_user?.full_name || '',
    ])
    dr.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFF5F5' : 'FFFFFFFF' } }
    })
    dr.getCell(5).numFmt = '₹#,##0.00'
  })

  ws.addRow([])
  const totalRow = ws.addRow(['', '', '', 'TOTAL', rows.reduce((s,r) => s + Number(r.amount||0), 0), ''])
  totalRow.getCell(4).font = { bold: true }
  totalRow.getCell(5).font = { bold: true, color: { argb: 'FFEF4444' } }
  totalRow.getCell(5).numFmt = '₹#,##0.00'
  ws.getColumn(5).numFmt = '₹#,##0.00'
  ws.columns.forEach(col => { col.width = 18 })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="expenses-${from}-${to}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
}))

// GET /api/reports/collections/pdf  — download collections as PDF
r.get('/collections/pdf', asyncHandler(async (req, res) => {
  const { from, to } = getDateRange(req.query)
  const { property_id } = req.query

  let q = db.from('rent_records').select(`
    month_year, amount_due, amount_paid, status, payment_mode, paid_date, receipt_number,
    tenant:users!tenant_id(full_name), tenancy:tenancies!tenancy_id(room:rooms(room_number))
  `).gte('created_at', from+'T00:00:00').lte('created_at', to+'T23:59:59')
  if (property_id && property_id !== 'all') q = q.eq('property_id', property_id)

  const { data: rows = [] } = await q

  let propertyName = 'All Properties', propertyLogo = null
  if (property_id && property_id !== 'all') {
    const { data: p } = await db.from('properties').select('name,logo_url').eq('id', property_id).single()
    if (p) { propertyName = p.name; propertyLogo = p.logo_url }
  }

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="rent-collection-${from}-${to}.pdf"`)

  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  doc.pipe(res)

  // Header with PG name and branding
  doc.rect(0, 0, doc.page.width, 100).fill('#5B6AF0')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text(propertyName, 50, 25)
  doc.font('Helvetica').fontSize(11).text('Rent Collection Report', 50, 52)
  doc.fontSize(9).text(`Period: ${from} to ${to}`, 50, 68)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 50, 82)

  doc.fillColor('#000000').moveDown(3)

  // Summary stats box
  const total_due  = rows.reduce((s, r) => s + Number(r.amount_due || 0), 0)
  const total_paid = rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount_paid || 0), 0)
  const rate = total_due > 0 ? Math.round((total_paid / total_due) * 100) : 0

  doc.roundedRect(50, 115, doc.page.width - 100, 60, 8).fill('#F8F9FF')
  doc.fillColor('#5B6AF0').font('Helvetica-Bold').fontSize(10)
  doc.text(`Total Expected: Rs.${total_due.toLocaleString('en-IN')}`, 70, 128)
  doc.fillColor('#22C55E').text(`Collected: Rs.${total_paid.toLocaleString('en-IN')}`, 70, 145)
  doc.fillColor('#EF4444').text(`Outstanding: Rs.${(total_due - total_paid).toLocaleString('en-IN')}`, 250, 128)
  doc.fillColor('#1A1A2E').text(`Collection Rate: ${rate}%`, 250, 145)

  doc.fillColor('#000000').moveDown(5)

  // Table headers
  const tableY = 190
  const cols   = [50, 180, 240, 290, 355, 420, 490]
  doc.rect(50, tableY, doc.page.width - 100, 22).fill('#5B6AF0')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
  doc.text('Tenant',         cols[0], tableY + 7)
  doc.text('Room',           cols[1], tableY + 7)
  doc.text('Month',          cols[2], tableY + 7)
  doc.text('Due',            cols[3], tableY + 7)
  doc.text('Paid',           cols[4], tableY + 7)
  doc.text('Status',         cols[5], tableY + 7)
  doc.text('Mode',           cols[6], tableY + 7)

  // Table rows
  let y = tableY + 22
  doc.font('Helvetica').fontSize(8)
  rows.forEach((row, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 50 }
    const bg = i % 2 === 0 ? '#F8F9FF' : '#FFFFFF'
    doc.rect(50, y, doc.page.width - 100, 18).fill(bg)

    const statusColor = row.status === 'paid' ? '#22C55E' : row.status === 'overdue' ? '#EF4444' : '#F59E0B'
    doc.fillColor('#1A1A2E')
    doc.text(row.tenant?.full_name?.substring(0,20) || '', cols[0], y + 5)
    doc.text(row.tenancy?.room?.room_number || '', cols[1], y + 5)
    doc.text(row.month_year || '', cols[2], y + 5)
    doc.text(`Rs.${Number(row.amount_due||0).toLocaleString('en-IN')}`, cols[3], y + 5)
    doc.text(`Rs.${Number(row.amount_paid||0).toLocaleString('en-IN')}`, cols[4], y + 5)
    doc.fillColor(statusColor).text(row.status || '', cols[5], y + 5)
    doc.fillColor('#1A1A2E').text(row.payment_mode || '', cols[6], y + 5)
    y += 18
  })

  // Footer
  doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill('#F0F1F5')
  doc.fillColor('#6B7280').fontSize(8).font('Helvetica')
  doc.text('Generated by PGManager | Confidential', 50, doc.page.height - 24)
  doc.text(`Page 1`, doc.page.width - 80, doc.page.height - 24)

  doc.end()
}))

// GET /api/reports/expenses/pdf  — download expenses as PDF
r.get('/expenses/pdf', asyncHandler(async (req, res) => {
  const { from, to } = getDateRange(req.query)
  const { property_id } = req.query

  let q = db.from('expenses').select(`
    date, category, title, description, amount, property:properties(name,logo_url)
  `).gte('date', from).lte('date', to).order('date', { ascending: false })
  if (property_id && property_id !== 'all') q = q.eq('property_id', property_id)

  const { data: rows = [] } = await q

  let propertyName = 'All Properties'
  if (rows[0]?.property?.name) propertyName = rows[0].property.name

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="expenses-${from}-${to}.pdf"`)

  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  doc.pipe(res)

  doc.rect(0, 0, doc.page.width, 100).fill('#EF4444')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text(propertyName, 50, 25)
  doc.font('Helvetica').fontSize(11).text('Expense Report', 50, 52)
  doc.fontSize(9).text(`Period: ${from} to ${to}`, 50, 68)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 50, 82)

  const totalExpense = rows.reduce((s, r) => s + Number(r.amount || 0), 0)
  doc.fillColor('#000000').moveDown(3)
  doc.roundedRect(50, 115, doc.page.width - 100, 50, 8).fill('#FFF5F5')
  doc.fillColor('#EF4444').font('Helvetica-Bold').fontSize(12)
  doc.text(`Total Expenses: Rs.${totalExpense.toLocaleString('en-IN')}`, 70, 133)
  doc.fillColor('#6B7280').font('Helvetica').fontSize(10)
  doc.text(`${rows.length} expense entries in this period`, 70, 150)

  const tableY = 185
  const cols   = [50, 115, 195, 320, 430]
  doc.rect(50, tableY, doc.page.width - 100, 22).fill('#EF4444')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
  doc.text('Date',        cols[0], tableY + 7)
  doc.text('Category',    cols[1], tableY + 7)
  doc.text('Title',       cols[2], tableY + 7)
  doc.text('Description', cols[3], tableY + 7)
  doc.text('Amount',      cols[4], tableY + 7)

  let y = tableY + 22
  doc.font('Helvetica').fontSize(8)
  rows.forEach((row, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 50 }
    doc.rect(50, y, doc.page.width - 100, 18).fill(i % 2 === 0 ? '#FFF5F5' : '#FFFFFF')
    doc.fillColor('#1A1A2E')
    doc.text(row.date         || '', cols[0], y + 5)
    doc.text(row.category     || '', cols[1], y + 5)
    doc.text((row.title||'').substring(0,30), cols[2], y + 5)
    doc.text((row.description||'').substring(0,25), cols[3], y + 5)
    doc.fillColor('#EF4444').text(`Rs.${Number(row.amount||0).toLocaleString('en-IN')}`, cols[4], y + 5)
    y += 18
  })

  doc.end()
}))

export default r
