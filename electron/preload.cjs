const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

const itAPI = {
  getClasses: () => invoke('get:classes'),
  getStudents: (classId) => invoke('get:students', classId),
  getGrades: (classId, quarter) => invoke('get:grades', { classId, quarter }),
  mutateGradesBatch: (payload) => invoke('mutate:gradesBatch', payload),
  importStudents: (filePath) => invoke('import:students', filePath),
  exportGrades: (classId, quarter, templateId) => invoke('export:grades', { classId, quarter, templateId }),
  validateTemplate: (filePath) => invoke('validate:template', filePath),
  onGradesChanged: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const handler = () => cb();
    ipcRenderer.on('grades:changed', handler);
    return () => ipcRenderer.removeListener('grades:changed', handler);
  }
};

contextBridge.exposeInMainWorld('itAPI', itAPI);

// Temporary compatibility facade for existing non-gradebook screens. It exposes
// named RPC functions only; no SQL, fs, ipcRenderer, or arbitrary channel access.
contextBridge.exposeInMainWorld('api', {
  teachers: {
    list: () => invoke('teachers:list'),
    create: (teacher) => invoke('teachers:create', teacher),
    save: (teacher) => invoke('teachers:save', teacher),
    delete: (teacherId) => invoke('teachers:delete', teacherId),
    resetPin: (payload) => invoke('teachers:resetPin', payload),
    verifyPin: (teacherId, pin) => invoke('teachers:verifyPin', { teacherId, pin })
  },
  admin: {
    stats: () => invoke('admin:stats')
  },
  classes: {
    list: (teacherId) => invoke('classes:list', teacherId),
    save: (classRecord) => invoke('classes:save', classRecord),
    delete: (classId) => invoke('classes:delete', classId),
    applyStandardWeights: (classId) => invoke('classes:applyStandardWeights', classId),
    rolloverCandidates: (classId) => invoke('classes:rolloverCandidates', classId),
    rolloverPromoted: (payload) => invoke('classes:rolloverPromoted', payload)
  },
  students: {
    list: (classId) => invoke('students:list', classId),
    save: (student) => invoke('students:save', student),
    delete: (studentId) => invoke('students:delete', studentId),
    importCsv: (classId) => invoke('students:importCsv', classId)
  },
  subjects: {
    list: (classId) => invoke('subjects:list', classId),
    save: (subject) => invoke('subjects:save', subject),
    delete: (subjectId) => invoke('subjects:delete', subjectId)
  },
  assessments: {
    list: (subjectId, quarter = null) => invoke('assessments:list', subjectId, quarter),
    save: (assessment) => invoke('assessments:save', assessment),
    delete: (assessmentId) => invoke('assessments:delete', assessmentId)
  },
  grades: {
    list: (filters) => invoke('grades:list', filters),
    save: (grade) => invoke('grades:save', grade),
    mutateBatch: itAPI.mutateGradesBatch,
    summary: (filters) => invoke('grades:summary', filters),
    exportRawGrid: (filters) => invoke('grades:exportRawGrid', filters),
    onChanged: itAPI.onGradesChanged
  },
  analytics: {
    gradeDistribution: (filters) => invoke('analytics:gradeDistribution', filters),
    atRisk: (filters) => invoke('analytics:atRisk', filters),
    exportAtRiskNotices: (payload) => invoke('analytics:exportAtRiskNotices', payload)
  },
  attendance: {
    save: (log) => invoke('attendance:save', log),
    delete: (payload) => invoke('attendance:delete', payload),
    dailyGrid: (filters) => invoke('attendance:dailyGrid', filters),
    monthlySummary: (filters) => invoke('attendance:monthlySummary', filters)
  },
  awards: {
    listHonorRoll: (classId) => invoke('awards:listHonorRoll', classId),
    generateCertificates: (classId) => invoke('awards:generateCertificates', classId)
  },
  history: {
    list: (studentId) => invoke('history:list', studentId),
    save: (record) => invoke('history:save', record),
    delete: (record) => invoke('history:delete', record)
  },
  sf10: {
    getDraft: (studentId) => invoke('sf10:getDraft', studentId),
    saveDraft: (payload) => invoke('sf10:saveDraft', payload)
  },
  forms: {
    exportSf5: (classId) => invoke('forms:exportSf5', classId),
    exportSf9Batch: (classId) => invoke('forms:exportSf9Batch', classId),
    exportSf10: (payload) => invoke('forms:exportSf10', payload),
    exportSf2: (payload) => invoke('forms:exportSf2', payload),
    generateSF5: (classId) => invoke('forms:exportSf5', classId),
    generateSF10: (studentIdOrPayload) => invoke('forms:exportSf10', studentIdOrPayload)
  },
  templates: {
    list: () => invoke('templates:list'),
    upload: (templateType) => invoke('templates:upload', templateType),
    validate: itAPI.validateTemplate
  },
  settings: {
    backupDatabase: () => invoke('settings:backupDatabase'),
    restoreDatabase: () => invoke('settings:restoreDatabase')
  }
});
