# iTALA Updated Project Analysis

Date prepared: May 7, 2026  
Project directory: `C:\Users\Elijah Paul Alino\OneDrive\Desktop\TR-Yangco-App`

## 1. Executive Summary

iTALA is now a single offline-first Electron desktop application built with React, Vite, SQLite, ExcelJS, and PDF generation support. The current project is centered on the root application, not the older Flask app that previously ran on `http://127.0.0.1:5000`.

The active development target is:

```text
http://127.0.0.1:5174
```

However, this URL must normally be loaded through Electron using `npm run dev`. Opening the Vite URL directly in a regular browser can show the expected error:

```text
Electron IPC API is unavailable. Run the app with Electron, not only Vite.
```

That happens because the React frontend depends on the Electron preload bridge (`window.api`) to call SQLite, file export, backup, restore, and template functions.

## 2. Current Project Shape

The cleaned root directory currently contains the runnable Electron/Vite system:

```text
TR-Yangco-App/
  dist/
  electron/
    main.js
    preload.cjs
  node_modules/
  release/
  scripts/
    seed-demo-data.cjs
  src/
    App.jsx
    main.jsx
    styles.css
    components/
      admin/
      analytics/
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
    utils/
      exportService.js
  index.html
  package.json
  package-lock.json
  postcss.config.js
  tailwind.config.js
  vite.config.js
  PROJECT_ANALYSIS.md
```

`dist/` is the Vite production build output.  
`release/` is the Electron Builder output, including the packaged Windows app.  
`node_modules/` is required for local development unless dependencies are reinstalled.

The previous duplicate Flask/Python structure is no longer part of the active app.

## 3. Runtime Commands

Run all commands from:

```text
C:\Users\Elijah Paul Alino\OneDrive\Desktop\TR-Yangco-App
```

Development with Electron:

```bash
npm run dev
```

This starts Vite on `127.0.0.1:5174`, waits for it, then opens Electron pointed at that dev server.

Web-only Vite server:

```bash
npm run dev:web
```

This is useful for visual inspection only. Database and export features will not work in a normal browser because Electron IPC is unavailable.

Production frontend build:

```bash
npm run build
```

Run Electron against the built `dist/` output:

```bash
npm start
```

Build a packaged app:

```bash
npm run dist
```

Build the Windows NSIS installer target:

```bash
npm run dist:win
```

## 4. Package and Build Configuration

Primary file:

```text
package.json
```

Important settings:

- `"type": "module"` is enabled for the project.
- Electron main entry is `electron/main.js`.
- Electron preload uses `electron/preload.cjs` so it can safely run as CommonJS despite the ESM package setting.
- Electron Builder outputs to `release/`.
- Packaged files include `dist/**/*`, `electron/**/*`, `src/db/schema.sql`, `src/utils/exportService.js`, and `package.json`.
- `sqlite3` is listed in `asarUnpack` because native SQLite binaries need to be accessible outside the app archive.

Key dependencies:

- `electron`
- `react`
- `vite`
- `sqlite3`
- `exceljs`
- `pdf-lib`
- `lucide-react`
- `recharts`
- `@tanstack/react-virtual`
- `lodash.debounce`

Tailwind is configured in `tailwind.config.js` with valid content scanning:

```js
content: ['./index.html', './src/**/*.{js,jsx}']
```

## 5. Application Data Location

The SQLite database is stored in Electron's user data folder:

```text
C:\Users\Elijah Paul Alino\AppData\Roaming\iTALA\itala.sqlite3
```

This is intentional. It keeps live user data separate from source code, build output, and packaged app files.

The demo seeder also writes to this same database path, not to a local `database.sqlite` file in the repository.

## 6. Electron Main Process

Primary file:

```text
electron/main.js
```

Main responsibilities:

