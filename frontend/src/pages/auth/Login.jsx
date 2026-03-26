import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Building2, ShieldCheck, BarChart3 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'

export default function Login() {
  const [form, setForm]   = useState({ email: '', password: '' })
  const [show, setShow]   = useState(false)
  const [loading, setLoading] = useState(false)
  const { login }   = useAuth()
  const navigate    = useNavigate()
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { token, user } = await api.post('/api/auth/login', form)
      login(token, user)
      const dest = user.role === 'owner' ? '/owner' : user.role === 'manager' ? '/manager' : '/tenant'
      navigate(dest)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0F0F1A] flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-5/12 p-14 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }} />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 -left-10 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />

        <div className="relative">
          <span className="font-display text-2xl font-bold text-white">
            PG<span className="text-brand-400">Manager</span>
          </span>
        </div>

        <div className="relative space-y-8">
          <div>
            <h2 className="font-display text-4xl font-bold text-white leading-tight">
              The smarter way<br />to <span className="text-brand-400">run your PG.</span>
            </h2>
            <p className="text-white/40 text-base leading-relaxed mt-4 max-w-xs">
              Manage rooms, tenants, rent collection and complaints — all from one place.
            </p>
          </div>

          <div className="space-y-3">
            {[
              [Building2,  'Visual Room Map',  'See all beds with live occupancy status'],
              [BarChart3,  'Smart Reports',    'Excel and PDF reports with charts'],
              [ShieldCheck,'Role-Based Access','Owner, Manager and Tenant dashboards'],
            ].map(([Icon, t, s]) => (
              <div key={t} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-brand-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4.5 h-4.5 text-brand-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{t}</p>
                  <p className="text-white/30 text-xs">{s}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-white/20 text-xs">2025 PGManager. All rights reserved.</p>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden text-center mb-10">
            <span className="font-display text-2xl font-bold text-white">PG<span className="text-brand-400">Manager</span></span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
            <h1 className="font-display text-2xl font-bold text-white mb-1">Welcome back</h1>
            <p className="text-white/40 text-sm mb-7">Sign in to continue to your dashboard</p>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Email</label>
                <input
                  type="email" required value={form.email} onChange={set('email')}
                  placeholder="you@email.com"
                  className="w-full h-11 px-4 auth-input bg-[#1E1E30] border border-white/10 hover:border-white/25 focus:border-brand-400 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'} required value={form.password} onChange={set('password')}
                    placeholder="Enter your password"
                    className="w-full h-11 px-4 pr-11 auth-input bg-[#1E1E30] border border-white/10 hover:border-white/25 focus:border-brand-400 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all focus:ring-2 focus:ring-brand-500/20"
                  />
                  <button type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full h-11 mt-1 bg-brand-500 hover:bg-brand-600 active:scale-[.98] disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-sm font-display">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-white/30 text-xs mt-6">
              New tenant?{' '}
              <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">Create account</Link>
            </p>

            <p className="text-center text-white/30 text-xs mt-2">
              First time as Owner?{' '}
              <Link to="/register-owner" className="text-brand-400 hover:text-brand-300 font-medium">Set up your PG</Link>
            </p>
          </div>

          <p className="text-center text-white/15 text-xs mt-5">
            Manager accounts are created by the owner
          </p>
        </div>
      </div>
    </div>
  )
}
