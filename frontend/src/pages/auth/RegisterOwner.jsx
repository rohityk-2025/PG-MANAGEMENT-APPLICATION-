import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'

export default function RegisterOwner() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', org_name: '' })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { token, user } = await api.post('/api/auth/create-owner', form)
      login(token, user)
      navigate('/owner')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/login" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Login
        </Link>
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <h1 className="font-display text-2xl font-bold text-white mb-1">Set up your PG</h1>
          <p className="text-white/40 text-sm mb-6">Create your owner account and PG organization</p>
          <form onSubmit={submit} className="space-y-4">
            {[
              ['PG / Organization Name *', 'org_name', 'text', 'Sunrise PG Hostel'],
              ['Your Full Name *', 'full_name', 'text', 'Rajesh Sharma'],
              ['Email *', 'email', 'email', 'owner@email.com'],
              ['Password *', 'password', 'password', 'Create a strong password'],
              ['Phone', 'phone', 'tel', '9876543210'],
            ].map(([label, key, type, ph]) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">{label}</label>
                <input type={type} value={form[key]} onChange={set(key)} placeholder={ph} required={label.includes('*')}
                  className="w-full h-10 px-3.5 auth-input bg-[#1E1E30] border border-white/10 hover:border-white/25 focus:border-brand-400 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all" />
              </div>
            ))}
            <button type="submit" disabled={loading}
              className="w-full h-11 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-sm mt-2">
              {loading ? 'Creating...' : 'Create Owner Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
