import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ChevronLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [show, setShow]       = useState(false)
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', phone: '',
    occupation: '', gender: '', date_of_birth: '', permanent_address: '',
    guardian_name: '', guardian_phone: '',
  })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.full_name || !form.email || !form.password)
      return toast.error('Full name, email, and password are required')
    setLoading(true)
    try {
      const { token, user } = await api.post('/api/auth/register', form)
      login(token, user)
      navigate('/tenant')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const field = (label, key, type = 'text', placeholder = '') => (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider">{label}</label>
      <input type={type} value={form[key]} onChange={set(key)} placeholder={placeholder}
        className="w-full h-10 px-3.5 auth-input bg-[#1E1E30] border border-white/10 hover:border-white/25 focus:border-brand-400 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <Link to="/login" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Login
        </Link>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <h1 className="font-display text-2xl font-bold text-white mb-1">Create your account</h1>
          <p className="text-white/40 text-sm mb-6">Fill in your details to register as a tenant</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('Full Name *', 'full_name', 'text', 'Rahul Sharma')}
              {field('Email *', 'email', 'email', 'rahul@email.com')}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider">Password *</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Create a strong password"
                  className="w-full h-10 px-3.5 pr-10 auth-input bg-[#1E1E30] border border-white/10 hover:border-white/25 focus:border-brand-400 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all" />
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('Phone', 'phone', 'tel', '9876543210')}
              {field('Occupation', 'occupation', 'text', 'Student / Software Engineer')}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider">Gender</label>
                <select value={form.gender} onChange={set('gender')}
                  className="w-full h-10 px-3.5 bg-white/8 border border-white/10 focus:border-brand-400 rounded-xl text-sm text-white outline-none appearance-none">
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {field('Date of Birth', 'date_of_birth', 'date')}
            </div>

            {field('Permanent Address', 'permanent_address', 'text', 'Your home address')}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('Guardian Name', 'guardian_name', 'text', 'Parent or guardian')}
              {field('Guardian Phone', 'guardian_phone', 'tel', 'Guardian phone number')}
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-11 bg-brand-500 hover:bg-brand-600 active:scale-[.98] disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-sm font-display mt-2">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-white/30 text-xs mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
