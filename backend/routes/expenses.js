import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, role, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth, role('owner', 'manager'))

r.get('/', asyncHandler(async (req, res) => {
  const { property_id, from, to } = req.query
  if (!property_id) return res.status(400).json({ error: 'property_id is required' })

  let q = db.from('expenses').select('*, added_by_user:users!added_by(full_name)').eq('property_id', property_id)
  if (from) q = q.gte('date', from)
  if (to)   q = q.lte('date', to)
  const { data, error } = await q.order('date', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  res.json(data || [])
}))

r.post('/', asyncHandler(async (req, res) => {
  const { title, category, amount, date, notes, property_id, description, receipt_url } = req.body
  if (!title || !amount || !property_id) return res.status(400).json({ error: 'title, amount, property_id required' })

  const { data, error } = await db.from('expenses').insert({
    title, category: category || 'other',
    amount: Number(amount), date: date || new Date().toISOString().split('T')[0],
    notes, description, receipt_url, property_id, added_by: req.user.id,
  }).select('*, added_by_user:users!added_by(full_name)').single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

r.patch('/:id', asyncHandler(async (req, res) => {
  const { title, category, amount, date, notes, description } = req.body
  const update = {}
  if (title !== undefined) update.title = title
  if (category !== undefined) update.category = category
  if (amount !== undefined) update.amount = Number(amount)
  if (date !== undefined) update.date = date
  if (notes !== undefined) update.notes = notes
  if (description !== undefined) update.description = description

  const { data, error } = await db.from('expenses').update(update).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
}))

r.delete('/:id', asyncHandler(async (req, res) => {
  await db.from('expenses').delete().eq('id', req.params.id)
  res.json({ ok: true })
}))

export default r