- Create the Electron `BrowserWindow`.
- Load the Vite dev server in development or `dist/index.html` in production.
- Initialize SQLite and execute `src/db/schema.sql`.
- Provide promise wrappers for SQLite operations.
- Hash and verify teacher PINs with PBKDF2 SHA-512.
- Validate 12-digit LRNs.
- Validate raw scores against assessment maximum scores.
- Parse and import roster CSV files.
- Register all IPC handlers.
- Manage Excel template upload and discovery.
- Generate raw grade grid Excel exports.
- Generate SF5 and SF10 Excel files through `src/utils/exportService.js`.
- Generate honor certificates through `pdf-lib`.
- Backup and restore the SQLite database.

The main process is the trusted side of the app. The renderer does not get direct filesystem or SQLite access.

## 7. Preload Bridge

Primary file:

```text
electron/preload.cjs
```

The preload exposes a safe API to the React renderer:

```js
window.api
```

Available API groups:

```text
teachers
admin
classes
students
subjects
assessments
grades
analytics
attendance
awards
history
forms
templates
settings
```

The renderer calls these methods through `src/lib/api.js`. If `window.api` does not exist, `api.js` throws a clear error explaining that the app must be run through Electron.

## 8. IPC Surface

Registered IPC handlers include:

```text
teachers:list
teachers:create
teachers:save
teachers:delete
teachers:resetPin
teachers:verifyPin
admin:stats
classes:list
classes:save
classes:delete
classes:rolloverCandidates
classes:rolloverPromoted
students:list
students:save
students:delete
students:importCsv
subjects:list
subjects:save
assessments:list
assessments:save
assessments:delete
grades:list
grades:save
grades:summary
grades:exportRawGrid
analytics:gradeDistribution
analytics:atRisk
attendance:save
attendance:delete
attendance:dailyGrid
attendance:monthlySummary
forms:exportSf5
forms:exportSf10
awards:listHonorRoll
awards:generateCertificates
history:list
history:save
history:delete
templates:list
templates:upload
settings:backupDatabase
settings:restoreDatabase
```

This is a broad enough IPC layer to support administration, teacher workflows, grading, attendance, forms, templates, awards, and local database maintenance.

## 9. Frontend Architecture

Primary entry:

```text
src/main.jsx
```

Main app shell:

```text
src/App.jsx
```

The app uses a role-first flow:

```text
RoleGate
  -> Admin workspace
  -> Teacher workspace
```

Admin workspace:

```text
AdminLayout
  Dashboard
  Teachers
  Settings
```

Teacher workspace:

```text
ProfileGate
  TeacherLayout
    Classes
    Gradebook
    Attendance
    Forms
```

Selected state in `App.jsx` includes:

- active role
- selected teacher
- active admin tab
- active teacher tab
- selected class
- selected subject

This keeps navigation simple and local while the data itself stays in SQLite.

## 10. UI Modules

### Layouts

Files:

```text
src/components/layouts/RoleGate.jsx
src/components/layouts/ShellLayout.jsx
src/components/layouts/TopBar.jsx
src/components/layouts/AdminLayout.jsx
src/components/layouts/TeacherLayout.jsx
```

These provide the role selector, shared sidebar shell, top bar, admin navigation, and teacher navigation.

### Admin Dashboard

File:

```text
src/components/admin/AdminDashboard.jsx
```

Shows high-level database counts and recent teacher records using `admin:stats`.

### Teacher Management

File:

```text
src/components/admin/TeacherManagement.jsx
```

Supports creating, editing, deleting, and resetting PINs for teacher profiles.

### Settings

File:

```text
src/components/settings/SettingsPanel.jsx
```

Supports:

- backing up the SQLite database to Downloads
- restoring a selected `.sqlite`, `.sqlite3`, or `.db` database file

### Teacher Profile Gate

File:

```text
src/components/roster/ProfileGate.jsx
```

Lists teachers and verifies a selected teacher PIN before opening the teacher workspace.

### Class Manager

File:

```text
src/components/roster/ClassManager.jsx
```

Supports class create, edit, delete, and selection. Class records include teacher, grade level, section, school year, and curriculum.

### Roster Manager

File:

```text
src/components/roster/RosterManager.jsx
```

Supports learner create, edit, delete, and CSV import. LRNs are validated as exactly 12 digits before saving.

### Subject Manager

File:

```text
src/components/grading/SubjectManager.jsx
```

Supports subject setup per class. Subject weights must add to `1.0`.

