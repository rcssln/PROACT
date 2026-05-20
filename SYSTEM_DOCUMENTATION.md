# PROACT Report System — Full Technical Documentation

**Version:** 1.2.1  
**Stack:** React 19 (Vite) + Node.js/Express + PostgreSQL + Socket.io + Docker  
**Domain:** https://proact.dost1.ph

---

## 1. System Overview

PROACT is a multi-level disaster situational reporting platform used by RDRRMC (Regional Disaster Risk Reduction and Management Council). It allows LGU, Provincial, and Regional administrators to submit, review, approve, and visualize disaster event reports in real time.

### Key Capabilities
- Create and manage disaster events
- Submit multi-section situational reports (SitReps) per event
- Role-based data scoping (LGU → Provincial → Regional)
- Real-time updates via Socket.io
- PDF and CSV report generation and download
- Approval workflow (Draft → Pending Approval → Approved/Rejected)
- Signal alerts (typhoon warning signals) per location
- LGU deployment tracking
- In-app notifications
- Dashboard KPIs and charts

---

## 2. Architecture Overview

```
Browser (React SPA)
       │
       │  HTTP + WebSocket
       ▼
   Nginx (port 80)
   ├── /api/*       → proxy → Express Backend (port 4000)
   ├── /socket.io/  → proxy → Socket.io (port 4000)
   └── /*           → serve dist/index.html (SPA routing)
       │
       ▼
  Express + Socket.io (Node.js, port 4000)
       │
       ▼
  PostgreSQL Database (port 5434)
```

### Docker Services (docker-compose.yml)
| Service | Container | Port |
|---|---|---|
| Backend | proact_backend | 4000 |
| Frontend | proact_frontend | 3001→80 |

Uploads are persisted via volume: `./backend/uploads:/app/uploads`

---

## 3. Project Directory Structure

```
report system/
├── backend/                    # Express API
│   ├── src/
│   │   ├── index.js            # Entry point, Express + Socket.io setup
│   │   ├── db.js               # PostgreSQL connection pool
│   │   ├── seed.js             # Seeds default Super Admin user
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT authentication middleware
│   │   ├── routes/
│   │   │   ├── auth.js         # Login, /me, change-password
│   │   │   ├── events.js       # CRUD for disaster events
│   │   │   ├── situationalReports.js  # SitRep CRUD + data cloning
│   │   │   ├── reports.js      # Generic report sub-table CRUD
│   │   │   ├── users.js        # User management
│   │   │   ├── notifications.js
│   │   │   ├── signals.js      # Typhoon signal assignments
│   │   │   ├── deployments.js  # LGU event deployments
│   │   │   └── activityLogs.js
│   │   └── utils/
│   │       └── mailer.js       # Brevo/Nodemailer email
│   └── uploads/                # Uploaded PDF files
├── database/
│   └── init.sql                # PostgreSQL schema + seed
├── src/                        # React frontend
│   ├── main.jsx
│   ├── App.jsx                 # Router + auth session restore
│   ├── contexts/
│   │   └── EventContext.jsx    # Global state: events, sitreps, notifs, socket
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx       # KPI cards, charts, data visualization
│   │   ├── AddReport.jsx       # SitRep form (14 report sections)
│   │   ├── ManageEvents.jsx    # Event CRUD + signals + deployments
│   │   ├── ForApproval.jsx     # Approver review workflow
│   │   ├── ConsolidatedReport.jsx  # Cross-sitrep reports + CSV download
│   │   ├── Users.jsx           # User management
│   │   ├── EventLogs.jsx       # Activity audit log
│   │   ├── ForcePasswordChange.jsx
│   │   └── Manual.jsx
│   ├── components/
│   │   ├── Layout.jsx          # Shell with sidebar
│   │   ├── Sidebar.jsx         # Navigation + role-based menu
│   │   ├── NotificationBell.jsx
│   │   ├── SettingsModal.jsx
│   │   ├── ConfirmationModal.jsx
│   │   ├── HeaderFooterModal.jsx
│   │   ├── SearchableSelect.jsx
│   │   ├── ModernDateTimePicker.jsx
│   │   └── ...
│   └── lib/
│       ├── api.js              # Axios instance with auth headers
│       ├── generateConsolidatedCsv.js  # CSV export logic
│       ├── generateRelatedIncidentsPdf.js  # PDF generation
│       └── passwordUtils.js
├── nginx.conf                  # Nginx reverse proxy config
├── docker-compose.yml
└── index.html
```

