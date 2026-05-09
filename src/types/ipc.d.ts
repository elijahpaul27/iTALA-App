export type ClassSummary = {
  id: number;
  name: string;
  subject: string;
  year: string;
  teacherId: number;
};

export type Student = {
  id: number;
  class_id: number;
  lrn: string;
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  name_extn?: string | null;
  sex: 'M' | 'F';
  birthdate: string;
};

export type GradeRow = {
  gradeId: number | null;
  studentId: number;
  assessmentId: number;
  value: number | null;
  maxScore: number;
  assessmentName: string;
  assessmentType: 'WW' | 'PT' | 'QA';
  quarter: number;
};

export type GradeBatchUpdate = {
  studentId: number;
  assessmentId: number;
  value: number;
  userId?: number | null;
};

export type GradeBatchPayload = {
  classId: number;
  quarter: number;
  updates: GradeBatchUpdate[];
};

export type GradeBatchResult = {
  ok: boolean;
  failed: Array<{ index: number; studentId?: number; assessmentId?: number; reason: string }>;
};

export type TemplateValidationError = {
  row?: number;
  col?: string;
  message: string;
};

export type TemplateValidationResult = {
  ok: boolean;
  errors: TemplateValidationError[];
};

declare global {
  interface Window {
    itAPI: {
      getClasses(): Promise<ClassSummary[]>;
      getStudents(classId: number): Promise<Student[]>;
      getGrades(classId: number, quarter: number): Promise<GradeRow[]>;
      mutateGradesBatch(payload: GradeBatchPayload): Promise<GradeBatchResult>;
      importStudents(filePath: string): Promise<{ ok: boolean; errors: string[] }>;
      exportGrades(classId: number, quarter: number, templateId: string): Promise<{ ok: boolean; path: string; errors?: TemplateValidationError[] }>;
      validateTemplate(filePath: string): Promise<TemplateValidationResult>;
      onGradesChanged(cb: () => void): () => void;
    };
  }
}

export {};
