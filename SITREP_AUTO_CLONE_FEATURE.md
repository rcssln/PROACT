# PROACT SitRep Auto-Clone Feature
## Intelligent Data Inheritance with Role-Based Hierarchy

**Version:** 1.0  
**Status:** Implementation Guide  
**Purpose:** Enable automatic cloning of SitRep data from the latest previous report to new reports, respecting LGU → Provincial → Regional data scoping rules.

---

## 1. Overview

### Current Behavior
- Users explicitly choose to "copy data from previous SitRep" (manual cloning)
- Creates friction during rapid SitRep creation cycles in disasters

### Proposed Behavior (Auto-Clone)
- When creating a new SitRep for an event, the system automatically detects the **latest previous SitRep**
- All 15 data categories are cloned to the new SitRep
- **Hierarchy-aware filtering**: Each user only clones data relevant to their role/location
  - **LGU users**: Clone only their city's data
  - **Provincial users**: Clone their province's data
  - **Regional users**: Clone all data
- Users then modify only changed values (delta updates), not re-enter everything

---

## 2. Architecture & Design

### 2.1 Data Flow Diagram

```
[User Creates New SitRep]
          │
          ▼
[Backend: POST /situational-reports]
          │
    ┌─────┴─────────────────────────────┐
    │                                    │
    ▼                                    ▼
[Find Latest SitRep]        [Determine User Role]
    │                                    │
    ├─ Filter by event_id               ├─ Is LGU?
    ├─ Status ≠ Draft                   ├─ Is Provincial?
    ├─ Order by created_at DESC         └─ Is Regional?
    └─ LIMIT 1                                 │
         │                                     ▼
         │                        [Build Role-Specific Clone Query]
         │                                     │
         └──────────────┬──────────────────────┘
                        ▼
              [Transactional Clone Process]
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
    [Clone         [Clone          [Clone Other 13
    Affected      Related          Categories]
    Population]   Incidents]
        │               │               │
        └───────────────┼───────────────┘
                        ▼
            [Apply Role-Based Scoping]
              (Filter by city/province)
                        │
                        ▼
              [Return New SitRep ID]
                with Cloned Data
```

### 2.2 Key Principles

1. **Automatic Detection**: No user interaction needed; system finds the latest SitRep automatically
2. **Role-Aware Filtering**: Only relevant data is cloned for each user's role
3. **Transactional Integrity**: All clones succeed or all fail (no partial clones)
4. **Non-Destructive**: Users can modify or delete cloned data without affecting the source
5. **Audit Trail**: Every clone operation is logged with source SitRep ID and user who triggered it

---

## 3. Database Schema Changes

### 3.1 New Column: `situational_reports`

Add tracking for auto-clone operations:

```sql
ALTER TABLE situational_reports ADD COLUMN cloned_from_id UUID REFERENCES situational_reports(id) ON DELETE SET NULL;
ALTER TABLE situational_reports ADD COLUMN cloned_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE situational_reports ADD COLUMN auto_cloned BOOLEAN DEFAULT FALSE;

-- Index for efficient lookup
CREATE INDEX idx_sitrep_cloned_from ON situational_reports(cloned_from_id);
```

### 3.2 Activity Log Enhancement

Log clone operations for audit:

```sql
-- In activity_logs table, add a type like:
-- "SITREP_AUTO_CLONED_FROM", with metadata storing source_sitrep_id
```

---

## 4. Backend Implementation

### 4.1 Core Logic in `situationalReports.js`

#### Step 1: Find Latest SitRep (Helper Function)

```javascript
/**
 * Finds the most recent non-draft SitRep for an event
 * @param {string} eventId - Event UUID
 * @param {object} user - Authenticated user object
 * @returns {Promise<object|null>} - Latest SitRep or null
 */
async function findLatestSourceSitRep(eventId, user) {
  const query = `
    SELECT sr.* FROM situational_reports sr
    WHERE sr.event_id = $1
      AND sr.status NOT IN ('Draft')
      AND sr.deleted_at IS NULL
    ORDER BY sr.created_at DESC
    LIMIT 1
  `;
  
  const result = await pool.query(query, [eventId]);
  return result.rows[0] || null;
}
```

#### Step 2: Determine Clone Scope (Helper Function)