### Gradebook

Files:

```text
src/components/grading/Gradebook.jsx
src/components/grading/AssessmentManager.jsx
src/components/grading/RawScoreGrid.jsx
src/components/grading/InsightsPanel.jsx
src/components/grading/gradebookUtils.js
```

Gradebook supports:

- class and subject selection
- assessment setup
- quarter tabs
- raw score entry
- debounced score saving
- keyboard navigation
- virtualized score grid rendering through `@tanstack/react-virtual`
- score validation against max score
- quarterly grade summaries
- analytics through charts and summary cards
- raw grade grid export to Excel

### Attendance

File:

```text
src/components/attendance/AttendancePanel.jsx
```

Supports monthly attendance work. The backend IPC provides both daily-grid and monthly-summary endpoints, and the current component can save, delete, and summarize attendance logs.

### Forms and SF10 History

Files:

```text
src/components/sf10/FormGenerationPanel.jsx
src/components/sf10/SF10HistoryForm.jsx
```

Supports:

- template status checking
- uploading SF5 and SF10 templates
- exporting SF5 for the selected class
- exporting SF10 for the selected learner
- CRUD operations for academic history records used by SF10

### Class Rollover

File:

```text
src/components/roster/ClassRollover.jsx
```

Computes promoted and retained learners from final grade summaries, then creates the next class for promoted learners.

### Awards

Files:

```text
src/components/awards/AwardsPanel.jsx
src/components/grading/InsightsPanel.jsx
```

The current IPC layer supports honor roll listing and PDF certificate generation. The grading insights panel exposes the active awards workflow.

### Shared UI

Files:

```text
src/components/ui/Button.jsx
src/components/ui/Card.jsx
src/components/ui/Field.jsx
src/components/ui/Input.jsx
src/components/ui/Select.jsx
src/components/ui/Table.jsx
src/components/ui/index.js
src/components/ui/utils.js
```

These provide reusable controls and visual consistency across the app.

## 11. Database Schema

Primary file:

```text
src/db/schema.sql
```

Tables:

```text
Teachers
Classes
Students
Subjects
Assessments
Grades
Attendance_Logs
Academic_Records_History
```

Indexes:

```text
idx_classes_teacher_id
idx_students_class_id
idx_subjects_class_id
idx_assessments_subject_quarter
idx_grades_student_assessment
idx_attendance_student_date
```

View:

```text
v_quarterly_grade_summary
```

Important constraints:

- `Students.lrn` must be exactly 12 numeric digits.
- `Students.sex` must be `M` or `F`.
- `Students` has unique `(class_id, lrn)`.
- `Subjects` has unique `(class_id, name)`.
- Subject weights must sum to `1.0`.
- `Assessments.quarter` must be 1 to 4.
- `Assessments.type` must be `WW`, `PT`, or `QA`.
- `Grades` has unique `(student_id, assessment_id)`.
- `Attendance_Logs.status` must be `Present`, `Absent`, or `Tardy`.
- `Academic_Records_History` has primary key `(student_id, school_year, grade_level)`.

## 12. Grade Computation

The SQLite view `v_quarterly_grade_summary` calculates:

1. raw totals per learner, subject, quarter, and assessment type
2. percentage scores for written work, performance tasks, and quarterly assessment
3. weighted component scores based on subject weights
4. initial grade
5. transmuted quarterly grade

Current transmutation formula:

```sql
CASE
  WHEN initial_grade >= 60 THEN MIN(100, CAST(((initial_grade - 60.0) / 1.6) AS INTEGER) + 75)
  ELSE MAX(60, CAST((initial_grade / 4.0) AS INTEGER) + 60)
END
```

Final averages are computed from available transmuted quarterly subject grades in application code.

## 13. Export Service

Primary file:

```text
src/utils/exportService.js
```

Factory:

```js
createExportService({ app, db })
```

Public functions:

```js
generateSF5(classId)
generateSF10(studentIdOrPayload)
```

Template names:

```text
School Form 5 Report on Promotion and Learning Progress Achievement.xlsx
School-Form-10-ES-Learners-Academic Permanent-Record_26March2025.xlsx
```

