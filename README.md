# TMS Frontend v2.0

**Transport Management System** — Internal-use frontend built on React + Vite + TypeScript + Supabase.

## Quick Start

```bash
npm install
cp .env.example .env       # fill in your Supabase credentials
npm run dev
```

---

## Architecture

### Tech Stack
- **React 18** + **TypeScript** + **Vite**
- **Supabase** (Auth + Postgres + Storage + RPC)
- **Tailwind CSS** (utility layer) + **IBM Plex** fonts
- Custom dark design system (`src/index.css`)

### Roles & Layouts

| Role | Layout | Access |
|------|--------|--------|
| `admin` | AdminLayout | Full system: fleet, reports, audit, bookings, users |
| `corporate_approver` | CorporateLayout | Booking + fuel approvals, history, reports |
| `transport_supervisor` | TransportLayout | Dispatch, close trips, maintenance, fleet, fuel recording, shifts |
| `driver` | DriverLayout | My trips, my shifts, fuel requests |
| `unit_head` / `staff` | DepartmentLayout | Create/view bookings, fuel requests, report maintenance, request users |

---

## Feature Modules

### ✅ Module: Bookings
- `CreateBookingV2` — Full booking form with visibility/unit sharing
- `BookingsTable` — Searchable/filterable booking list
- `MyBookings` — User's own requests
- `CloseTrips` — Close completed trips

### ✅ Module: Approvals
- `ApprovalQueue` — Corporate review queue, approve/reject with comments

### ✅ Module: Dispatch
- `DispatchBoard` — Assign vehicle + driver to approved bookings

### ✅ Module: Maintenance
- `MaintenanceBoard` — Full workflow: reported → approved → in_progress → completed → closed
- `ReportMaintenance` — Staff/driver issue reporting

### ✅ Module: Fuel (COMPLETE)
- `CreateFuelRequest` — Submit fuel requests (dept + driver)
- `FuelRequests` — My request history
- `FuelReviewQueue` — Corporate approval queue
- `FuelRecordingQueue` — Transport records actual dispensed fuel (approved → recorded)
- `FuelHistory` — Full audit trail of all requests

### ✅ Module: Fleet (NEW — Module 15)
- `VehiclesPage` — CRUD: add/edit/activate/deactivate vehicles. Insurance + roadworthy expiry alerts (⚠ expired, ⏰ within 30 days)
- `DriversPage` — CRUD: add/edit/activate/deactivate drivers. License expiry tracking. User account linking.

### ✅ Module: Shifts
- `MyShifts` — Upcoming + past shift cards for driver
- `ShiftAdmin` — Override shifts with reason logging

### ✅ Module: Trips
- `DriverTrips` — Driver starts/completes assigned trips

### ✅ Module: Reports
- `ReportsDashboard` — KPI grid + booking sparkline + status breakdown + fuel/maintenance tables + vehicle utilization grid
- `AuditLogs` — Searchable, expandable JSON metadata log viewer

### ✅ Module: Users
- `AdminUserRequests` — Approve/reject with Auth UUID + position title
- `NewUserRequest` — Division/unit/role-aware request form

---

## File Structure

```
src/
├── app/
│   ├── AppShell.tsx          ← Sidebar layout (navGroups, navItems, nav)
│   └── routes.tsx
├── hooks/
│   └── useAuth.ts
├── layouts/
│   ├── AdminLayout.tsx
│   ├── CorporateLayout.tsx
│   ├── TransportLayout.tsx
│   ├── DepartmentLayout.tsx
│   └── DriverLayout.tsx
├── lib/
│   ├── supabase.ts
│   ├── types.ts
│   └── utils.ts              ← fmtDate, fmtDateTime, fmtMoney, statusBadge
├── modules/
│   ├── approvals/
│   ├── bookings/
│   ├── dispatch/
│   ├── documents/
│   ├── fleet/               ← NEW (Module 15)
│   │   ├── pages/
│   │   │   ├── VehiclesPage.tsx
│   │   │   └── DriversPage.tsx
│   │   └── services/
│   │       └── fleet.service.ts
│   ├── fuel/                ← COMPLETED
│   │   ├── pages/
│   │   │   ├── CreateFuelRequest.tsx
│   │   │   ├── FuelRequests.tsx
│   │   │   ├── FuelReviewQueue.tsx
│   │   │   ├── FuelRecordingQueue.tsx  ← NEW
│   │   │   └── FuelHistory.tsx          ← NEW
│   │   └── services/
│   │       └── fuel.service.ts
│   ├── maintenance/
│   ├── reports/
│   ├── shifts/
│   ├── trips/
│   └── users/
├── pages/
│   ├── auth/Login.tsx
│   └── dashboard/DashboardRouter.tsx
└── index.css                ← Full IBM Plex dark design system
```

---

## Design System

All UI uses the custom CSS design system in `src/index.css`:

```css
/* Status badges */
.badge .badge-{status}      /* draft, submitted, approved, rejected, dispatched, etc. */

/* Form elements */
.tms-input .tms-select .tms-textarea

/* Buttons */
.btn .btn-primary .btn-ghost .btn-success .btn-danger .btn-amber .btn-sm .btn-lg

/* Cards */
.card .card-header .card-title .card-body

/* KPI stats */
.stat-card .stat-label .stat-value

/* Tables */
.tms-table

/* Layout */
.page-header .page-title .form-label
.grid-2 .grid-3 .grid-4

/* Alerts */
.alert .alert-error .alert-success .alert-info
```

---

## Supabase RPCs Required

All state changes use RPC (never direct updates):

| RPC | Caller |
|-----|--------|
| `submit_booking(p_booking_id)` | Department |
| `approve_booking(p_booking_id, p_action, p_comment)` | Corporate |
| `dispatch_booking(p_booking_id, p_vehicle_id, p_driver_id, p_notes)` | Transport |
| `update_trip_status(p_booking_id, p_new_status)` | Driver |
| `close_booking(p_booking_id)` | Transport |
| `update_maintenance_status(p_request_id, p_new_status)` | Transport |
| `confirm_maintenance_completion(p_request_id, p_notes)` | Transport |
| `create_fuel_request_draft(...)` | Any |
| `submit_fuel_request(p_fuel_request_id, p_meta)` | Any |
| `corporate_review_fuel_request(p_fuel_request_id, p_action, p_notes, p_meta)` | Corporate |
| `record_fuel_request(p_fuel_request_id, p_actual_cost, p_notes, p_meta)` | Transport |
| `override_shift(p_driver_id, p_shift_date, p_new_shift_code, p_reason)` | Transport |
| `admin_approve_user_request(...)` | Admin |
| `admin_reject_user_request(...)` | Admin |
| `register_document(...)` | Any |
| `report_kpis()` | Admin/Transport |

---

## Fleet Management DB Schema Needed

The new `VehiclesPage` and `DriversPage` expect these columns on top of the existing schema:

```sql
-- vehicles table additions
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS make text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS capacity integer;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vin text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_expiry date;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS roadworthy_expiry date;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS notes text;

-- drivers table additions
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_class text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS notes text;
```

The existing `plate_number`, `status`, `license_number`, `employment_status`, and `user_id` columns are assumed to already exist.
