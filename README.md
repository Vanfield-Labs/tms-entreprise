# TMS Entreprise

Transport Management System for internal fleet operations, approvals, dispatch, maintenance, fuel workflows, reporting, and role-based staff access.

## Overview

TMS Entreprise is a React + Vite + TypeScript frontend backed by Supabase Auth, Postgres, RPCs, Edge Functions, and realtime updates.

The system is designed for:

- transport supervisors managing trips, drivers, shifts, fuel, and maintenance
- corporate and finance approvers handling controlled workflow approvals
- HR handling leave workflows
- staff and unit heads requesting transport services
- drivers viewing assignments, shifts, leave, and trip activity
- administrators managing users, security-sensitive actions, and overall operations

## Core Capabilities

- role-based dashboards and redirects
- protected routing with MFA support for privileged roles
- booking creation, approval, dispatch, trip completion, and close-out
- maintenance reporting, finance review, corporate review, and execution workflow
- fuel request submission, review, and recording
- driver leave self-service plus supervisor, corporate, and HR approval flow
- staff, unit, camera, and news assignment workflows
- vehicle and driver management
- KPI and report dashboards
- realtime notifications and push notification support
- admin user creation and password reset through Supabase Edge Functions
- supplier portal for licence status, renewal, and deactivation

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router 6
- Supabase JavaScript client
- Supabase Auth, Postgres, RLS, RPCs, Edge Functions, Realtime
- Tailwind CSS plus custom design system classes

## App Structure

### Routing and Shell

- `src/app/routes.tsx`
  Main route map for login, MFA, role dashboards, and nested dashboard routes
- `src/app/AppShell.tsx`
  Shared shell for sidebar navigation, topbar, notifications, and layout chrome
- `src/app/ProtectedLayout.tsx`
  Authentication and MFA route guard
- `src/app/RoleRedirect.tsx`
  Role-aware default dashboard redirect

### Layouts

- `src/layouts/AdminLayout.tsx`
- `src/layouts/CorporateLayout.tsx`
- `src/layouts/FinanceLayout.tsx`
- `src/layouts/TransportLayout.tsx`
- `src/layouts/DriverLayout.tsx`
- `src/layouts/HrLayout.tsx`
- `src/layouts/DepartmentLayout.tsx`
- `src/layouts/CameraLayout.tsx`
- `src/layouts/JoyNewsLayout.tsx`
- `src/layouts/AdomTvLayout.tsx`
- `src/layouts/JoyBusinessLayout.tsx`

### Feature Modules

- `src/modules/bookings`
  Booking creation, detail view, amendments, approvals, dispatch, and close trips
- `src/modules/approvals`
  Approval queues and workflow actions
- `src/modules/dispatch`
  Dispatch and trips workspace
- `src/modules/maintenance`
  Reporting, approval, execution, history, and workspace views
- `src/modules/fuel`
  Fuel request submission, review, record queue, and history
- `src/modules/drivers`
  Driver management, leave dashboard, and leave self-service
- `src/modules/fleet`
  Mileage and fleet-related operational pages
- `src/modules/vehicles`
  Vehicle management
- `src/modules/shifts`
  Schedule generation, shift overrides, and admin shift tools
- `src/modules/incidents`
  Incident boards and reporting views
- `src/modules/news`
  Assignments and newsroom transport workflow
- `src/modules/reports`
  Reports dashboard, KPI dashboard, audit-style operational reporting
- `src/modules/users`
  User requests, admin user management, and user service actions
- `src/modules/staff`
  Staff dashboard
- `src/modules/unithead`
  Unit head dashboard
- `src/modules/trips`
  Driver trip activity
- `src/modules/divisions`
  Division-level operational pages

## Roles and Dashboard Access

Primary role routing currently supports:

- `admin`
- `corporate_approver`
- `finance_manager`
- `transport_supervisor`
- `driver`
- `unit_head`
- `staff`

Unit-aware routing also supports dedicated dashboards for:

- HR
- Camera
- Joy News
- Adom TV
- Joy Business

## Transport Dashboard URLs

The transport dashboard now supports route-based section URLs, for example:

- `/dashboard/transport/trips`
- `/dashboard/transport/assignments`
- `/dashboard/transport/driver-schedule`
- `/dashboard/transport/shift-overrides`
- `/dashboard/transport/maintenance`
- `/dashboard/transport/incidents`
- `/dashboard/transport/record-fuel`
- `/dashboard/transport/fuel-request`
- `/dashboard/transport/vehicles`
- `/dashboard/transport/mileage-log`
- `/dashboard/transport/drivers`
- `/dashboard/transport/leave`
- `/dashboard/transport/reports`
- `/dashboard/transport/profile`

This makes direct page testing and bookmarking easier for the transport dashboard.

## Authentication and Security

The app uses Supabase Auth with client-side role-aware routing plus database-side RLS and RPC authorization.

Recent hardening includes:

- stricter notification access policies
- tighter `drivers` table permissions
- restricted execute access on sensitive RPCs
- JWT verification enabled for privileged Edge Functions
- supplier portal moved behind a dedicated hardened Edge Function
- supplier portal request logging and throttling support

## Supabase

### Local Config Files

- `src/lib/supabase.ts`
  Frontend Supabase client
- `supabase/config.toml`
  Edge Function configuration
- `supabase/migrations`
  Database migrations
- `supabase/functions`
  Supabase Edge Functions

### Edge Functions

- `create-user`
  Admin-only user creation using service role
- `reset-password`
  Admin-only password reset using service role
- `notify-and-push`
  Combined notification insert and push dispatch helper
- `send-push-notification`
  FCM push sender using Firebase service account secret
- `supplier-portal`
  Hardened public function for supplier PIN verification, licence status, renewal, and deactivation

### Recent Migrations

- `20260404_*`
  Booking, maintenance, and HR leave workflow changes
- `20260405_driver_leave_self_service.sql`
  Driver leave self-service support
- `20260406_security_hardening.sql`
  Notification and driver permission hardening
- `20260406_security_rpc_grants.sql`
  Sensitive RPC execute grant tightening
- `20260406_supplier_portal_hardening.sql`
  Supplier portal logging and service-role-only database access model
- `20260406_supplier_portal_rpc_grants.sql`
  Removal of browser-role execute access from supplier RPCs

## Push Notifications

Push notifications are implemented with:

- Firebase Web Messaging config exposed through `VITE_FIREBASE_*` frontend variables
- browser service worker at `public/sw.js`
- `push_subscriptions` table in Supabase
- `send-push-notification` Edge Function for FCM delivery

Required frontend environment variables include:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Important:

- `VITE_*` variables are intentionally exposed to the frontend
- server secrets like service role keys must never use `VITE_*`

## Local Development

### Requirements

- Node.js
- npm
- Supabase project credentials

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## Environment Variables

Frontend variables are read through `import.meta.env`.

Common frontend variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

Server-side Supabase secrets should stay outside the frontend and are typically configured in Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

## Deployment Notes

- frontend can be deployed on Vercel
- Supabase handles auth, database, realtime, and edge functions
- route protection means external page-speed tools may still hit login unless testing authenticated flows or direct public pages

## Repository Workflow

Current preferred workflow:

- do feature work on `new-feature`
- validate changes
- push `new-feature`
- merge into `main` when approved

## Status

The project includes live work in:

- operational dashboards
- workflow routing improvements
- supplier portal hardening
- Supabase access hardening
- route-based transport dashboard URLs

## License

Internal/private project for TMS Entreprise operations.