---

## 4. Database Schema

### 4.1 Table: `users`
| Column | Type | Description |
|---|---|---|
| id | UUID PK | Auto-generated |
| email | TEXT UNIQUE | Login email |
| first_name / last_name | TEXT | Name |
| password_hash | TEXT | bcrypt hash |
| role | TEXT | `Super Admin`, `Viewer` |
| account_type | TEXT | `Super Admin`, `Regional Admin`, `Regional`, `Regional Approver`, `Provincial Admin`, `Provincial Approver`, `Provincial`, `LGU Admin`, `LGU` |
| status | TEXT | `Active`, `Inactive`, `Pending` |
| province | TEXT | Assigned province |
| city | TEXT | Assigned city/municipality |
| must_change_password | BOOLEAN | Forces password change on next login |
| theme | TEXT | UI theme preference |

### 4.2 Table: `events`
| Column | Type | Description |
|---|---|---|
| id | UUID PK | |
| name | TEXT | Event name |
| event_type | TEXT | e.g. Typhoon, Flood |
| alert_status | TEXT | Color-coded alert |
| alert_level | TEXT | Signal level |
| affected_provinces | TEXT[] | Array of province names |
| pinged_report_types | JSONB | Which SitRep sections are active |
| is_deployed | BOOLEAN | Whether event is currently active/deployed |
| deployed_at | TIMESTAMPTZ | Deployment timestamp |
| deployed_snapshot | JSONB | Snapshot of event state at deployment |
| approval_status | TEXT | `Pending`, `Approved` |
| approved_pdf_url | TEXT | Final PDF link |

### 4.3 Table: `situational_reports`
| Column | Type | Description |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK → events | Parent event |
| report_number | INTEGER | Sequential number per event |
| title | TEXT | e.g. "Situational Report No. 3" |
| status | TEXT | `Draft`, `Sent`, `Pending Approval`, `Approved`, `Rejected` |
| province | TEXT | Province that created the sitrep |
| target_lgus | TEXT[] | Cities targeted for data submission |
| created_by | UUID FK → users | |
| rejection_remarks | TEXT | Set when rejected |
| approved_pdf_url | TEXT | URL to approved PDF |
| pending_pdf_url | TEXT | URL to pending PDF |

### 4.4 Report Sub-Tables (all linked to `situational_report_id` + `event_id`)

| Table | Description |
|---|---|
| `reports` + `report_rows` | Affected Population (families, persons, ECs) |
| `related_incidents` | Floods, debris, storm surge incidents |
| `damaged_houses_reports` | Totally/partially damaged houses |
| `infrastructure_damage_reports` | Roads, bridges, buildings (cost, units) |
| `power_reports` | Power interruption/restoration per area |
| `water_supply_reports` | Water service status |
| `communication_lines_reports` | Telecom status (2G/3G/4G coverage) |
| `roads_and_bridges` + `roads_and_bridges_sections` | Road/bridge passability |
| `pre_emptive_evacuation_reports` | Pre-emptive evacuees (families, persons) |
| `class_suspension_reports` | Class suspension details |
| `work_suspension_reports` | Work suspension details |
| `declaration_state_of_calamity_reports` | SoC declarations |
| `agriculture_damage_reports` | Crop/livestock damage |
| `assistance_provided_reports` | Assistance given to families |
| `assistance_lgus_agencies_reports` | Assistance from LGUs/agencies |

### 4.5 Supporting Tables

| Table | Description |
|---|---|
| `event_signals` | Typhoon signals per province/city/barangay |
| `event_deployments` | Which cities are deployed for an event |
| `notifications` | In-app notifications per user |
| `activity_logs` | Audit trail of user actions |
| `signatories` | Named signatories for PDF reports |

---

## 5. Backend — Express API

**Entry Point:** `backend/src/index.js`  
**Runtime:** Node.js (CommonJS)  
**Port:** 4000

### 5.1 Startup Sequence
1. Load environment variables via `dotenv`
2. Create Express app + HTTP server
3. Attach Socket.io to HTTP server (CORS: `*`)
4. Create `uploads/` directory if missing
5. Configure Multer for file uploads (sanitized filenames)
6. Mount all route handlers
7. Seed default Super Admin (`admin@proact.local`) if not exists
8. Listen on `PORT` (default 4000)

