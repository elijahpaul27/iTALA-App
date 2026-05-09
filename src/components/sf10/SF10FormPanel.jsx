import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select } from '../ui';

const eligibilityOptions = [
  { id: 'kinder_progress_report', label: 'Kinder Progress Report' },
  { id: 'eccd_checklist', label: 'ECCD Checklist' },
  { id: 'kindergarten_certificate', label: 'Kindergarten Certificate of Completion' },
  { id: 'pept_passer', label: 'PEPT Passer Rating' },
  { id: 'als_ae', label: 'ALS A&E' },
  { id: 'other', label: 'Others' }
];

const defaultSubjects = [
  'Filipino',
  'English',
  'Mathematics',
  'Science',
  'GMRC',
  'Araling Panlipunan',
  'EPP/TLE',
  'MAPEH'
];

const blankScholasticRecord = {
  id: '',
  school_year: '',
  grade_level: 'Grade 1',
  section: '',
  adviser: '',
  school_name: '',
  school_id: '',
  subjects: defaultSubjects.map((name) => ({ name, q1: '', q2: '', q3: '', q4: '', final_rating: '', remarks: '' })),
  general_average: '',
  action_taken: 'PROMOTED'
};

function fullName(student) {
  if (!student) return '';
  return [student.last_name, student.first_name, student.middle_name, student.name_extn].filter(Boolean).join(' ');
}

function studentToPersonalInfo(student) {
  return {
    id: student?.id ?? '',
    class_id: student?.class_id ?? '',
    lrn: student?.lrn ?? '',
    last_name: student?.last_name ?? '',
    first_name: student?.first_name ?? '',
    middle_name: student?.middle_name ?? '',
    name_extn: student?.name_extn ?? '',
    sex: student?.sex ?? 'F',
    birthdate: student?.birthdate ?? ''
  };
}

function eligibilityFromDraft(draftEligibility = {}, selectedClass) {
  return {
    credential: draftEligibility.credential || 'kinder_progress_report',
    school_name: draftEligibility.school_name || selectedClass?.school_name || '',
    school_id: draftEligibility.school_id || selectedClass?.school_id || '',
    school_address: draftEligibility.school_address || '',
    pept_rating: draftEligibility.pept_rating ?? '',
    assessment_date: draftEligibility.assessment_date || '',
    testing_center: draftEligibility.testing_center || '',
    als_rating: draftEligibility.als_rating ?? '',
    other_credential: draftEligibility.other_credential || '',
    remarks: draftEligibility.remarks || ''
  };
}

function recordFromDraft(row, selectedClass) {
  return createScholasticRecord({
    id: `${row.student_id}-${row.school_year}-${row.grade_level}`,
    school_year: row.school_year,
    grade_level: row.grade_level,
    section: row.section,
    adviser: row.adviser ?? '',
    school_name: row.school_name ?? selectedClass?.school_name ?? '',
    school_id: row.school_id ?? selectedClass?.school_id ?? '',
    final_rating: row.final_rating ?? '',
    general_average: row.general_average ?? row.final_rating ?? '',
    action_taken: row.action_taken ?? 'PROMOTED',
    subjects: Array.isArray(row.subjects) && row.subjects.length > 0
      ? row.subjects.map((subject) => ({
        name: subject.name ?? '',
        q1: subject.q1 ?? '',
        q2: subject.q2 ?? '',
        q3: subject.q3 ?? '',
        q4: subject.q4 ?? '',
        final_rating: subject.final_rating ?? '',
        remarks: subject.remarks ?? ''
      }))
      : undefined
  });
}

function createScholasticRecord(seed = {}) {
  return {
    ...blankScholasticRecord,
    ...seed,
    id: seed.id ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    subjects: seed.subjects ?? blankScholasticRecord.subjects.map((subject) => ({ ...subject }))
  };
}

