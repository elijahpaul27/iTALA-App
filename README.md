# iTALA - Offline-First DepEd K-12 Grading Desktop App

iTALA is an offline-first desktop application for Philippine K-12 teachers and school administrators. It streamlines class setup, learner rosters, grade encoding, attendance, honor roll computation, and DepEd form generation in one local Electron app.

The project was built around a practical school workflow: teachers need a fast spreadsheet-like gradebook, reliable local storage, and print-ready DepEd reports without depending on internet access.

## Highlights

- Offline-first Electron desktop app with local SQLite storage
- Role-based Admin and Teacher workspaces
- Spreadsheet-style gradebook with virtualization, keyboard navigation, debounced saves, and What-If simulation
- DepEd transmutation and quarterly grade summaries through SQLite views
- SF2, SF5, SF9, and SF10 export workflows using ExcelJS and PDF generation
- Honor roll, certificate generation, and at-risk learner reporting
- LIS-aware roster CSV import and DepEd standard subject weight templates
- Backup/restore utilities plus automatic ghost backups on app close
- Secure Electron preload bridge: renderer code never directly touches SQLite or the filesystem

## Tech Stack

| Area | Technology |
| --- | --- |
| Desktop shell | Electron 30 |
| Frontend | React 18, Vite |
| Styling | Tailwind CSS, custom neumorphic design tokens |
| Local database | SQLite3 |
| Excel exports | ExcelJS |
| PDF generation | pdf-lib |
| Charts | Recharts |
| Performance | TanStack React Virtual, React Query, debounced mutations |
| Testing | Vitest |
| Packaging | electron-builder |

## Why This Project Matters

Many school tools assume stable internet access or require teachers to manually manage complex spreadsheets. iTALA approaches the problem as a local-first desktop system:

- Data remains on the teacher's machine.
- The app continues working offline.
- Heavy gradebook screens stay responsive with larger classes.
- Reports are generated from the same source of truth as the gradebook.
- File and database access are isolated in Electron's main process.

This makes the project a strong full-stack desktop case study: local persistence, secure IPC, performance-sensitive React UI, spreadsheet-like workflows, and document generation.

## Core Features

### Admin Workspace

- Teacher account management
- PIN reset support
- School-level dashboard counts
- Backup and restore access

### Teacher Workspace

- Teacher profile unlock with local PIN verification
- Class management
- Learner roster management
- Subject and assessment setup
- Gradebook, attendance, forms, analytics, and rollover workflows

### Gradebook

- Quarter-based sub-navigation:
  - Setup Assessments
  - Q1 Scores
  - Q2 Scores
  - Q3 Scores
  - Q4 Scores
  - Analytics and Summary
- Excel-like keyboard navigation
- Sticky learner column and table headers
- Row virtualization for large rosters
- Debounced batch grade saves
- Raw score validation against assessment maximum scores
- What-If mode for local grade simulation without saving
- Spreadsheet Mode for high-contrast, low-shadow data entry
- Raw gradebook Excel export

### Analytics and Interventions

- Grade distribution chart
- At-risk learner widget
- At-risk PDF notice export
- Quarterly summaries
- Honor roll ranking with decimal precision tie-breaking
- Honor certificate PDF generation

### Attendance

- Daily attendance grid
- Present, Absent, and Tardy status tracking
- Real-time P/A/T totals
- Mark All Present action
- SF2 export support

### DepEd Form Generation

- Template Manager for official Excel templates
- SF5 export with dynamic row support for larger classes
- SF9 batch report card export
- SF10 interactive form replacement:
  - Learner personal information
  - Grade 1 eligibility
  - PEPT / ALS details
  - School information
  - Scholastic history
  - Subject ratings
- SF10 Excel mapping utilities for merged-cell templates

### Onboarding and Automation

- LIS-aware CSV import for standard DepEd roster headers
- DepEd standard subject weight templates by grade level
- End-of-year promotion / rollover workflow
- Automatic local database backup on app close

## Architecture

iTALA uses a strict Electron architecture:

```text
React Renderer
  |
  | window.api / window.itAPI
  v
Electron Preload Bridge
  |
  | Whitelisted IPC calls only
  v
Electron Main Process
  |
  | Prepared SQLite queries, ExcelJS, pdf-lib, filesystem
  v
Local SQLite Database and Generated Files
```

