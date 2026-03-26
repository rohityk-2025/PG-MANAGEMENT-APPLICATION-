import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import authRoutes         from './routes/auth.js'
import propertyRoutes     from './routes/properties.js'
import roomRoutes         from './routes/rooms.js'
import tenantRoutes       from './routes/tenants.js'
import paymentRoutes      from './routes/payments.js'
import rentRoutes         from './routes/rent.js'
import complaintRoutes    from './routes/complaints.js'
import expenseRoutes      from './routes/expenses.js'
import broadcastRoutes    from './routes/broadcasts.js'
import notificationRoutes from './routes/notifications.js'
import reportRoutes       from './routes/reports.js'
import dashboardRoutes    from './routes/dashboard.js'
import verificationRoutes from './routes/verification.js'
import staffRoutes        from './routes/staff.js'
import mapRoutes          from './routes/map.js'

const app = express()

app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_, res) => res.json({ ok: true, version: '2.0.0' }))

app.use('/api/auth',          authRoutes)
app.use('/api/properties',    propertyRoutes)
app.use('/api/rooms',         roomRoutes)
app.use('/api/tenants',       tenantRoutes)
app.use('/api/payments',      paymentRoutes)
app.use('/api/rent',          rentRoutes)
app.use('/api/complaints',    complaintRoutes)
app.use('/api/expenses',      expenseRoutes)
app.use('/api/broadcasts',    broadcastRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/reports',       reportRoutes)
app.use('/api/dashboard',     dashboardRoutes)
app.use('/api/verification',  verificationRoutes)
app.use('/api/staff',         staffRoutes)
app.use('/api/map',           mapRoutes)

// Global error handler catches anything uncaught
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`PGManager backend running on http://localhost:${PORT}`)
})
