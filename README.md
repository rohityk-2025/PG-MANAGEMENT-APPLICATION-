 # PGManager v4

A full-stack Paying Guest (PG) management platform built for Indian property owners and managers. Handles tenant lifecycle, rent collection, complaints, expenses, visual bed maps, reports, and police verification — all in one app.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Design](#database-design)
- [Backend Structure](#backend-structure)
- [Frontend Structure](#frontend-structure)
- [Features](#features)
- [OOP Concepts Applied](#oop-concepts-applied)
- [SOLID Principles Applied](#solid-principles-applied)
- [Design Patterns](#design-patterns)
- [Security](#security)
- [Storage](#storage)
- [API Reference](#api-reference)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)

---

## Overview

PGManager v4 is a multi-role web application that supports three user types:

| Role    | Capabilities |
|---------|-------------|
| Owner   | Manage properties, view reports, manage staff, analytics |
| Manager | Daily operations — tenants, rent, complaints, expenses, bed map |
| Tenant  | Pay rent, raise complaints, view notices, download receipts |

Authentication uses **bcrypt + JWT** (stateless, no Supabase Auth dependency). All file uploads go to **Supabase Storage** buckets. The database is **PostgreSQL via Supabase** with RLS enabled for defense-in-depth.

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js 20 + ES Modules | Runtime |
| Express.js 4 | HTTP framework, routing, middleware |
| Supabase JS Client (service role) | Database access (PostgreSQL) |
| bcryptjs | Password hashing (cost factor 12) |
| jsonwebtoken (JWT) | Stateless authentication tokens |
| PDFKit | Server-side PDF generation (police verification form, reports) |
| ExcelJS | Excel report generation (.xlsx) |
| dotenv | Environment variable management |
| nodemon | Development hot-reload |

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI library |
| Vite | Build tool and dev server |
| TailwindCSS | Utility-first styling |
| TanStack Query (React Query) | Server state management, caching, refetching |
| React Router v6 | Client-side routing, role-based layouts |
| Recharts | Charts and analytics visualisation |
| xlsx (SheetJS) | Client-side Excel export |
| jsPDF + autotable | Client-side PDF generation |
| lucide-react | Icon library |
| date-fns | Date formatting and arithmetic |
| react-hot-toast | Toast notifications |
| Framer Motion | Notification drawer animation |

### Database & Infrastructure
| Technology | Purpose |
|---|---|
| PostgreSQL 15 (via Supabase) | Primary relational database |
| Supabase Storage | File/image storage (6 buckets) |
| Supabase Row Level Security | Defense-in-depth access control |
| UUID v4 | Primary keys for all tables |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT (React)                      │
│  TanStack Query ──► api.js (Axios wrapper) ──► JWT Auth  │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS REST
┌───────────────────────────▼─────────────────────────────┐
│                   EXPRESS API SERVER                      │
│                                                          │
│  index.js                                                │
│  ├── middleware/auth.js   (requireAuth, requireRole)     │
│  └── routes/                                             │
│       ├── auth.js         (register, login, me)          │
│       ├── upload.js       (base64 → Supabase Storage)    │
│       ├── properties.js                                  │
│       ├── floors.js                                      │
│       ├── rooms.js        (auto-creates beds on insert)  │
│       ├── beds.js                                        │
│       ├── tenancies.js    (assign, approve, checkout)    │
│       ├── rent.js         (generate, confirm, reject)    │
│       ├── verification.js (BGV + police PDF)             │
│       ├── complaints.js                                  │
│       ├── expenses.js                                    │
│       ├── broadcasts.js                                  │
│       ├── notifications.js                               │
│       ├── dashboard.js    (owner, manager, tenant)       │
│       ├── staff.js        (invites, assign, deactivate)  │
│       └── reports.js      (Excel + PDF, 6 report types)  │
└───────────────────────────┬─────────────────────────────┘
                            │ Supabase JS (service_role)
┌───────────────────────────▼─────────────────────────────┐
│                    SUPABASE LAYER                         │
│  ┌──────────────────┐     ┌──────────────────────────┐  │
│  │   PostgreSQL DB   │     │    Supabase Storage       │  │
│  │  18 tables        │     │  profiles (public)        │  │
│  │  14 custom enums  │     │  documents (private)      │  │
│  │  8 triggers       │     │  payments (private)       │  │
│  │  RLS on all tables│     │  property-assets (public) │  │
│  │  Indexes on FK    │     │  complaints (private)     │  │
│  └──────────────────┘     │  expenses (private)       │  │
│                            └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Request Lifecycle

```
Request → CORS → JSON parse → requireAuth (JWT verify)
        → requireRole (owner/manager/tenant/staff)
        → Route handler (async, wrapped in asyncHandler)
        → supabaseAdmin query
        → Response JSON
        → Error handler (500 fallback)
```

### Authentication Flow

```
Register/Login
     │
     ▼
bcrypt.compare(password, hash)   ← cost factor 12
     │
     ▼
jwt.sign({ id, role, email, organization_id })
     │
     ▼
Token stored in localStorage as 'pg_token'
     │
     ▼
Every API request: Authorization: Bearer <token>
     │
     ▼
requireAuth middleware: jwt.verify(token, JWT_SECRET)
     │
     ▼
req.user = { id, role, email, organization_id }
```

---

## Database Design

The schema follows a clean **hierarchical ownership model**:

```
Organization
  └── Properties
        ├── Property Staff (managers assigned here)
        ├── Floors
        │     └── Rooms (room_type enum)
        │           └── Beds (bed_status enum, auto-created on room insert)
        │                 └── Tenancies (active assignment of tenant to bed)
        │                       ├── Rent Records (one per month per tenant)
        │                       ├── Background Verifications (3-step BGV)
        │                       └── Dues (extra charges)
        ├── Complaints
        │     └── Complaint Activities (timeline)
        ├── Expenses
        └── Broadcasts
              └── Broadcast Reads

Users (all roles in one table — owner, manager, tenant, staff)
  └── Notifications
```

### Key Design Decisions

**Single Users Table**  
All roles live in one `users` table with a `user_role` enum. This simplifies JOINs, avoids cross-table role lookups, and makes notifications trivial — every notification just has a `user_id`.

**No Supabase Auth Dependency**  
`users.id` is a standalone `UUID PRIMARY KEY` (not a FK to `auth.users`). The `password_hash` column stores bcrypt hashes. The app controls its own identity, making it portable to any PostgreSQL host.

**Beds as First-Class Entities**  
Beds are not computed from room capacity — they are real rows in the `beds` table. This allows individual bed-level status tracking (`vacant`, `occupied`, `maintenance`, `reserved`, `notice_period`), which powers the visual bed map.

**Auto-Triggers**  
Eight database triggers handle derived state automatically:
- `update_updated_at` — keeps `updated_at` fresh on all tables
- `fill_month_year` — computes `month_year` text (e.g. "2025-06") on rent records
- `update_bed_on_tenancy` — flips bed status to `occupied` on tenancy insert, `vacant` on checkout, `notice_period` when notice is given
- `generate_receipt_number` — auto-generates `RCPT-2025-06-0001` format receipt numbers when rent is marked paid
- `update_user_verified_status` — sets `users.is_verified = true` (blue tick) when all 3 background verifications pass

### Custom Enums (14 total)

```sql
user_role           -- owner, manager, tenant, staff
bed_status          -- vacant, occupied, maintenance, reserved, notice_period
room_type           -- single, double, triple, dormitory
payment_frequency   -- daily, weekly, fortnightly, monthly, quarterly
rent_status         -- pending, pending_confirmation, paid, overdue, waived
payment_mode        -- cash, upi, neft, cheque, other
complaint_status    -- open, under_process, assigned, resolved, closed
complaint_urgency   -- urgent, moderate, low
complaint_category  -- wifi, food, plumbing, electrical, cleanliness, furniture, security, noise, other
notification_type   -- rent_due, complaint_update, broadcast, approval, payment_confirmed, deposit_refund, system
broadcast_audience  -- all, floor, room, individual
verification_status -- pending, verified, rejected
expense_category    -- plumbing, electrical, cleaning, furniture, food, water, maintenance, salary, other
```

Enums enforce valid values at the database level — no invalid status strings can enter the system.

### Indexes

26 indexes covering all foreign keys and frequently filtered columns (`status`, `is_active`, `year/month`, `user_id`). All junction table columns are indexed. This keeps dashboard queries fast even at thousands of records.

---

## Backend Structure

```
backend/
├── index.js                  # App entry, route registration, error handler
├── package.json
├── .env.example
├── lib/
│   ├── supabase.js            # Supabase service role client (singleton)
│   └── storage.js             # uploadToStorage(), getSignedUrl() helpers
├── middleware/
│   └── auth.js                # requireAuth, requireRole, asyncHandler
└── routes/
    ├── auth.js                # register, login, me, change-password, accept-invite
    ├── upload.js              # base64 file upload → Supabase Storage
    ├── properties.js          # CRUD, org-scoped
    ├── floors.js              # CRUD per property
    ├── rooms.js               # CRUD + auto bed creation
    ├── beds.js                # status updates, add/delete
    ├── tenancies.js           # assign, approve, notice, checkout
    ├── rent.js                # generate monthly, submit/confirm/reject payment
    ├── verification.js        # BGV CRUD + police PDF generator
    ├── complaints.js          # CRUD + status transitions + activities
    ├── expenses.js            # CRUD + category filter
    ├── broadcasts.js          # send to all/floor/room/individual
    ├── notifications.js       # list, mark read, mark all read
    ├── dashboard.js           # owner/manager/tenant dashboards
    ├── staff.js               # invite, list, assign, deactivate
    └── reports.js             # 6 report types, Excel + PDF export
```

### Middleware Chain

```javascript
requireAuth(req, res, next)
  // Verifies JWT, populates req.user = { id, role, email, organization_id }

requireRole('owner', 'manager')(req, res, next)
  // Checks req.user.role is in the allowed list

asyncHandler(fn)
  // Wraps async route handlers, passes errors to Express error middleware
```

---

## Frontend Structure

```
frontend/src/
├── main.jsx                   # React root
├── App.jsx                    # Router, role-based route guards
├── lib/
│   ├── api.js                 # axios wrapper with Bearer token injection
│   └── supabase.js            # Supabase anon client (Storage only, no auth)
├── context/
│   └── AuthContext.jsx        # login(), logout(), profile state, role
├── hooks/
│   └── useProperty.js         # property selector with localStorage persistence
├── components/
│   ├── ui/
│   │   ├── Button.jsx         # variants: primary, secondary, outline, danger, success
│   │   ├── Input.jsx          # label, error, required support
│   │   ├── Select.jsx
│   │   ├── Textarea.jsx
│   │   ├── Modal.jsx          # keyboard dismiss, backdrop click
│   │   ├── BottomSheet.jsx    # mobile slide-up sheet
│   │   ├── Badge.jsx          # status badge + statusBadge() helper
│   │   ├── Avatar.jsx         # initials fallback with deterministic colour
│   │   ├── Card.jsx
│   │   ├── StatCard.jsx
│   │   ├── ProgressBar.jsx
│   │   ├── EmptyState.jsx
│   │   ├── Skeleton.jsx       # SkeletonCard, SkeletonStat, SkeletonLine
│   │   └── FileUpload.jsx     # drag/drop, 5MB guard, image preview
│   └── layout/
│       ├── Sidebar.jsx        # desktop sidebar, role-aware nav
│       ├── TopBar.jsx         # mobile header with back button
│       ├── NotificationDrawer.jsx  # slide-in drawer with Framer Motion
│       ├── OwnerLayout.jsx
│       ├── ManagerLayout.jsx
│       └── TenantLayout.jsx
└── pages/
    ├── auth/
    │   ├── LoginPage.jsx             # email+password login
    │   ├── TenantRegisterPage.jsx    # 4-step wizard (account, personal, work, docs)
    │   ├── AcceptInvitePage.jsx      # manager invite accept
    │   └── PendingApprovalPage.jsx
    ├── owner/
    │   ├── Dashboard.jsx
    │   ├── Properties.jsx
    │   ├── PropertyDetail.jsx        # floors + rooms accordion
    │   ├── Staff.jsx
    │   ├── Reports.jsx               # charts + Excel/PDF export
    │   └── Profile.jsx
    ├── manager/
    │   ├── Dashboard.jsx
    │   ├── RoomBedMap.jsx            # visual bed map (new feature)
    │   ├── TenantList.jsx
    │   ├── TenantDetail.jsx          # BGV tabs, verification, police PDF
    │   ├── RentCollection.jsx
    │   ├── Complaints.jsx            # kanban (desktop) + list (mobile)
    │   ├── Expenses.jsx
    │   └── Broadcast.jsx
    └── tenant/
        ├── Dashboard.jsx
        ├── Rent.jsx                  # UPI QR, screenshot upload, receipt
        ├── Complaints.jsx
        ├── Notices.jsx
        └── Profile.jsx
```

### State Management

TanStack Query handles all server state. Each resource has a stable query key:

```javascript
['manager-dashboard', property_id]
['rent-collection', 'YYYY-MM']
['tenancies', property_id, status]
['verification', tenant_id]
```

Mutations call `queryClient.invalidateQueries()` on success to keep the UI in sync without manual state updates.

---

## Features

### Existing Features (preserved from v3)
- Email + password authentication for all roles
- Multi-property management per owner
- Floor → Room → Bed hierarchy
- Tenant registration wizard (4 steps, full personal/document info)
- Tenant assignment to specific beds
- Monthly rent generation and collection
- Payment screenshot upload and manager confirmation
- Complaints with urgency levels and Kanban board (desktop)
- Broadcasts to all / by floor / by room / to individual
- In-app notification drawer
- Expenses tracking with categories
- Manager invite via token link
- Staff management

### New Features (v4 additions)

**Visual Bed Map**  
Floor-wise tab navigation. Every bed shown as a coloured tile:
- Green = Vacant
- Red = Occupied
- Amber = Notice Period
- Grey = Maintenance
- Blue outline = Reserved

Clicking a bed opens tenant details (if occupied).

**Background Verification (3-step BGV)**  
- Police Verification, Aadhaar Verification, Work/Study Verification
- Each has status (pending/verified/rejected) and notes
- When all 3 pass → `users.is_verified = true` (blue tick shown in app)
- Blue tick visible on tenant profile and tenant list

**Police Verification PDF Generator**  
Server-side PDF (PDFKit) with:
- Property details
- Tenant personal info (full name, DOB, gender, phone, occupation, address)
- Guardian details
- Document checklist
- Signature lines for tenant, manager, police officer

**Reports & Analytics (6 types)**
- Collection Report — rent collected vs expected per month
- Expenses Report — by category with pie chart
- Occupancy Report — bed utilisation rate over time (line chart)
- Income vs Expense — comparison bar chart
- Tenant Report — check-ins, checkouts, active tenants
- Comparison Report — this month vs last month, this year vs last year

All reports support:
- Day / date range / weekly / monthly / yearly filters
- Excel export (.xlsx via ExcelJS)
- PDF export (PDFKit with auto-table)

**Supabase Storage for All Images**  
Every image/document goes to a typed bucket:
- `profiles` — public profile photos
- `documents` — private (Aadhaar, PAN, DL, Passport)
- `payments` — private (rent screenshots)
- `property-assets` — public (logos, QR codes)
- `complaints` — private (complaint photos)
- `expenses` — private (receipts)

Upload via `/api/upload` — accepts base64 JSON body, returns URL. Frontend never needs the Supabase anon key for uploads.

---

## OOP Concepts Applied

### Encapsulation
Each route file encapsulates all logic for one resource. `complaints.js` only knows about complaints. The `supabase.js` lib encapsulates the client creation — no route imports `@supabase/supabase-js` directly. `storage.js` encapsulates upload/signed-URL logic behind a clean function interface.

### Abstraction
`asyncHandler(fn)` abstracts away the try/catch boilerplate from every route. `requireAuth` and `requireRole` abstract authentication concerns — route handlers only see `req.user` without caring how it was populated. The `api.js` frontend module abstracts axios configuration — components call `api.get('/api/tenancies')` without knowing anything about headers or base URLs.

### Composition
Middleware is composed per-route. A single route stacks multiple concerns:
```javascript
router.post('/:id/approve', requireAuth, requireRole('manager','owner'), asyncHandler(handler))
```
Each function does one thing. The Express pipeline composes them.

### Inheritance (via Layout composition)
`OwnerLayout`, `ManagerLayout`, and `TenantLayout` share `Sidebar`, `TopBar`, and `NotificationDrawer` via composition. The `Sidebar` component reads `role` from `AuthContext` and renders the correct nav without each layout needing to redefine it.

---

## SOLID Principles Applied

### S — Single Responsibility Principle
Each route file has one responsibility: one resource, one set of CRUD operations. `middleware/auth.js` only handles authentication and authorisation. `lib/storage.js` only handles file storage operations. `lib/supabase.js` only creates the database client.

On the frontend, each page component renders one view. `AuthContext` only manages auth state. `api.js` only handles HTTP. `useProperty` only manages property selection.

### O — Open/Closed Principle
New report types can be added to `routes/reports.js` by adding a new case to the report type switch — no existing report logic is modified. New notification types can be added to the `notification_type` enum without changing the notification system itself. New UI components are built by composing existing primitives (`Button`, `Card`, `Badge`) without modifying them.

### L — Liskov Substitution Principle
All route handlers follow the same `(req, res)` contract and are interchangeable as Express handlers. All UI form components (`Input`, `Select`, `Textarea`) accept `value` + `onChange` in the same pattern and can substitute for each other in forms.

### I — Interface Segregation Principle
`requireRole` takes only the roles it needs:
```javascript
requireRole('owner')            // only owner
requireRole('manager','owner')  // manager or owner
```
No route is forced to depend on permissions it doesn't need. Tenants have their own narrowly-scoped endpoints. The `FileUpload` component only exposes `onFile` — it doesn't force callers to handle preview state or error state internally.

### D — Dependency Inversion Principle
Route handlers depend on the `supabaseAdmin` abstraction, not on direct PostgreSQL connections. If the database provider changes, only `lib/supabase.js` changes. Frontend components depend on `api.get/post/patch/delete` — not on axios directly. The storage helpers in `lib/storage.js` are the abstraction layer between routes and Supabase Storage.

---

## Design Patterns

### Middleware Chain Pattern (Express)
Authentication, authorisation, and error handling are separated as composable middleware. Each middleware has a single concern and calls `next()` to hand off.

### Repository-like Pattern
Each route file acts as a data access layer for its resource. All database queries for `complaints` live in `routes/complaints.js`. This is not a full Repository pattern (no interface/class) but follows the same principle of centralised data access per entity.

### Observer Pattern (Notifications)
When key events occur (payment confirmed, complaint updated, account approved), the handler inserts a row into the `notifications` table. The frontend polls via TanStack Query. This is a lightweight async observer — the action handler doesn't know who is listening.

### Factory Pattern (Token generation)
`signToken(user)` in `routes/auth.js` is a factory function: given any user object, it produces a standardised JWT with the correct claims. All routes that need to issue tokens call this one function.

### Strategy Pattern (Reports)
The reports route handles 6 report types using a strategy-like switch. Each report type is a different data-fetching and formatting strategy. Adding a new report type adds a new strategy without changing the execution engine.

### Compound Component Pattern (UI)
`Badge` + `statusBadge()` is a compound pattern — the base component handles styling, the helper function handles the status-to-variant mapping. Consumers can use either depending on whether they have a status string or need manual control.

### Context + Provider Pattern (Auth)
`AuthContext` provides `{ user, profile, role, login, logout }` to the entire tree. Components consume it without prop drilling. This is the standard React Context pattern used for global state that changes infrequently.

---

## Security

| Layer | Mechanism |
|---|---|
| Passwords | bcrypt with cost factor 12 (~250ms hash time) |
| Tokens | JWT signed with HS256, 7-day expiry, stored in localStorage |
| Route protection | `requireAuth` middleware on all non-public routes |
| Role enforcement | `requireRole()` checked before any write operation |
| Database | Supabase service role key used server-side only (never sent to client) |
| RLS | Row Level Security enabled on all 18 tables (defense-in-depth) |
| File uploads | Server validates bucket type, user is authenticated before any upload |
| Tenant isolation | Tenant routes always filter by `req.user.id`, can't access other tenants' data |
| Input validation | Required field checks before any database insert |

**What the client never sees:**
- `SUPABASE_SERVICE_KEY` — server-side only
- `JWT_SECRET` — server-side only
- `password_hash` — stripped from all responses before sending

---

## Storage

| Bucket | Public | Contents | Max Size |
|---|---|---|---|
| `profiles` | Yes | Profile photos | 5 MB |
| `documents` | No | Aadhaar, PAN, DL, Passport | 5 MB |
| `payments` | No | Rent payment screenshots | 5 MB |
| `property-assets` | Yes | Property logos, UPI QR codes | 5 MB |
| `complaints` | No | Complaint photos | 10 MB |
| `expenses` | No | Expense receipts | 5 MB |

Public buckets return a permanent public URL. Private buckets return a 7-day signed URL. All uploads go through `/api/upload` (backend) to keep the service key private.

---

## API Reference

### Auth
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Owner registration |
| POST | `/api/auth/register-tenant` | Public | Tenant registration (full form) |
| POST | `/api/auth/login` | Public | Login → JWT |
| GET | `/api/auth/me` | Any | Get own profile |
| PATCH | `/api/auth/me` | Any | Update own profile |
| PATCH | `/api/auth/change-password` | Any | Change password |
| POST | `/api/auth/accept-invite` | Public | Manager accepts invite token |

### Properties
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/properties` | Owner/Manager | List own properties |
| GET | `/api/properties/:id` | Any | Property with floors/rooms/beds |
| POST | `/api/properties` | Owner | Create property |
| PATCH | `/api/properties/:id` | Owner/Manager | Update property |

### Rooms & Beds
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/rooms` | Owner/Manager | Create room + auto-generate beds |
| GET | `/api/beds?property_id=&status=` | Any | List beds with filters |
| PATCH | `/api/beds/:id` | Owner/Manager | Update bed status |

### Tenancies
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/tenancies?property_id=&status=` | Manager/Owner | List tenancies |
| GET | `/api/tenancies/my` | Tenant | Own active tenancy |
| POST | `/api/tenancies` | Manager/Owner | Assign tenant to bed |
| POST | `/api/tenancies/:id/approve` | Manager/Owner | Approve tenant |
| POST | `/api/tenancies/:id/notice` | Manager/Owner | Give notice |
| POST | `/api/tenancies/:id/checkout` | Manager/Owner | End tenancy |

### Rent
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/rent?property_id=&month=&year=` | Any | List rent records |
| GET | `/api/rent/collection?month=YYYY-MM&property_id=` | Manager/Owner | Collection summary |
| POST | `/api/rent/generate-monthly` | Manager/Owner | Generate records for a month |
| PATCH | `/api/rent/:id/submit-payment` | Tenant | Upload screenshot |
| PATCH | `/api/rent/:id/confirm-payment` | Manager/Owner | Confirm payment |
| PATCH | `/api/rent/:id/reject-payment` | Manager/Owner | Reject screenshot |

### Verification
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/verification/:tenant_id` | Manager/Owner | Get BGV record |
| PATCH | `/api/verification/:tenant_id` | Manager/Owner | Update verification status/notes |
| GET | `/api/verification/:tenant_id/police-pdf` | Manager/Owner | Download police verification PDF |

### Reports
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/reports/:type?start=&end=&property_id=` | Owner/Manager | JSON data |
| GET | `/api/reports/:type/excel` | Owner/Manager | Download .xlsx |
| GET | `/api/reports/:type/pdf` | Owner/Manager | Download .pdf |

Report types: `collection`, `expenses`, `occupancy`, `income_expense`, `tenants`, `comparison`

### Upload
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/upload` | Any | Upload base64 file → Supabase Storage URL |

---

## Setup & Installation

### Prerequisites
- Node.js 20+
- A Supabase project (free tier works)

### 1. Database setup
```
1. Open your Supabase project → SQL Editor
2. Paste the entire contents of schema.sql
3. Click Run
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env
# Fill in your Supabase URL, service key, and JWT secret
npm install
npm run dev
```

### 3. Frontend setup
```bash
cd frontend
cp .env.example .env
# Set VITE_API_URL=http://localhost:3001
npm install
npm run dev
```

### 4. Create first owner account
Hit `POST /api/auth/register` with:
```json
{
  "full_name": "Your Name",
  "email": "you@email.com",
  "password": "yourpassword",
  "org_name": "Your PG Name"
}
```
You'll get a JWT back. Use it in the Authorization header for all subsequent requests.

---

## Environment Variables

### Backend (.env)
```env
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...           # service_role key (keep secret)
SUPABASE_ANON_KEY=eyJ...              # anon key (used only for storage policy reference)
JWT_SECRET=your-32-char-minimum-secret
JWT_EXPIRES_IN=7d
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...         # anon key (Storage uploads only)
```

> **Security note:** `SUPABASE_SERVICE_KEY` must never be in frontend code. It bypasses all RLS. The frontend only uses the anon key, which is safe to expose.

---

## Project Structure Summary

```
pgmanager-v4/
├── schema.sql                 # Complete PostgreSQL schema
├── backend/
│   ├── index.js
│   ├── package.json
│   ├── .env.example
│   ├── lib/
│   │   ├── supabase.js
│   │   └── storage.js
│   ├── middleware/
│   │   └── auth.js
│   └── routes/               # 16 route files
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── lib/              # api.js, supabase.js
        ├── context/          # AuthContext
        ├── hooks/            # useProperty
        ├── components/       # 14 UI components + 6 layout components
        └── pages/            # 20+ pages across owner/manager/tenant/auth
```

---

*PGManager v4 — Built for Indian PG operators. Handles the full lifecycle from tenant onboarding to monthly reporting.*
