import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

// Auth pages
import Login         from './pages/auth/Login'
import Register      from './pages/auth/Register'
import RegisterOwner from './pages/auth/RegisterOwner'

// Layout wrapper (sidebar + topbar)
import AppLayout from './components/layout/AppLayout'

// Owner pages
import OwnerDashboard  from './pages/owner/Dashboard'
import OwnerProperties from './pages/owner/Properties'
import OwnerRooms      from './pages/owner/Rooms'
import OwnerTenants    from './pages/owner/Tenants'
import OwnerPayments   from './pages/owner/Payments'
import OwnerExpenses   from './pages/owner/Expenses'
import OwnerComplaints from './pages/owner/Complaints'
import OwnerBroadcast  from './pages/owner/Broadcast'
import OwnerReports    from './pages/owner/Reports'
import OwnerStaff      from './pages/owner/Staff'
import OwnerProfile    from './pages/owner/Profile'
import BuildingMap     from './pages/owner/BuildingMap'

// Shared manager/owner pages
import TenantDetail    from './pages/manager/TenantDetail'

// Tenant pages
import TenantDashboard  from './pages/tenant/Dashboard'
import TenantRent       from './pages/tenant/Rent'
import TenantComplaints from './pages/tenant/Complaints'
import TenantNotices    from './pages/tenant/Notices'
import TenantProfile    from './pages/tenant/Profile'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
})

// Route guard: redirects to login if not authenticated, to correct dashboard if wrong role
function Guard({ allowed }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-[#F4F5FA] flex items-center justify-center">
      <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (allowed && !allowed.includes(user.role)) return <Navigate to={`/${user.role}`} replace />
  return <Outlet />
}

// Keep logged-in users away from auth pages
function AuthGuard({ children }) {
  const { user } = useAuth()
  if (user) return <Navigate to={`/${user.role}`} replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login"          element={<AuthGuard><Login /></AuthGuard>} />
      <Route path="/register"       element={<AuthGuard><Register /></AuthGuard>} />
      <Route path="/register-owner" element={<AuthGuard><RegisterOwner /></AuthGuard>} />
      <Route path="/"               element={<Navigate to="/login" replace />} />

      {/* Owner routes */}
      <Route element={<Guard allowed={['owner']} />}>
        <Route path="/owner" element={<AppLayout />}>
          <Route index                  element={<OwnerDashboard  />} />
          <Route path="map"             element={<BuildingMap     />} />
          <Route path="properties"      element={<OwnerProperties />} />
          <Route path="rooms"           element={<OwnerRooms      />} />
          <Route path="tenants"         element={<OwnerTenants    />} />
          <Route path="tenants/:id"     element={<TenantDetail    />} />
          <Route path="payments"        element={<OwnerPayments   />} />
          <Route path="expenses"        element={<OwnerExpenses   />} />
          <Route path="complaints"      element={<OwnerComplaints />} />
          <Route path="broadcasts"      element={<OwnerBroadcast  />} />
          <Route path="reports"         element={<OwnerReports    />} />
          <Route path="staff"           element={<OwnerStaff      />} />
          <Route path="profile"         element={<OwnerProfile    />} />
        </Route>
      </Route>

      {/* Manager routes — subset of owner pages */}
      <Route element={<Guard allowed={['manager']} />}>
        <Route path="/manager" element={<AppLayout />}>
          <Route index                  element={<OwnerDashboard  />} />
          <Route path="map"             element={<BuildingMap     />} />
          <Route path="rooms"           element={<OwnerRooms      />} />
          <Route path="tenants"         element={<OwnerTenants    />} />
          <Route path="tenants/:id"     element={<TenantDetail    />} />
          <Route path="payments"        element={<OwnerPayments   />} />
          <Route path="expenses"        element={<OwnerExpenses   />} />
          <Route path="complaints"      element={<OwnerComplaints />} />
          <Route path="broadcasts"      element={<OwnerBroadcast  />} />
          <Route path="profile"         element={<OwnerProfile    />} />
        </Route>
      </Route>

      {/* Tenant routes */}
      <Route element={<Guard allowed={['tenant']} />}>
        <Route path="/tenant" element={<AppLayout />}>
          <Route index                  element={<TenantDashboard  />} />
          <Route path="rent"            element={<TenantRent       />} />
          <Route path="complaints"      element={<TenantComplaints />} />
          <Route path="notices"         element={<TenantNotices    />} />
          <Route path="profile"         element={<TenantProfile    />} />
        </Route>
      </Route>

      {/* Catch-all redirects to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '12px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              },
              success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
