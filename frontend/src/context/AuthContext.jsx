import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // On first load, try to restore the session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('pg_token')
    if (!token) {
      setLoading(false)
      return
    }
    api.get('/api/auth/me')
      .then(u => setUser(u))
      .catch(() => localStorage.removeItem('pg_token'))
      .finally(() => setLoading(false))
  }, [])

  // Store the token and set the user in state after login
  const login = (token, userData) => {
    localStorage.setItem('pg_token', token)
    setUser(userData)
  }

  // Clear the token and user state on logout
  const logout = () => {
    localStorage.removeItem('pg_token')
    localStorage.removeItem('selected_property')
    setUser(null)
  }

  // Update the user in state (e.g. after profile update)
  const updateUser = (updates) => setUser(u => ({ ...u, ...updates }))

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