```javascript
/**
 * Determines what data the user can clone based on their role
 * @param {object} user - Authenticated user object
 * @returns {object} - Scope configuration
 */
function getCloneScope(user) {
  const isRegional = ['Regional Admin', 'Regional', 'Regional Approver', 'Super Admin'].includes(user.account_type);
  const isProvincial = ['Provincial Admin', 'Provincial', 'Provincial Approver'].includes(user.account_type);
  const isLGU = ['LGU', 'LGU Admin'].includes(user.account_type);

  return {
    isRegional,
    isProvincial,
    isLGU,
    userProvince: user.province || null,
    userCity: user.city || null,
    scopeType: isRegional ? 'REGIONAL' : isProvincial ? 'PROVINCIAL' : 'LGU',
  };
}
```

#### Step 3: Clone All Data Tables (Main Function)

```javascript
/**
 * Clones all 15 data categories from source SitRep to new SitRep
 * Respects role-based hierarchy scoping
 * @param {string} sourceSitRepId - Source SitRep UUID
 * @param {string} newSitRepId - Target SitRep UUID
 * @param {string} eventId - Event UUID
 * @param {object} user - Authenticated user object
 * @param {Pool} pool - Database pool
 */
async function cloneAllDataTables(sourceSitRepId, newSitRepId, eventId, user, pool) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const scope = getCloneScope(user);
    const scopeFilter = buildScopeFilter(scope);

    // List of all 15 data tables to clone
    const tablesToClone = [
      'reports',  // Special: has child records in report_rows
      'report_rows',
      'related_incidents',
      'damaged_houses_reports',
      'infrastructure_damage_reports',
      'power_reports',
      'water_supply_reports',
      'communication_lines_reports',
      'roads_and_bridges',
      'roads_and_bridges_sections',
      'pre_emptive_evacuation_reports',
      'class_suspension_reports',
      'work_suspension_reports',
      'declaration_state_of_calamity_reports',
      'agriculture_damage_reports',
      'assistance_provided_reports',
      'assistance_lgus_agencies_reports',
    ];

    console.log(`[AUTO-CLONE] Starting clone from SitRep ${sourceSitRepId} to ${newSitRepId}`);
    console.log(`[AUTO-CLONE] Scope: ${scope.scopeType}`);

    for (const table of tablesToClone) {
      await cloneTable(client, table, sourceSitRepId, newSitRepId, eventId, scopeFilter);
    }

    // Mark new SitRep as auto-cloned
    await client.query(
      `UPDATE situational_reports 
       SET cloned_from_id = $1, auto_cloned = TRUE 
       WHERE id = $2`,
      [sourceSitRepId, newSitRepId]
    );

    await client.query('COMMIT');
    console.log(`[AUTO-CLONE] Successfully cloned all data`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[AUTO-CLONE] Error during clone: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}
```

#### Step 4: Clone Individual Table (Generic Function)

```javascript
/**
 * Clones data from one table, applying scope filter
 * Handles parent-child relationships (e.g., reports ↔ report_rows)
 */
async function cloneTable(client, tableName, sourceSitRepId, newSitRepId, eventId, scopeFilter) {
  // Get all columns for the source table
  const columnsQuery = `
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = $1 AND column_name NOT IN ('id', 'created_at', 'updated_at')
  `;
  const columnsResult = await client.query(columnsQuery, [tableName]);
  const columns = columnsResult.rows.map(row => row.column_name);

  if (columns.length === 0) {
    console.log(`[AUTO-CLONE] Skipping table ${tableName}: no cloneable columns`);
    return;
  }

  // Build WHERE clause with scope filter
  let whereClause = `situational_report_id = $1 AND event_id = $2`;
  let params = [sourceSitRepId, eventId];
  
  if (scopeFilter) {
    whereClause += ` AND ${scopeFilter.condition}`;
    params.push(...scopeFilter.values);
  }

  // Fetch source data
  const selectQuery = `SELECT ${columns.join(', ')} FROM ${tableName} WHERE ${whereClause}`;
  const sourceData = await client.query(selectQuery, params);

  if (sourceData.rows.length === 0) {
    console.log(`[AUTO-CLONE] No data to clone from ${tableName}`);
    return;
  }

  // Insert cloned data
  for (const row of sourceData.rows) {
    const insertColumns = ['situational_report_id', 'event_id', ...columns];
    const insertValues = [newSitRepId, eventId, ...columns.map(col => row[col])];
    const placeholders = insertColumns.map((_, i) => `$${i + 1}`).join(', ');

    const insertQuery = `
      INSERT INTO ${tableName} (${insertColumns.join(', ')})
      VALUES (${placeholders})
    `;

    await client.query(insertQuery, insertValues);
  }

  console.log(`[AUTO-CLONE] Cloned ${sourceData.rows.length} rows from ${tableName}`);
}
```

