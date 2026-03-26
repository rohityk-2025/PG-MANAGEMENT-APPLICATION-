import { Router } from 'express'
import { db } from '../lib/db.js'
import { auth, asyncHandler } from '../middleware/auth.js'

const r = Router()
r.use(auth)

r.get('/', asyncHandler(async (req, res) => {
  const { data } = await db.from('notifications').select('*')
    .eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50)
  res.json(data || [])
}))

r.patch('/:id/read', asyncHandler(async (req, res) => {
  await db.from('notifications').update({ is_read: true }).eq('id', req.params.id).eq('user_id', req.user.id)
  res.json({ ok: true })
}))

r.patch('/read-all', asyncHandler(async (req, res) => {
  await db.from('notifications').update({ is_read: true }).eq('user_id', req.user.id)
  res.json({ ok: true })
}))

export default r
