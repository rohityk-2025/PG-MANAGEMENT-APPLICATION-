import jwt from 'jsonwebtoken'

// Verify the JWT token from the Authorization header
// Returns 401 if missing, 403 if expired or tampered
export function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' })
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Alias for auth middleware (used in newer routes)
export const requireAuth = auth

// Role guard: pass allowed roles, returns 403 if user doesn't have one of them
export function role(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ error: 'Access forbidden for your role' })
    next()
  }
}

// Alias for role guard (used in newer routes)
export function requireRole(...roles) {
  return role(...roles)
}

// Wraps async route handlers so you don't need try/catch everywhere
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
