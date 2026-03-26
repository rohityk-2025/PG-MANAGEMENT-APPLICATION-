# PGManager Backend v2

## Tech Stack
- Node.js + Express
- JWT (jsonwebtoken + bcryptjs) for auth — no Supabase Auth
- Supabase service role client for DB access (bypasses RLS)
- ExcelJS for Excel report generation
- PDFKit for PDF report generation

## Setup

1. Copy `.env.example` to `.env` and fill in values
2. `npm install`
3. `npm run dev` for development, `npm start` for production

## Environment Variables

| Variable | Description |
|---|---|
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Service role key (from Supabase Settings > API) |
| JWT_SECRET | Random 64-char secret for signing JWTs |
| CLIENT_URL | Frontend URL for CORS (e.g. http://localhost:5173) |
| PORT | Port to listen on (default: 3001) |

## API Routes

| Route | Description |
|---|---|
| POST /api/auth/register | Tenant self-signup |
| POST /api/auth/login | Login for all roles |
| POST /api/auth/create-owner | Create PG owner + organization |
| POST /api/auth/create-staff | Owner creates manager/staff |
| GET /api/auth/me | Get current user |
| GET /api/properties | List properties |
| GET /api/rooms?property_id= | List rooms with beds |
| GET /api/rooms/:property_id/floors | Get floors with rooms/beds |
| GET /api/map/:property_id | Visual map data |
| GET /api/tenants?property_id= | List tenants |
| GET /api/tenants/:id | Tenant full detail |
| GET /api/rent?property_id= | Rent records |
| POST /api/rent/generate | Generate monthly dues |
| POST /api/rent/:id/confirm | Mark rent as paid |
| GET /api/reports/collections | Collection report |
| GET /api/reports/expenses | Expense report |
| GET /api/reports/collections/excel | Download Excel |
| GET /api/reports/collections/pdf | Download PDF |
| GET /api/reports/expenses/excel | Download Excel |
| GET /api/reports/expenses/pdf | Download PDF |
| GET /api/verification/:tenant_id | Get verification status |
| PATCH /api/verification/:tenant_id | Update verification |
| GET /api/verification/:tenant_id/pdf | Download police form PDF |
| GET /api/dashboard/owner | Owner dashboard stats |
| GET /api/dashboard/manager | Manager dashboard stats |
| GET /api/dashboard/tenant | Tenant dashboard data |