#### Step 5: Build Scope Filter (Helper Function)

```javascript
/**
 * Constructs a WHERE clause fragment based on user role
 * @param {object} scope - Output from getCloneScope()
 * @returns {object|null} - {condition: string, values: array} or null for regional (no filter)
 */
function buildScopeFilter(scope) {
  if (scope.isRegional) {
    // Regional can clone everything
    return null;
  }

  if (scope.isProvincial) {
    // Provincial clones only their province's data
    return {
      condition: `province = $3`,
      values: [scope.userProvince],
    };
  }

  if (scope.isLGU) {
    // LGU clones only their city's data
    return {
      condition: `city = $3`,
      values: [scope.userCity],
    };
  }

  return null;
}
```

### 4.2 Modified SitRep Creation Endpoint

Update `POST /situational-reports` to auto-clone:

```javascript
router.post('/', authenticate, async (req, res) => {
  try {
    const { event_id, title, target_lgus, copy_from_id } = req.body;
    const userId = req.user.id;

    // Validate event exists
    const eventRes = await pool.query('SELECT * FROM events WHERE id = $1', [event_id]);
    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Calculate report_number
      const numberRes = await client.query(
        'SELECT MAX(report_number) as max_num FROM situational_reports WHERE event_id = $1',
        [event_id]
      );
      const reportNumber = (numberRes.rows[0].max_num || 0) + 1;

      // Create new SitRep record
      const newSitRepRes = await client.query(
        `INSERT INTO situational_reports 
         (event_id, report_number, title, status, province, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [event_id, reportNumber, title || `Situational Report No. ${reportNumber}`, 'Draft', req.user.province, userId]
      );

      const newSitRep = newSitRepRes.rows[0];

      // **AUTO-CLONE LOGIC**
      let sourceToClone = copy_from_id; // Explicit copy parameter

      if (!sourceToClone) {
        // Auto-detect latest SitRep
        const latestRes = await client.query(
          `SELECT id FROM situational_reports 
           WHERE event_id = $1 AND status NOT IN ('Draft') AND id != $2
           ORDER BY created_at DESC LIMIT 1`,
          [event_id, newSitRep.id]
        );
        sourceToClone = latestRes.rows[0]?.id || null;
      }

      if (sourceToClone) {
        console.log(`[SitRep Creation] Auto-cloning from ${sourceToClone}`);
        
        // Clone all data (using function from previous sections)
        await cloneAllDataTablesWithClient(
          sourceToClone,
          newSitRep.id,
          event_id,
          req.user,
          client // Pass existing client to avoid transaction issues
        );
      } else {
        console.log(`[SitRep Creation] No previous SitRep to clone`);
      }

      await client.query('COMMIT');

      // Log activity
      await pool.query(
        `INSERT INTO activity_logs (user_id, action, details)
         VALUES ($1, $2, $3)`,
        [userId, 'SITREP_CREATED', JSON.stringify({ sitrep_id: newSitRep.id, auto_cloned: !!sourceToClone })]
      );

      // Emit socket event
      req.app.locals.io.emit('sitrep:created', { event_id, sitrep_id: newSitRep.id });

      res.json({
        success: true,
        message: sourceToClone ? 'SitRep created with auto-cloned data' : 'SitRep created (no previous data to clone)',
        sitrep: newSitRep,
        autoCloned: !!sourceToClone,
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('SitRep creation error:', error);
    res.status(500).json({ error: 'Failed to create SitRep' });
  }
});
```

---

## 5. Frontend Implementation

### 5.1 Modified `AddReport.jsx`

Display auto-clone status and source SitRep:

```javascript
import { useState, useEffect, useContext } from 'react';
import { EventContext } from '../contexts/EventContext';
import api from '../lib/api';

