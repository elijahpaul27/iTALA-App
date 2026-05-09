const unavailable = () => {
  throw new Error('Electron IPC API is unavailable. Run the app with Electron, not only Vite.');
};

export const api = window.api ?? {
  teachers: { list: unavailable, create: unavailable, save: unavailable, delete: unavailable, resetPin: unavailable, verifyPin: unavailable },
  admin: { stats: unavailable },
  classes: { list: unavailable, save: unavailable, delete: unavailable, applyStandardWeights: unavailable, rolloverCandidates: unavailable, rolloverPromoted: unavailable },
  students: { list: unavailable, save: unavailable, delete: unavailable, importCsv: unavailable },
  subjects: { list: unavailable, save: unavailable, delete: unavailable },
  assessments: { list: unavailable, save: unavailable, delete: unavailable },
  grades: { list: unavailable, save: unavailable, mutateBatch: unavailable, summary: unavailable, exportRawGrid: unavailable, onChanged: unavailable },
  analytics: { gradeDistribution: unavailable, atRisk: unavailable, exportAtRiskNotices: unavailable },
  attendance: { save: unavailable, delete: unavailable, dailyGrid: unavailable, monthlySummary: unavailable },
  awards: { listHonorRoll: unavailable, generateCertificates: unavailable },
  history: { list: unavailable, save: unavailable, delete: unavailable },
  sf10: { getDraft: unavailable, saveDraft: unavailable },
  forms: { exportSf5: unavailable, exportSf9Batch: unavailable, exportSf10: unavailable, exportSf2: unavailable, generateSF5: unavailable, generateSF10: unavailable },
  templates: { list: unavailable, upload: unavailable },
  settings: { backupDatabase: unavailable, restoreDatabase: unavailable }
};