### 5.2 Authentication — `auth.js` Middleware
All protected routes use the `authenticate` middleware which:
1. Reads `Authorization: Bearer <token>` header
2. Verifies JWT with `JWT_SECRET`
3. Attaches decoded payload to `req.user`
4. Returns `401` if missing or invalid

JWT payload contains: `id`, `email`, `role`, `account_type`, `province`, `city`, `must_change_password`  
Token expiry: **7 days**

### 5.3 API Routes

#### `POST /auth/login`
- Validates email/password against `users` table using bcrypt
- Checks status (`Pending` → 403, `Inactive` → 403)
- Returns JWT token + user object (no `password_hash`)

#### `GET /auth/me`
- Verifies token and returns fresh user data from DB

#### `POST /auth/change-password`
- Requires current password unless `must_change_password = TRUE`
- Updates hash and clears `must_change_password`

---

#### `GET /events`
- Scoped by `account_type`:
  - **Regional/Super Admin**: all events
  - **Provincial Admin**: events with province-level signal OR `is_deployed = TRUE`
  - **LGU/LGU Admin**: events with city-level signal OR `is_deployed = TRUE`

#### `POST /events`
- Creates event, emits `events:created` via Socket.io
- Logs to `activity_logs`

#### `PATCH /events/:id`
- Updates allowed fields only
- If `is_deployed = TRUE`: sets all other events to `is_deployed = FALSE` first
- Emits `events:updated` and optionally `events:refresh_needed`

#### `DELETE /events/:id`
- Transactional: deletes all child records across all sub-tables first
- Emits `events:deleted`

---

#### `GET /situational-reports`
- Filtered by `event_id`, `status`, role-based province scoping
- Supports `count_only=true` for badge counts

#### `POST /situational-reports`
- Auto-increments `report_number` per event
- Notifies target LGU users with in-app notification
- Auto-deploys LGU cities to `event_deployments`
- Supports `copy_from_id`: clones all 14 sub-table data from a previous SitRep (transactional)

#### `PATCH /situational-reports/:id`
- Updates title, status, target_lgus, pdf URLs, rejection remarks
- Emits `sitrep:updated`

#### `GET /situational-reports/:id/report-data`
- Returns all 14 sub-tables for one SitRep in a single response

---

#### `GET /reports/:table`
- Generic endpoint for any of the 16 allowed tables
- Supports filtering by `event_id`, `situational_report_id` (comma-separated UUIDs), `report_id`
- Role-based scoping (city for LGU, province for Provincial)

#### `POST /reports/:table`
- Generic insert into any allowed table
- Emits `<table>:created`

#### `POST /reports/:table/bulk`
- Transactional bulk insert (used when saving a full SitRep section)
- Emits `<table>:bulk_created`

#### `PATCH /reports/:table/bulk`
- Transactional bulk update by ID array

#### `PUT /reports/:table/:id`
- Full update of a single row

#### `DELETE /reports/:table/:id`
- Deletes single row

#### `GET /reports/all-types`
- Fetches all rows from all 14 sub-tables for one SitRep
- Adds `category`, `categoryTitle`, `subject`, `summary` metadata to each row
- Used by the ForApproval review view

#### `GET /reports/consolidated`
- Fetches all sub-table data for an event filtered by approved SitRep IDs
- Runs aggregation server-side: totals by category and by city
- Returns `categoryTotals`, `byCityCategory`, `details`

---

#### `GET /users`
- Scoped: Provincial Admin sees own province's users; LGU Admin sees own city; Regional/Super Admin sees all

#### `POST /users`
- Creates user with auto-generated temp password
- Sends welcome email via Brevo/Nodemailer
- Sets `must_change_password = TRUE`

#### `PATCH /users/:id` / `DELETE /users/:id`
- Standard update/delete

---

#### `GET /notifications`
- Returns all notifications for the authenticated user

#### `PATCH /notifications/:id/read`
- Marks one notification as read

#### `POST /notifications/mark-many-read`
- Bulk mark-as-read by ID array

#### `POST /notifications/bulk`
- Transactional bulk insert + emits per-user socket events

---

#### `GET /signals?event_id=`
- All signals for an event

#### `POST /signals/assign`
- Upserts a signal for province/city/barangay
- Sends notifications to affected users
- Emits `signal:updated`

