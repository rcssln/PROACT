# Situational Report (SitRep) Workflow Documentation

This document provides a comprehensive technical and functional overview of the Situational Report (SitRep) workflow in the PROACT Report System. It covers the data lifecycle from the Local Government Unit (LGU) level up to the Regional level, including data entry, backend handling, database architecture, consolidation, and the approval process.

---

## 1. System Architecture Overview

The SitRep system is built to facilitate hierarchical disaster reporting. The hierarchy flows as follows:
1. **LGUs (City/Municipality)**: Input raw data for their specific localities.
2. **Provincial Offices**: Review, consolidate, and approve data from LGUs within their province.
3. **Regional Offices**: Oversee all provinces, aggregate data across the entire region.

**Tech Stack Highlights:**
- **Frontend**: React.js (Vite), Context API (`EventContext.jsx`)
- **Backend**: Node.js/Express (`src/index.js`), Socket.IO for real-time updates
- **Database**: PostgreSQL (Supabase)

---

## 2. Database Schema Foundation

The relational structure is heavily normalized to support complex reporting categories.

### Core Tables
1. **`events`**: The root entity. Represents a disaster or incident (e.g., "Typhoon Carina").
2. **`situational_reports`**: A snapshot/version of a report tied to an `event`. Multiple SitReps can exist under one event (e.g., "SitRep No. 1", "SitRep No. 2").
   - Foreign Keys: `event_id`, `created_by`
   - Key Fields: `status` (Draft, Pending Approval, Approved), `province`, `approved_pdf_url`, `rejection_remarks`

### The 15 Category Sub-tables
Data entries for a SitRep are split into distinct tables based on the category of the report. Every table has a foreign key to `situational_report_id` and `event_id`.

1. `related_incidents` (Floods, Landslides)
2. `agriculture_damage_reports`
3. `infrastructure_damage_reports`
4. `assistance_lgus_agencies_reports`
5. `assistance_provided_reports`
6. `class_suspension_reports`
7. `work_suspension_reports`
8. `communication_lines_reports`
9. `damaged_houses_reports`
10. `declaration_state_of_calamity_reports`
11. `power_reports`
12. `water_supply_reports`
13. `pre_emptive_evacuation_reports`
14. `roads_and_bridges`
15. `reports` (Affected Population)

**Special Case: Affected Population**
The "Affected Population" (Evacuation) data uses a parent-child structure:
- `reports`: Parent record tied to `situational_report_id`.
- `report_rows`: Child records containing demographic data (families, persons, inside/outside evacuation centers) tied to `report_id`.

---

## 3. The Workflow: Step-by-Step

### Step 1: Event Creation & Deployment
Before any SitRep can be created, an **Event** must exist and be deployed.
1. **Creation**: Regional/Super Admins create an event (`ManageEvents.jsx`).
2. **Signals/Assignments**: Users are assigned "Signals" based on their location (`signals.js`).
3. **Deployment**: An event is marked as `is_deployed = TRUE`. This triggers a deployment snapshot and makes the event the "Active" event across the system.
4. **LGU Auto-Deployment**: When LGUs are targeted, records are inserted into `event_deployments`.

### Step 2: SitRep Creation (Cloning & Initialization)
*Frontend: `AddReport.jsx` | Backend: `situationalReports.js`*

When a user clicks "Add New SitRep":
1. **API Call**: `POST /api/situational-reports`
2. **Report Numbering**: The backend automatically calculates `report_number` by checking existing reports for the event (`MAX(report_number) + 1`).
3. **Data Inheritance (Cloning)**: 
   - A major feature is the ability to "copy data from previous SitRep".
   - If `copy_from_id` is provided in the request, the backend executes a massive transaction (using `BEGIN` and `COMMIT`).
   - It iterates through all 13 sub-tables and the `reports`/`report_rows` tables, copying records from the old SitRep and assigning them to the newly created `situational_report_id`.
4. **Notifications**: Targeted LGUs receive a socket notification that a new SitRep is assigned to them.

### Step 3: Data Entry & Real-time Sync
*Frontend: `AddReport.jsx` | Backend: `reports.js`*

Users navigate through categories (e.g., Power, Roads, Incidents) and add entries (Barangay-level data).