The renderer never imports Node filesystem modules, never opens the database directly, and never sends arbitrary SQL. All persistence and file work goes through named IPC handlers in the main process.

## Security and Reliability Choices

- `contextIsolation: true`
- `nodeIntegration: false`
- Whitelisted preload API only
- No direct renderer database or filesystem access
- Parameterized SQLite calls
- LRN validation enforced in the main process
- Raw score validation enforced before persistence
- SQLite foreign keys enabled
- SQLite WAL mode enabled
- Audit logging for grade edits
- Backup and restore tools
- Ghost backup creation on app close

## Database

The local database is stored in Electron's `userData` folder:

```text
C:\Users\<User>\AppData\Roaming\itala\itala.sqlite3
```

Core tables include:

- `Teachers`
- `Classes`
- `Students`
- `Subjects`
- `Assessments`
- `Grades`
- `grade_audit`
- `Attendance_Logs`
- `Academic_Records_History`

The grade computation view is:

```text
v_quarterly_grade_summary
```

It calculates component percentages, weighted scores, initial grades, transmuted grades, and decimal precision values used for honor roll tie-breaking.

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Windows recommended for the packaged desktop workflow

### Install

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

This starts Vite and opens the app through Electron.

Do not use the Vite URL alone for full testing. The frontend depends on Electron IPC, so real database and export features require Electron.

### Run Web Preview Only

```bash
npm run dev:web
```

Useful for visual debugging only. IPC-backed features will not work in a normal browser.

### Build Frontend

```bash
npm run build
```

### Start Electron from Built App

```bash
npm start
```

### Package Windows App

```bash
npm run dist:win
```

## Demo Data

Seed a full demo database:

```bash
node scripts/seed-demo-data.cjs
```

This creates sample teachers, classes, students, subjects, assessments, and grades.

Seed a focused SF10 sample:

```bash
node scripts/seed-sf10-sample.cjs
```

This adds a learner with SF10 personal info, Grade 1 eligibility, scholastic history, and current grade data.

Important: the full demo seeder is destructive and resets demo tables. Use it only when you are comfortable replacing local sample data.

## Testing

Run the test suite:

```bash
npm test
```

Current tests cover critical audit utilities such as payload validation, path safety, and template validation logic.

## Project Structure

```text
electron/
  main.js              Electron main process, IPC, SQLite, exports, backups
  preload.cjs          Whitelisted renderer API bridge
  auditCore.js         Shared validation helpers

migrations/
  *.sql                Idempotent database migrations

scripts/
  seed-demo-data.cjs
  seed-sf10-sample.cjs
  debug-sf10-merged-cells.mjs

src/
  App.jsx
  main.jsx
  styles.css
  components/
    admin/
    attendance/
    awards/
    grading/
    layouts/
    roster/
    settings/
    sf10/
    ui/
  db/
    schema.sql
  lib/
    api.js
  types/
    ipc.d.ts
  utils/
    exportService.js

tests/
  auditCore.test.js
```

## Export Templates

The app can use official DepEd Excel templates uploaded through the Forms tab.

Supported template workflows include:

- SF5
- SF10
- SF9 generated workbook output
- Raw gradebook workbook output

Template files are stored in the app's user data folder under:

```text
templates/
```

The SF10 debug utility can inspect merged cells in official templates:

```bash
node scripts/debug-sf10-merged-cells.mjs
```

## Portfolio Notes

This project demonstrates:

- Desktop application architecture with Electron
- Secure IPC design
- Offline-first local data persistence
- SQLite schema design and migrations
- React component architecture
- Performance optimization for large editable grids
- Real-world form generation with ExcelJS
- PDF generation with pdf-lib
- Domain-specific workflow modeling for education
- Production packaging with electron-builder

## Known Limitations

- The SQLite database is local and not encrypted.
- Admin mode is role-selected and should be protected with stronger authentication before production deployment.
- Official DepEd template coordinates can change, so Excel mappings may need adjustment when templates are updated.
- Current tests focus on core validation; broader UI and export regression coverage would be valuable.

## Roadmap

- Add stronger admin authentication
- Add encrypted backups
- Expand automated tests for exports and grade calculations
- Add visual regression tests for critical layouts
- Add template version detection
- Add installer smoke tests on a clean Windows profile

## Author

Built by Elijah Paul Alino as a full-stack desktop application project for offline-first school operations and DepEd K-12 reporting workflows.

