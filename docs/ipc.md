# iTALA IPC Contract

Renderer code must use the preload bridge. It must not import `electron`, read files, or access SQLite directly.

## `window.itAPI`

```ts
type ClassSummary = { id: number; name: string; subject: string; year: string; teacherId: number };

window.itAPI.getClasses(): Promise<ClassSummary[]>;
window.itAPI.getStudents(classId: number): Promise<Student[]>;
window.itAPI.getGrades(classId: number, quarter: number): Promise<GradeRow[]>;
window.itAPI.mutateGradesBatch(payload: {
  classId: number;
  quarter: number;
  updates: { studentId: number; assessmentId: number; value: number; userId?: number | null }[];
}): Promise<{ ok: boolean; failed: { index: number; studentId?: number; assessmentId?: number; reason: string }[] }>;
window.itAPI.importStudents(filePath: string): Promise<{ ok: boolean; errors: string[] }>;
window.itAPI.exportGrades(classId: number, quarter: number, templateId: string): Promise<{ ok: boolean; path: string }>;
window.itAPI.validateTemplate(filePath: string): Promise<{ ok: boolean; errors: { row?: number; col?: string; message: string }[] }>;
window.itAPI.onGradesChanged(cb: () => void): () => void;
```

The preload also contains a temporary compatibility facade for legacy screens. It exposes named RPC calls only and does not expose `ipcRenderer`, SQL, Node, or filesystem primitives.

## Security Notes

- `BrowserWindow` uses `contextIsolation: true` and `nodeIntegration: false`.
- Grade mutations use `mutate:gradesBatch`.
- File imports and exports are performed in the main process.
- Template validation runs in the main process before export workflows.