**Backend Handling:**
- The system heavily relies on generic endpoints in `reports.js`:
  - `POST /api/reports/:table/bulk` (Bulk Insert)
  - `PATCH /api/reports/:table/bulk` (Bulk Update)
- **Scoping**: When querying data (`GET /api/reports/:table`), the backend filters data based on the user's role:
  - LGU sees only their `city`.
  - Provincial sees only their `province`.
  - Regional sees everything.

**Real-time Sync:**
Every time an entry is saved, updated, or deleted, `index.js` uses `Socket.IO` to emit an event (e.g., `power_reports:bulk_created`). Connected clients instantly fetch the updated data without a page refresh, crucial for multi-user data entry during emergencies.

### Step 4: Consolidation and Document Generation
*Frontend: `ConsolidatedReport.jsx` | Backend: `reports.js` (`/consolidated` endpoint)*

Once LGUs have inputted their data, Provincial users view the consolidated output.

**Aggregation Logic:**
- `GET /api/reports/consolidated`: This is a massive endpoint that performs aggregations.
- It calculates `categoryTotals` and `byCityCategory` (e.g., total families evacuated per city, total damaged roads).
- It returns a unified JSON object (`summaryData` and `details`).

**Exporting:**
- **PDF Generation**: Handled on the frontend via `generateRelatedIncidentsPdf.js` using `jspdf` and `jspdf-autotable`. It requires Signatories (Prepared By, Noted By, Approved By).
- **CSV Generation**: Handled via `generateConsolidatedCsv.js`.
- **AI Summary**: Uses `generateSummary` (OpenAI integration) to convert raw metrics into a readable textual summary for the PDF.

### Step 5: Approval Workflow
*Frontend: `ForApproval.jsx` | Backend: `situationalReports.js`*

The SitRep lifecycle moves through specific statuses:
1. **Draft**: Initial state. LGUs and Provincial users are inputting data.
2. **Pending Approval (Sent)**: 
   - Provincial user generates the PDF, physically signs it (or attaches signatures), and uploads it.
   - Status changes to `Pending Approval`. The file is saved to `pending_pdf_url`.
3. **Review by Approver**:
   - `Provincial Approver` (e.g., PDRRMO Head) logs in and sees the report in `ForApproval.jsx`.
   - They review the attached PDF.
4. **Approve / Reject**:
   - **Approve**: Status becomes `Approved`. `pending_pdf_url` is moved to `approved_pdf_url`. Socket event `sitrep:updated` is fired.
   - **Reject**: Status reverts to `Draft`. The Approver must provide `rejection_remarks`. The Provincial team gets notified, makes corrections, and resubmits.

---

## 4. Key Technical Mechanisms

### Real-Time Socket Architecture
The system uses Socket.IO initialized in `backend/src/index.js`.
- `io.emit('events:created')`, `io.emit('sitrep:updated')`, etc.
- In the frontend, `EventContext.jsx` establishes the connection and listens to these events to trigger functions like `fetchSituationalReports()` or `fetchPendingApprovalsCount()`.

### Multi-Tenancy (Row-Level Scoping)
Authorization is strictly enforced in the API routes. In almost every `GET` request (e.g., `situationalReports.js`, `reports.js`), a scoping block exists:
```javascript
const isRegional = ['Regional Admin', 'Regional', 'Super Admin', 'Regional Approver'].includes(req.user.account_type) || req.user.role === 'Super Admin';
if (!isRegional && req.user.province) {
  params.push(req.user.province);
  query += ` AND (sr.province = $${params.length} OR sr.province IS NULL)`;
}
```
This ensures LGUs cannot see other LGUs' data, and Provinces cannot see other Provinces' data, ensuring data privacy and accuracy at the respective government levels.

### File Handling
PDFs uploaded during the approval process are handled by `multer` in `index.js`, saved to the `uploads/` directory, and served statically.

---

## 5. Summary
The PROACT SitRep system is a robust, multi-tiered reporting engine. Its power lies in the strict role-based data scoping, the ability to rapidly clone massive amounts of data from previous reports, real-time collaboration using WebSockets, and a formal document-based approval pipeline that mimics actual government workflows.