Required sheets:

```text
School Form 5 (SF5)
Front
Back
```

Template search locations include:

- Electron user data templates folder
- packaged `resources/templates`
- app root `templates`
- app root `src/templates`
- app root `assets/templates`
- current working directory template folders
- user Downloads folder

SF5 export maps:

- school header fields
- grade level and section
- adviser
- learner LRN
- learner name
- general average
- action taken
- failed learning areas
- promoted and retained counts by sex
- achievement descriptor counts

SF10 export maps:

- learner personal information
- LRN, birthdate, sex
- eligibility credential
- current academic record
- stored academic history records
- quarterly grades
- final ratings
- remarks

Generated files are saved to:

```text
Documents
```

Filename patterns:

```text
SF5_Grade<Level>_<Section>.xlsx
SF10_<LastName>_<FirstName>.xlsx
```

## 14. Template Management

Template-related IPC:

```text
templates:list
templates:upload
```

The app can copy selected official DepEd Excel files into the user data templates directory. This reduces dependence on files sitting in Downloads.

Missing templates are handled with explicit errors that name the expected template file and a recommended location.

## 15. Demo Seeder

Primary file:

```text
scripts/seed-demo-data.cjs
```

Run command:

```bash
node scripts/seed-demo-data.cjs
```

The seeder resets and populates:

```text
C:\Users\Elijah Paul Alino\AppData\Roaming\iTALA\itala.sqlite3
```

Seeded totals:

```text
Teachers: 7
Classes: 6
Students: 60
Subjects: 42
Assessments: 840
Grades: 8400
```

Seeded grade and section setup:

```text
Grade 1 - Rizal
Grade 2 - Bonifacio
Grade 3 - Mabini
Grade 4 - Luna
Grade 5 - Del Pilar
Grade 6 - Aguinaldo
```

Seeded login credentials:

```text
Maestro Admin    PIN: 1234
Teacher Grade 1  PIN: 1111
Teacher Grade 2  PIN: 2222
Teacher Grade 3  PIN: 3333
Teacher Grade 4  PIN: 4444
Teacher Grade 5  PIN: 5555
Teacher Grade 6  PIN: 6666
```

Seeded school profile:

```text
TR Yangco Elementary School
School ID: 136666
School Year: 2025-2026
Curriculum: MATATAG
```

Important note: running the seeder deletes existing records in the app database before inserting demo data.

## 16. Main Data Flows

Role and login flow:

```text
React RoleGate
  -> Admin workspace
  -> or Teacher ProfileGate
  -> window.api.teachers.verifyPin
  -> preload.cjs
  -> ipcMain
  -> SQLite Teachers
```

Class and roster flow:

```text
ClassManager / RosterManager
  -> src/lib/api.js
  -> window.api.classes / window.api.students
  -> Electron IPC
  -> SQLite Classes / Students
```

Gradebook flow:

```text
Gradebook
  -> SubjectManager / AssessmentManager / RawScoreGrid
  -> subjects, assessments, grades IPC
  -> SQLite Subjects / Assessments / Grades
  -> v_quarterly_grade_summary
  -> summaries, analytics, exports
```

Attendance flow:

```text
AttendancePanel
  -> attendance IPC
  -> SQLite Attendance_Logs
  -> daily grid and monthly summary
```

Form export flow:

```text
FormGenerationPanel
  -> forms IPC
  -> exportService
  -> SQLite class/student/grade/history queries
  -> ExcelJS reads DepEd template
  -> generated workbook saved to Documents
```

Backup and restore flow:

```text
SettingsPanel
  -> settings IPC
  -> copy live SQLite database to Downloads
  -> or replace live database from chosen backup file
```

## 17. Security and Privacy

Strengths:

- The app is offline-first.
- Data stays on the local Windows user profile.
- PINs are hashed with PBKDF2 SHA-512, salt, and 120,000 iterations.
- The React renderer has no direct Node.js, filesystem, or SQLite access.
- The preload exposes a limited API instead of enabling broad renderer privileges.
- Raw score and LRN validation are enforced in the main process.

Current gaps:

- The Admin role is selected from the client role gate and is not protected by a separate admin password.
- Teacher PINs are suitable for lightweight local access, not high-security authentication.
- The SQLite database is not encrypted.
- Backups are plain SQLite files.
- Demo credentials are intentionally simple.
- There is no audit trail for edits.
- There is no multi-user permission model beyond local teacher profile selection.

## 18. Generated Artifacts

Generated but useful folders:

```text
dist/
release/
node_modules/
```

`dist/` can be regenerated with `npm run build`.  
`release/` can be regenerated with `npm run dist` or `npm run dist:win`.  
`node_modules/` can be regenerated with `npm install`.

These folders are not source code, but they are useful for local testing and packaging. If repository size becomes a concern, they can be excluded from version control through `.gitignore`.

## 19. Known Limitations and Risks

1. Browser-only usage is not supported for full app behavior.

   The app needs Electron IPC. Use `npm run dev`, not only `npm run dev:web`, when testing real functionality.

2. There is no formal database migration system.

   `schema.sql` uses `CREATE TABLE IF NOT EXISTS`, but there is no schema version table or migration runner.

3. SF5 and SF10 coordinate mappings are template-specific.

   If the official Excel templates change structure, export cell mappings may need to be updated.

4. Template files are external.

   The app can upload templates into user data, but the official Excel templates are not embedded as source files in the current project tree.

5. Admin access is not strongly authenticated.

   The role selector can enter the Admin workspace. Teacher profile PIN verification exists for teacher mode.

6. The demo seeder is destructive.

   It deletes existing app database records before inserting demo records.

7. Restore database requires careful user handling.

   Replacing the live SQLite file can leave old UI state visible until the app refreshes or restarts.

8. Export logic depends on complete grade data.

   Missing scores or missing assessments can produce incomplete final averages.

9. Packaged native SQLite behavior must be checked after each packaging change.

   `sqlite3` native modules are unpacked, but Windows packaging should still be tested on the target machine.

## 20. Recommended Next Steps

High priority:

1. Add protected Admin sign-in or an admin PIN.
2. Add formal database migrations with a schema version table.
3. Add a first-run setup screen for school metadata and template status.
4. Add tests for grade computation, rollover, and SF5/SF10 export summaries.
5. Verify packaged `release/win-unpacked/iTALA.exe` on a clean Windows user profile.

Medium priority:

1. Add encrypted backups or password-protected backup export.
2. Add import validation previews before roster CSV import is committed.
3. Add an audit log for important record edits.
4. Add stronger restore flow messaging and automatic app reload after restore.
5. Add template version detection or visual mapping checks for official DepEd forms.

Operational improvements:

1. Add `.gitignore` entries for generated output if this will be committed to Git.
2. Keep official DepEd templates in a documented `templates/` setup process.
3. Create a short `README.md` with run, seed, build, and export setup instructions.
4. Add automated smoke checks for Electron IPC handler availability.

## 21. Operational Checklist

Fresh local setup:

```bash
npm install
```

Seed demo database:

```bash
node scripts/seed-demo-data.cjs
```

Run the real app:

```bash
npm run dev
```

Build frontend:

```bash
npm run build
```

Run packaged-style Electron from build:

```bash
npm start
```

Package Windows app:

```bash
npm run dist:win
```

Confirm export templates:

```text
School Form 5 Report on Promotion and Learning Progress Achievement.xlsx
School-Form-10-ES-Learners-Academic Permanent-Record_26March2025.xlsx
```

Use the Forms tab template manager or place them in a supported templates folder.

## 22. Overall Assessment

The project is now a coherent offline desktop application with one active runtime path:

```text
React + Vite + Electron IPC + SQLite + ExcelJS/PDF exports
```

The strongest parts of the implementation are the local-first architecture, broad IPC coverage, role-based workspace split, gradebook workflow, strict LRN and raw score validation, demo data generation, backup/restore support, and DepEd form export foundation.

The main remaining work is production hardening: admin authentication, migrations, testing, template validation, and reliable packaged-app verification. The app is past the cleanup stage; it is now in workflow completion and hardening territory.