export function SF10FormPanel({ selectedClass, students, selectedStudentId, onSelectStudent, onExport, onSaved }) {
  const [personalInfo, setPersonalInfo] = useState(studentToPersonalInfo(null));
  const [eligibility, setEligibility] = useState({
    credential: 'kinder_progress_report',
    school_name: '',
    school_id: '',
    school_address: '',
    pept_rating: '',
    assessment_date: '',
    testing_center: '',
    als_rating: '',
    other_credential: '',
    remarks: ''
  });
  const [records, setRecords] = useState([createScholasticRecord()]);
  const [message, setMessage] = useState('');
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === Number(selectedStudentId)) ?? null,
    [students, selectedStudentId]
  );

  useEffect(() => {
    if (!selectedStudent) {
      setPersonalInfo(studentToPersonalInfo(null));
      setEligibility(eligibilityFromDraft({}, selectedClass));
      setRecords([createScholasticRecord()]);
      return;
    }

    loadDraft(selectedStudent.id);
  }, [selectedStudent?.id]);

  async function loadDraft(studentId) {
    setIsLoadingDraft(true);
    setMessage('');
    try {
      const draft = await api.sf10.getDraft(studentId);
      setPersonalInfo(studentToPersonalInfo(draft.student ?? selectedStudent));
      setEligibility(eligibilityFromDraft(draft.eligibility, selectedClass));

      if (!draft.records || draft.records.length === 0) {
        setRecords([
          createScholasticRecord({
            school_year: selectedClass?.school_year ?? '',
            grade_level: selectedClass?.grade_level ?? 'Grade 1',
            section: selectedClass?.section ?? '',
            school_name: selectedClass?.school_name ?? '',
            school_id: selectedClass?.school_id ?? ''
          })
        ]);
        return;
      }

      setRecords(draft.records.map((row) => recordFromDraft(row, selectedClass)));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoadingDraft(false);
    }
  }

  async function saveDraft({ silent = false } = {}) {
    if (!selectedStudent) return null;
    setIsSaving(true);
    if (!silent) setMessage('');

    try {
      const result = await api.sf10.saveDraft({ personalInfo, eligibility, records });
      await onSaved?.();
      if (!silent) setMessage(`SF10 draft saved. ${result.savedRecords} scholastic record(s) stored.`);
      return result;
    } catch (error) {
      setMessage(error.message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveThenExport() {
    await saveDraft({ silent: true });
    await onExport?.(Number(selectedStudentId));
    setMessage('SF10 draft saved and export started.');
  }

  function updatePersonal(field, value) {
    setPersonalInfo((current) => ({ ...current, [field]: value }));
  }

  function updateEligibility(field, value) {
    setEligibility((current) => ({ ...current, [field]: value }));
  }

  function updateRecord(recordId, field, value) {
    setRecords((current) => current.map((record) => (record.id === recordId ? { ...record, [field]: value } : record)));
  }

  function updateSubject(recordId, subjectIndex, field, value) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        const subjects = record.subjects.map((subject, index) => (index === subjectIndex ? { ...subject, [field]: value } : subject));
        return { ...record, subjects };
      })
    );
  }

  function addRecord() {
    setRecords((current) => [...current, createScholasticRecord()]);
  }

  function deleteRecord(recordId) {
    setRecords((current) => (current.length === 1 ? current : current.filter((record) => record.id !== recordId)));
  }

  if (!selectedClass) return null;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>SF10 Interactive Form</CardTitle>
        <CardDescription>Fill out the permanent record digitally before exporting the official workbook.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,360px)_1fr]">
          <Field label="Learner">
            <Select value={selectedStudentId} onChange={(event) => onSelectStudent(event.target.value)}>
              <option value="">Select learner</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.last_name}, {student.first_name} - {student.lrn}
                </option>
              ))}
            </Select>
          </Field>
          <div className="rounded-2xl p-4 shadow-inset">
            <p className="text-sm font-medium">{isLoadingDraft ? 'Loading SF10 draft...' : selectedStudent ? fullName(selectedStudent) : 'No learner selected'}</p>
            <p className="text-xs text-muted-foreground">{selectedClass.grade_level} - {selectedClass.section} / {selectedClass.school_year}</p>
          </div>
        </div>

        <section className="grid gap-4 rounded-2xl border border-border p-4 shadow-inset">
          <div>
            <h3 className="font-medium">Learner Personal Info</h3>
            <p className="text-sm text-muted-foreground">Auto-filled from the roster and editable for SF10 preparation.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="LRN"><Input value={personalInfo.lrn} onChange={(event) => updatePersonal('lrn', event.target.value)} /></Field>
            <Field label="Last Name"><Input value={personalInfo.last_name} onChange={(event) => updatePersonal('last_name', event.target.value)} /></Field>
            <Field label="First Name"><Input value={personalInfo.first_name} onChange={(event) => updatePersonal('first_name', event.target.value)} /></Field>
            <Field label="Middle Name"><Input value={personalInfo.middle_name} onChange={(event) => updatePersonal('middle_name', event.target.value)} /></Field>
            <Field label="Name Extension"><Input value={personalInfo.name_extn} onChange={(event) => updatePersonal('name_extn', event.target.value)} /></Field>
            <Field label="Birthdate"><Input type="date" value={personalInfo.birthdate} onChange={(event) => updatePersonal('birthdate', event.target.value)} /></Field>
            <Field label="Sex">
              <Select value={personalInfo.sex} onChange={(event) => updatePersonal('sex', event.target.value)}>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </Select>
            </Field>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-border p-4 shadow-inset">
          <div>
            <h3 className="font-medium">Eligibility for Grade 1</h3>
            <p className="text-sm text-muted-foreground">Choose the credential and encode supporting school or assessment details.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {eligibilityOptions.map((option) => (
              <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-raised" key={option.id}>
                <input
                  checked={eligibility.credential === option.id}
                  name="sf10-eligibility"
                  type="radio"
                  value={option.id}
                  onChange={(event) => updateEligibility('credential', event.target.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Name of School"><Input value={eligibility.school_name} onChange={(event) => updateEligibility('school_name', event.target.value)} /></Field>
            <Field label="School ID"><Input value={eligibility.school_id} onChange={(event) => updateEligibility('school_id', event.target.value)} /></Field>
            <Field label="Address of School"><Input value={eligibility.school_address} onChange={(event) => updateEligibility('school_address', event.target.value)} /></Field>
            <Field label="PEPT Rating"><Input value={eligibility.pept_rating} onChange={(event) => updateEligibility('pept_rating', event.target.value)} /></Field>
            <Field label="ALS A&E Rating"><Input value={eligibility.als_rating} onChange={(event) => updateEligibility('als_rating', event.target.value)} /></Field>
            <Field label="Assessment Date"><Input type="date" value={eligibility.assessment_date} onChange={(event) => updateEligibility('assessment_date', event.target.value)} /></Field>
            <Field label="Testing Center"><Input value={eligibility.testing_center} onChange={(event) => updateEligibility('testing_center', event.target.value)} /></Field>
            <Field label="Other Credential"><Input value={eligibility.other_credential} onChange={(event) => updateEligibility('other_credential', event.target.value)} /></Field>
            <Field label="Remarks"><Input value={eligibility.remarks} onChange={(event) => updateEligibility('remarks', event.target.value)} /></Field>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-border p-4 shadow-inset">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">Scholastic Record History</h3>
              <p className="text-sm text-muted-foreground">Add past grade levels, advisers, subject ratings, final averages, and actions.</p>
            </div>
            <Button variant="secondary" onClick={addRecord}>
              <Plus className="h-4 w-4" />
              Add Record
            </Button>
          </div>

          <div className="grid gap-4">
            {records.map((record, recordIndex) => (
              <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-raised" key={record.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-medium">Record {recordIndex + 1}</p>
                  <Button size="sm" variant="secondary" disabled={records.length === 1} onClick={() => deleteRecord(record.id)}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="School Year"><Input value={record.school_year} onChange={(event) => updateRecord(record.id, 'school_year', event.target.value)} /></Field>
                  <Field label="Grade Level"><Input value={record.grade_level} onChange={(event) => updateRecord(record.id, 'grade_level', event.target.value)} /></Field>
                  <Field label="Section"><Input value={record.section} onChange={(event) => updateRecord(record.id, 'section', event.target.value)} /></Field>
                  <Field label="Adviser"><Input value={record.adviser} onChange={(event) => updateRecord(record.id, 'adviser', event.target.value)} /></Field>
                  <Field label="School Name"><Input value={record.school_name} onChange={(event) => updateRecord(record.id, 'school_name', event.target.value)} /></Field>
                  <Field label="School ID"><Input value={record.school_id} onChange={(event) => updateRecord(record.id, 'school_id', event.target.value)} /></Field>
                  <Field label="General Average"><Input type="number" value={record.general_average} onChange={(event) => updateRecord(record.id, 'general_average', event.target.value)} /></Field>
                  <Field label="Action Taken">
                    <Select value={record.action_taken} onChange={(event) => updateRecord(record.id, 'action_taken', event.target.value)}>
                      <option value="PROMOTED">Promoted</option>
                      <option value="RETAINED">Retained</option>
                      <option value="TRANSFERRED OUT">Transferred Out</option>
                    </Select>
                  </Field>
                </div>
                <div className="w-full overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead className="bg-muted/70 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Learning Area</th>
                        <th className="px-2 py-2">Q1</th>
                        <th className="px-2 py-2">Q2</th>
                        <th className="px-2 py-2">Q3</th>
                        <th className="px-2 py-2">Q4</th>
                        <th className="px-2 py-2">Final</th>
                        <th className="px-3 py-2">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.subjects.map((subject, subjectIndex) => (
                        <tr className="border-t border-border" key={`${record.id}-${subjectIndex}`}>
                          <td className="px-3 py-2">
                            <Input className="h-9" value={subject.name} onChange={(event) => updateSubject(record.id, subjectIndex, 'name', event.target.value)} />
                          </td>
                          {['q1', 'q2', 'q3', 'q4', 'final_rating'].map((field) => (
                            <td className="px-2 py-2" key={field}>
                              <Input className="h-9 text-center" type="number" value={subject[field]} onChange={(event) => updateSubject(record.id, subjectIndex, field, event.target.value)} />
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <Input className="h-9" value={subject.remarks} onChange={(event) => updateSubject(record.id, subjectIndex, 'remarks', event.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 shadow-inset">
          <p className="text-sm text-muted-foreground">SF10 personal info, Grade 1 eligibility, and scholastic history are saved locally before export.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!selectedStudentId || isSaving || isLoadingDraft} onClick={() => saveDraft()}>
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button disabled={!selectedStudentId || isSaving || isLoadingDraft} onClick={saveThenExport}>
              Save & Export SF10
            </Button>
          </div>
        </div>

        {message ? <p className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground shadow-inset">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