#### `POST /signals/clear`
- Deletes a signal entry

#### `POST /signals/bulk-assign`
- Transactional bulk upsert of signals

---

#### `GET /deployments?event_id=`
- Lists all city deployments for an event

#### `POST /deployments`
- Deploys event to array of cities
- Notifies LGU users in each city

---

#### `POST /upload`
- Multer single-file upload
- Returns `{ url, filename }` — URL points to `/uploads/<filename>`

---

## 6. Frontend — React SPA

**Framework:** React 19 + Vite  
**Routing:** React Router DOM v7  
**HTTP Client:** Axios (`src/lib/api.js`) — auto-attaches `Authorization: Bearer <token>` from localStorage  
**Icons:** Phosphor Icons  
**Charts:** Recharts  
**PDF Gen:** jsPDF + jspdf-autotable  
**Excel/CSV:** xlsx-js-style  
**Real-time:** socket.io-client

### 6.1 Authentication Flow (`App.jsx`)
1. On mount, reads `proact_token` from `localStorage`
2. Calls `GET /auth/me` to validate and get fresh user data
3. If invalid/expired → clears storage, shows login
4. On login → stores token + user in localStorage, sets React state
5. On logout → clears all localStorage keys

### 6.2 Global State — `EventContext.jsx`
The `EventProvider` wraps the entire app and manages:

| State | Description |
|---|---|
| `events` | All events for this user (role-scoped) |
| `currentEventId` | Selected event (persisted to localStorage) |
| `currentEvent` | Derived: the full event object for `currentEventId` |
| `situationalReports` | SitReps for the current event |
| `currentSituationalReport` | Selected SitRep |
| `notifications` | User's notification list |
| `unreadCount` | Badge count |
| `pendingUsersCount` | Users pending approval badge |
| `pendingApprovalsCount` | SitReps pending approval badge |
| `eventDeployments` | City deployments for current event |
| `eventSignals` | Signal assignments for current event |
| `userSignal` | Signal assigned to the current user's city |

**Socket.io events handled:**
| Event | Action |
|---|---|
| `events:created` | Prepend to events list |
| `events:updated` | Update in list, auto-set if deployed |
| `events:deleted` | Remove from list |
| `events:refresh_needed` | Re-fetch all events |
| `sitrep:created` | Re-fetch SitReps |
| `sitrep:updated` | Re-fetch SitReps + update approval badge |
| `notification:<userId>` | Prepend notification + show toast |
| `users:changed` | Refresh pending users badge |

**Polling:** SitReps also poll every 30 seconds as a fallback.

**Key methods exposed via context:**
- `addEvent`, `updateEvent`, `deleteEvent`, `deployEvent`, `deployToLgu`
- `createSituationalReport`, `updateSituationalReport`, `sendSituationalReport`
- `assignSignal`, `bulkAssignSignals`
- `fetchEventSignals`, `fetchEventDeployments`
- `markNotificationAsRead`, `markSitRepNotificationsAsRead`
- `showToast`, `showSuccess`, `showConfirm` (global UI helpers)

### 6.3 Routing (`App.jsx`)
| Path | Component | Notes |
|---|---|---|
| `/login` | `Login.jsx` | Redirects to dashboard if already authenticated |
| `/dashboard` | `Dashboard.jsx` | KPI cards, charts |
| `/add-report` | `AddReport.jsx` | 14-section SitRep form |
| `/manage-events` | `ManageEvents.jsx` | Event CRUD, signals, deployments |
| `/for-approval` | `ForApproval.jsx` | Approve/reject SitReps |
| `/consolidated-report` | `ConsolidatedReport.jsx` | Aggregated view + CSV |
| `/users` | `Users.jsx` | User management |
| `/event-logs` | `EventLogs.jsx` | Activity log |
| `/manual` | `Manual.jsx` | User manual |

All protected routes redirect to `/login` if not authenticated.  
If `must_change_password = TRUE`, user is redirected to `ForcePasswordChange`.

---

## 7. Page Descriptions

### Dashboard.jsx
- Displays KPI cards: affected families/persons, damaged houses, power outages, roads not passable, pre-emptive evacuees
- Charts: bar charts, line charts via Recharts
- Filters by event and SitRep selection
- Only aggregates **Approved** SitReps
- Data scoped by user role (LGU sees own city, Provincial sees own province, Regional sees all)

