# PGManager Frontend v2

## Tech Stack
- React 18 + Vite
- Tailwind CSS
- React Query (data fetching + caching)
- Recharts (charts in Reports)
- Lucide React (icons)
- React Hot Toast (notifications)
- Google Fonts: Inter, Plus Jakarta Sans

## Setup

1. Copy `.env.example` to `.env` and fill in values
2. `npm install`
3. `npm run dev`

## Key Pages

| Path | Description |
|---|---|
| /login | Email/password login |
| /register | Tenant self-registration |
| /register-owner | PG owner first-time setup |
| /owner | Owner dashboard |
| /owner/map | Visual building map |
| /owner/rooms | Floors, rooms, beds management |
| /owner/tenants | Tenant list + bed assignment |
| /owner/tenants/:id | Tenant detail + verification |
| /owner/payments | Monthly rent tracking |
| /owner/reports | Reports + Excel/PDF export |
| /manager/* | Same as owner (subset of pages) |
| /tenant | Tenant dashboard |
| /tenant/profile | Upload documents, change password |