export default function AddReport() {
  const { currentEvent, situationalReports } = useContext(EventContext);
  const [selectedEvent, setSelectedEvent] = useState(currentEvent?.id);
  const [sourceClone, setSourceClone] = useState(null);
  const [autoCloned, setAutoCloned] = useState(false);
  const [loading, setLoading] = useState(false);

  // Find latest non-draft SitRep to display source info
  useEffect(() => {
    if (situationalReports.length > 0) {
      const latestNonDraft = situationalReports
        .filter(sr => sr.status !== 'Draft')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      
      if (latestNonDraft) {
        setSourceClone(latestNonDraft);
      }
    }
  }, [situationalReports]);

  const handleCreateSitRep = async (title) => {
    setLoading(true);
    try {
      const response = await api.post('/situational-reports', {
        event_id: selectedEvent,
        title,
        // DO NOT pass copy_from_id — let backend auto-detect
      });

      setAutoCloned(response.data.autoCloned);

      // Show toast notification
      const message = response.data.autoCloned
        ? `✅ SitRep created with data from Report ${sourceClone?.report_number} automatically cloned`
        : `✅ SitRep created. No previous data available.`;
      
      // Toast logic here...
      console.log(message);

      // Redirect to form or list
    } catch (error) {
      console.error('Error creating SitRep:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-report-container">
      <h1>Create New Situational Report</h1>

      {sourceClone && !autoCloned && (
        <div className="info-banner">
          <span>ℹ️ Previous SitRep #{sourceClone.report_number} exists with data</span>
          <span>Data will be automatically carried over when you create the new SitRep</span>
        </div>
      )}

      {autoCloned && sourceClone && (
        <div className="success-banner">
          <span>✅ Data from SitRep #{sourceClone.report_number} has been automatically cloned</span>
          <span>You can now modify only the fields that changed</span>
        </div>
      )}

      <button 
        onClick={() => handleCreateSitRep('Situational Report')}
        disabled={loading}
      >
        {loading ? 'Creating...' : 'Create New SitRep'}
      </button>
    </div>
  );
}
```

### 5.2 Visual Indicator in Data Form

Show which fields were auto-cloned:

```javascript
// In the report form component
<div className="form-section">
  <h3>Power Interruptions & Restoration</h3>
  {clonedData.power_reports?.length > 0 && (
    <div className="cloned-indicator">
      <span className="badge">Cloned from Report #{sourceReport?.report_number}</span>
      <p>These values were carried over from the previous SitRep. Edit as needed.</p>
    </div>
  )}
  
  {/* Render form fields */}
</div>
```

---

## 6. Data Scoping Rules by Role

### 6.1 LGU Level

```
Cloning Rules:
- Only clones data where city = user.city
- Cannot clone data from other cities
- Can override/modify cloned data without restriction

Example:
  LGU User "Manila City" creates new SitRep
  → Auto-detects latest SitRep for event
  → Clones only records with city = "Manila"
  → Ignores all data from Quezon City, Caloocan, etc.
```

### 6.2 Provincial Level

```
Cloning Rules:
- Only clones data where province = user.province
- Data from multiple LGUs in the province are all cloned
- Cannot clone data from other provinces

Example:
  Provincial User "NCR" creates new SitRep
  → Auto-detects latest SitRep for event
  → Clones all records with province = "NCR"
  → Includes data from Manila, Quezon City, Caloocan, Makati, etc.
  → Ignores all data from Rizal, Laguna, etc.
```

### 6.3 Regional Level

```
Cloning Rules:
- Clones all data from all provinces, cities, and LGUs
- No geographic filtering
- Full system-wide clone

Example:
  Regional Admin creates new SitRep
  → Auto-detects latest SitRep for event
  → Clones ALL records from ALL provinces
  → Complete regional dataset is replicated
```

---

## 7. Special Cases & Edge Handling

### 7.1 Affected Population (Parent-Child Records)

```javascript
// Special handling for reports ↔ report_rows relationship
async function cloneAffectedPopulation(client, sourceSitRepId, newSitRepId, eventId, scopeFilter) {
  // 1. Clone parent records (reports table)
  const reportIds = new Map(); // Track old ID → new ID mapping

  const sourceReports = await client.query(
    `SELECT id, ... FROM reports 
     WHERE situational_report_id = $1 AND event_id = $2`,
    [sourceSitRepId, eventId]
  );

  for (const sourceReport of sourceReports.rows) {
    const newReportRes = await client.query(
      `INSERT INTO reports (situational_report_id, event_id, ...)
       VALUES ($1, $2, ...)
       RETURNING id`,
      [newSitRepId, eventId, ...]
    );
    reportIds.set(sourceReport.id, newReportRes.rows[0].id);
  }

  // 2. Clone child records (report_rows table), re-mapping report_id
  for (const [oldReportId, newReportId] of reportIds.entries()) {
    const sourceRows = await client.query(
      `SELECT * FROM report_rows WHERE report_id = $1`,
      [oldReportId]
    );

    for (const row of sourceRows.rows) {
      await client.query(
        `INSERT INTO report_rows (report_id, ...) VALUES ($1, ...)`,
        [newReportId, ...]
      );
    }
  }
}
```

### 7.2 What If No Previous SitRep Exists?

```
Behavior:
- New SitRep is created empty (Draft status)
- No clone operation is triggered
- User proceeds to manually enter data
- Next SitRep will auto-clone from this one
```

### 7.3 What If User Explicitly Passes `copy_from_id`?

```
Behavior:
- Backend respects explicit copy_from_id parameter
- Overrides auto-detection
- Useful if user wants to clone from an older SitRep
- Still respects role-based scoping
```

### 7.4 Deleted or Archived SitReps

```javascript
// Don't clone from Draft or Deleted reports
const latestRes = await client.query(
  `SELECT id FROM situational_reports 
   WHERE event_id = $1 
     AND status NOT IN ('Draft', 'Deleted')
     AND deleted_at IS NULL
   ORDER BY created_at DESC 
   LIMIT 1`,
  [event_id]
);
```

---

## 8. Audit & Logging

### 8.1 Activity Log Entry

Every auto-clone operation creates an audit record:

```sql
INSERT INTO activity_logs (user_id, action, details, created_at)
VALUES (
  'user-123',
  'SITREP_AUTO_CLONED',
  '{"sitrep_id": "new-uuid", "cloned_from_id": "old-uuid", "role": "Provincial", "rows_cloned": 250}',
  NOW()
);
```

### 8.2 Traceability in SitRep Record

```sql
SELECT 
  id,
  report_number,
  created_at,
  cloned_from_id,      -- Source SitRep
  auto_cloned,         -- Was it auto-cloned?
  cloned_at            -- When was it cloned?
FROM situational_reports
WHERE event_id = 'event-123';

-- Example output:
-- id       | report_number | created_at | cloned_from_id | auto_cloned | cloned_at
-- uuid-2   | 2             | 2024-05-15 | uuid-1         | true        | 2024-05-15
-- uuid-1   | 1             | 2024-05-14 | NULL           | false       | NULL
```

---

## 9. Testing Checklist

### 9.1 Unit Tests

- [ ] `getCloneScope()` returns correct scope for each role
- [ ] `buildScopeFilter()` generates correct WHERE clauses
- [ ] `findLatestSourceSitRep()` returns only non-draft reports
- [ ] `cloneTable()` correctly clones all columns except ID/timestamps
- [ ] Parent-child cloning (`reports` ↔ `report_rows`) maintains relationships

### 9.2 Integration Tests

- [ ] LGU creates new SitRep → only their city's data is cloned
- [ ] Provincial creates new SitRep → entire province's data is cloned
- [ ] Regional creates new SitRep → all data is cloned
- [ ] User modifies cloned data → original is unchanged
- [ ] Delete cloned record → source record is unaffected
- [ ] Explicit `copy_from_id` overrides auto-detect
- [ ] No previous SitRep → new SitRep created empty

### 9.3 Scenario Tests

**Scenario 1: Typhoon Updates**
```
Day 1: SitRep 1 created manually by Provincial
Day 2: 8 AM - SitRep 2 created → auto-clones all from SitRep 1
       Users update affected families, power outages
Day 2: 5 PM - SitRep 3 created → auto-clones from SitRep 2
       Only changed values need updating
```

**Scenario 2: Multi-Province Event**
```
Regional creates Event "Typhoon XYZ"
├─ NCR Province → Creates SitRep → Auto-clones province-level data only
├─ CALABARZON Province → Creates SitRep → Auto-clones its own data
├─ MIMAROPA Province → Creates SitRep → Auto-clones its own data
└─ Regional Office → Creates consolidated SitRep → Auto-clones ALL data

Each province only sees/clones its own data in their view
```

**Scenario 3: LGU Correction Workflow**
```
SitRep 1: Manila City reports 50 families, 200 persons affected
SitRep 2: Created → Auto-clones "50 families, 200 persons"
         Manila realizes data was incomplete
         → Updates to 75 families, 300 persons
SitRep 3: Created → Auto-clones "75 families, 300 persons" (corrected data)
```

---

## 10. API Response Examples

### 10.1 Create SitRep with Auto-Clone

**Request:**
```bash
POST /api/situational-reports
Authorization: Bearer <token>
Content-Type: application/json

{
  "event_id": "event-abc123",
  "title": "SitRep No. 2"
}
```

**Response (Success with Auto-Clone):**
```json
{
  "success": true,
  "message": "SitRep created with auto-cloned data",
  "autoCloned": true,
  "sitrep": {
    "id": "sitrep-2",
    "event_id": "event-abc123",
    "report_number": 2,
    "title": "SitRep No. 2",
    "status": "Draft",
    "cloned_from_id": "sitrep-1",
    "auto_cloned": true,
    "cloned_at": "2024-05-15T10:30:00Z",
    "created_by": "user-123",
    "created_at": "2024-05-15T10:30:00Z"
  },
  "clonedRowCounts": {
    "affected_population": 5,
    "related_incidents": 3,
    "damaged_houses": 12,
    "infrastructure_damage": 8,
    "power_reports": 4,
    "water_supply": 2,
    "communication_lines": 1,
    "roads_and_bridges": 6,
    "pre_emptive_evacuation": 2,
    "class_suspension": 1,
    "work_suspension": 1,
    "state_of_calamity": 1,
    "agriculture_damage": 4,
    "assistance_provided": 3,
    "assistance_from_agencies": 2
  }
}
```

**Response (Success without Auto-Clone):**
```json
{
  "success": true,
  "message": "SitRep created (no previous data to clone)",
  "autoCloned": false,
  "sitrep": {
    "id": "sitrep-1",
    "event_id": "event-abc123",
    "report_number": 1,
    "status": "Draft",
    "cloned_from_id": null,
    "auto_cloned": false,
    ...
  }
}
```

---

## 11. Migration from Current System

### Step 1: Add New Columns
```sql
ALTER TABLE situational_reports 
ADD COLUMN cloned_from_id UUID REFERENCES situational_reports(id);
ADD COLUMN auto_cloned BOOLEAN DEFAULT FALSE;
ADD COLUMN cloned_at TIMESTAMPTZ;
```

### Step 2: Deploy Backend Changes
- Update `situationalReports.js` with new logic
- Test thoroughly in staging

### Step 3: Deploy Frontend Changes
- Update `AddReport.jsx` to remove manual copy selection (optional—keep for backward compat)
- Add visual indicators for cloned data

### Step 4: Rollout Plan
- **Day 1**: Deploy to staging, run all tests
- **Day 2**: Deploy to production with feature flag (auto-clone enabled/disabled)
- **Day 3-7**: Monitor, gather user feedback
- **Day 8+**: Permanent rollout or iterate

---

## 12. Configuration & Feature Flags

Add to `.env`:

```env
# Auto-Clone SitRep Feature
AUTO_CLONE_SITREP_ENABLED=true
AUTO_CLONE_RESPECT_HIERARCHY=true
AUTO_CLONE_INCLUDE_DRAFT_REPORTS=false
```

Backend check:
```javascript
if (process.env.AUTO_CLONE_SITREP_ENABLED !== 'true') {
  console.log('Auto-clone is disabled');
  sourceToClone = null;
}
```

---

## 13. Performance Considerations

### Query Optimization
- Index on `(event_id, status, created_at)` for fast SitRep lookup
- Index on `situational_report_id` for each sub-table
- Consider partitioning large tables by `event_id`

### Bulk Operations
- Clone operation is transactional but can be slow for large datasets (1000+ rows)
- Estimated time: 500 rows ≈ 2-3 seconds
- For very large clones, consider async processing with status webhook

### Caching
- Cache `findLatestSourceSitRep()` result for 30 seconds
- Invalidate on any SitRep status change

---

## 14. Future Enhancements

1. **Selective Cloning**: User chooses which categories to clone (vs. all)
2. **Delta View**: Side-by-side comparison of old vs. new data
3. **Smart Suggestions**: ML-based recommendations for data changes
4. **Template SitReps**: Pre-configured templates for recurring event types
5. **Scheduled Auto-Reports**: Automatic SitRep creation at intervals (e.g., every 6 hours)

---

## 15. Conclusion

The Auto-Clone feature streamlines SitRep creation by intelligently carrying forward data from previous reports while strictly respecting the LGU → Provincial → Regional hierarchy. This reduces duplicate data entry, speeds up disaster response workflows, and maintains data integrity across government levels.

**Key Benefits:**
✅ Faster report creation during emergencies  
✅ Reduced manual data re-entry  
✅ Role-aware, privacy-conscious scoping  
✅ Full audit trail and traceability  
✅ Backward compatible with existing workflow  

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Maintained By:** PROACT Development Team