### AddReport.jsx
- The main data entry page
- Users select an event and SitRep, then fill 14 collapsible sections
- Each section maps to a sub-table (e.g., Affected Population → `reports`+`report_rows`)
- Supports bulk save per section (POST bulk then PATCH bulk for updates)
- Can clone data from previous SitRep when creating new one
- Generates and uploads PDF of the completed report

### ManageEvents.jsx
- Create, edit, delete events
- Assign typhoon warning signals (by province, city, barangay)
- Deploy event to LGU cities
- View deployment status

### ForApproval.jsx
- Lists SitReps with status `Pending Approval`
- Approver can view all section data, then Approve or Reject with remarks
- Triggers PATCH to update SitRep status

### ConsolidatedReport.jsx
- Displays aggregated totals across selected SitReps for an event
- CSV download via `generateConsolidatedCsv.js`

### Users.jsx
- Admin creates/edits/activates/deactivates users
- Role and province/city assignment

---

## 8. Role Hierarchy & Data Scoping

```
Super Admin
    └── Regional Admin / Regional Approver / Regional
              └── Provincial Admin / Provincial Approver / Provincial
                        └── LGU Admin / LGU
```

| Role Level | Events Visible | SitReps Visible | Report Data Visible |
|---|---|---|---|
| Super Admin / Regional | All | All | All provinces |
| Provincial | Signaled or deployed | Own province | Own province |
| LGU | Signaled or deployed | Own province | Own city only |

---

## 9. Situational Report Lifecycle

```
[Provincial Admin creates SitRep]
         │
         ▼
    Status: Draft
         │  (LGU fills data via AddReport)
         ▼
    Status: Sent
         │  (Provincial submits for approval)
         ▼
    Status: Pending Approval
         │
    ┌────┴────┐
    ▼         ▼
Approved   Rejected
(PDF URL   (remarks
 stored)    set)
```

---

## 10. File Upload Flow
1. User selects file in UI (e.g., PDF attachment)
2. Frontend POSTs to `POST /upload` (multipart/form-data)
3. Multer saves to `backend/uploads/<timestamp>-<sanitized_name>`
4. Returns `{ url: "http://backend:4000/uploads/<filename>" }`
5. URL is stored in the relevant DB column (e.g., `approved_pdf_url`)
6. Nginx serves `/uploads/*` directly proxied from backend

---

## 11. Real-Time System (Socket.io)

- Backend attaches Socket.io to the HTTP server
- `app.locals.io` is shared across all route handlers
- Frontend connects on mount (in EventContext), reconnects up to 5 times
- Per-user notifications via `io.emit('notification:<userId>', data)`
- Broadcast events: `events:created`, `events:updated`, `sitrep:created`, etc.
- SitRep polling (30s) as a safety net alongside socket events

---

## 12. Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `PORT` | API port (default 4000) |
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port (default 5434) |
| `DB_NAME` | Database name (proact) |
| `DB_USER` | DB user |
| `DB_PASSWORD` | DB password |
| `JWT_SECRET` | Secret for JWT signing |
| `VITE_API_URL` | Used in upload URL construction |
| Brevo API keys | For email sending |

### Frontend (`.env`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (e.g. `https://proact.dost1.ph/api`) |

---

## 13. Local Development

```bash
# Frontend (from project root)
npm run dev        # Vite dev server, default port 5173

# Backend (from backend/)
npm run dev        # nodemon src/index.js, port 4000

# Database
# PostgreSQL on port 5434, run database/init.sql once
```

## 14. Production Deployment (Docker)

```bash
docker-compose up -d --build
```

- Frontend built as static files, served by Nginx on port 80 (mapped to 3001)
- Backend runs on port 4000 (internal network: `proact_network`)
- Nginx proxies `/api/*` and `/socket.io/` to backend container named `backend`
- All non-asset URLs fall back to `index.html` (SPA routing)

---

## 15. PDF Generation

- `src/lib/generateRelatedIncidentsPdf.js` — generates full SitRep PDF using jsPDF
- `src/lib/generateConsolidatedCsv.js` — generates consolidated CSV per event using xlsx-js-style
- PDFs are uploaded to the backend via `POST /upload` and the URL is stored in the SitRep record

---

## 16. Default Super Admin Credentials

| Field | Value |
|---|---|
| Email | admin@proact.local |
| Password | Admin@1234 |

> **⚠️ Change this password immediately after first login.**
