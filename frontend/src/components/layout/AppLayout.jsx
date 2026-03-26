import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, BedDouble, Users, CreditCard,
  Receipt, MessageSquare, Megaphone, BarChart3, UserCog,
  LogOut, Bell, Menu, X, ChevronRight, Map, User, BadgeCheck
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Avatar, Badge } from '../ui'

// Navigation items per role — each role sees a subset of pages
const NAV_ITEMS = {
  owner: [
    { to: '/owner',            icon: LayoutDashboard, label: 'Dashboard'   },
    { to: '/owner/map',        icon: Map,             label: 'Building Map'},
    { to: '/owner/properties', icon: Building2,       label: 'Properties'  },
    { to: '/owner/rooms',      icon: BedDouble,       label: 'Rooms'       },
    { to: '/owner/tenants',    icon: Users,           label: 'Tenants'     },
    { to: '/owner/payments',   icon: CreditCard,      label: 'Payments'    },
    { to: '/owner/expenses',   icon: Receipt,         label: 'Expenses'    },
    { to: '/owner/complaints', icon: MessageSquare,   label: 'Complaints'  },
    { to: '/owner/broadcasts', icon: Megaphone,       label: 'Broadcasts'  },
    { to: '/owner/reports',    icon: BarChart3,       label: 'Reports'     },
    { to: '/owner/staff',      icon: UserCog,         label: 'Staff'       },
    { to: '/owner/profile',    icon: User,            label: 'Profile'     },
  ],
  manager: [
    { to: '/manager',            icon: LayoutDashboard, label: 'Dashboard'   },
    { to: '/manager/map',        icon: Map,             label: 'Building Map'},
    { to: '/manager/rooms',      icon: BedDouble,       label: 'Rooms'       },
    { to: '/manager/tenants',    icon: Users,           label: 'Tenants'     },
    { to: '/manager/payments',   icon: CreditCard,      label: 'Payments'    },
    { to: '/manager/expenses',   icon: Receipt,         label: 'Expenses'    },
    { to: '/manager/complaints', icon: MessageSquare,   label: 'Complaints'  },
    { to: '/manager/broadcasts', icon: Megaphone,       label: 'Broadcasts'  },
    { to: '/manager/profile',    icon: User,            label: 'Profile'     },
  ],
  tenant: [
    { to: '/tenant',             icon: LayoutDashboard, label: 'Dashboard'   },
    { to: '/tenant/rent',        icon: CreditCard,      label: 'My Rent'     },
    { to: '/tenant/complaints',  icon: MessageSquare,   label: 'Complaints'  },
    { to: '/tenant/notices',     icon: Megaphone,       label: 'Notices'     },
    { to: '/tenant/profile',     icon: User,            label: 'Profile'     },
  ],
}

// A single sidebar nav link
function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      end={to.split('/').length === 2}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
            : 'text-[#9CA3AF] hover:bg-[#F4F5FA] hover:text-[#0D0D12]'
        }`
      }
    >
      <Icon className="w-4.5 h-4.5 flex-shrink-0" strokeWidth={1.8} />
      <span>{label}</span>
    </NavLink>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Fetch unread notification count for the bell icon
  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => api.get('/api/notifications'),
    refetchInterval: 60_000,
  })
  const unreadCount = notifs.filter(n => !n.is_read).length

  const navItems = NAV_ITEMS[user?.role] || []

  function doLogout() {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[#E8E9F2]">
        <span className="font-display text-xl font-bold text-[#0D0D12]">
          PG<span className="text-brand-500">Manager</span>
        </span>
        <p className="text-xs text-[#9CA3AF] mt-0.5 capitalize">{user?.role} Portal</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map(item => (
          <NavItem key={item.to} {...item} onClick={() => setSidebarOpen(false)} />
        ))}
      </nav>

      {/* User info and logout at the bottom */}
      <div className="p-4 border-t border-[#E8E9F2]">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <Avatar name={user?.full_name} src={user?.profile_photo_url} size={9} />
            {user?.is_approved && (
              <BadgeCheck className="absolute -bottom-0.5 -right-0.5 w-4 h-4 text-blue-500 bg-white rounded-full" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-xs text-[#0D0D12] truncate">{user?.full_name}</p>
            <p className="text-xs text-[#9CA3AF] truncate capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={doLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#F4F5FA]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-[#E8E9F2] fixed left-0 top-0 bottom-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-2xl">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F4F5FA]">
              <X className="w-4 h-4 text-[#6B7280]" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E8E9F2] px-4 h-14 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#F4F5FA]">
            <Menu className="w-5 h-5 text-[#374151]" />
          </button>
          <span className="font-display text-base font-bold text-[#0D0D12]">PG<span className="text-brand-500">Manager</span></span>
          <div className="relative">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#F4F5FA]">
              <Bell className="w-5 h-5 text-[#374151]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
