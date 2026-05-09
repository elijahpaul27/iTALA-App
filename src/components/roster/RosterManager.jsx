import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Field } from '../ui';

const blankStudent = {
  lrn: '',
  last_name: '',
  first_name: '',
  middle_name: '',
  name_extn: '',
  sex: 'F',
  birthdate: '',
  eligibility_credential: ''
};

export function RosterManager({ selectedClass }) {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(blankStudent);
  const [error, setError] = useState('');
  const [importReport, setImportReport] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const isEditing = Boolean(form.id);

  useEffect(() => {
    if (selectedClass) refreshStudents();
    else setStudents([]);
    setForm(blankStudent);
    setError('');
    setImportReport(null);
  }, [selectedClass?.id]);

  async function refreshStudents() {
    setStudents(await api.students.list(selectedClass.id));
  }

  function updateForm(field, value) {
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveStudent(event) {
    event.preventDefault();

    if (!/^\d{12}$/.test(form.lrn)) {
      setError('LRN must contain exactly 12 digits.');
      return;
    }

    const payload = { ...form, class_id: selectedClass.id };
    try {
      const result = await api.students.save(payload);
      const saved = { ...payload, id: payload.id ?? result.id };

      setStudents((current) => {
        if (payload.id) {
          return current.map((student) => (student.id === payload.id ? saved : student));
        }
        return [...current, saved];
      });
      setForm(blankStudent);
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function deleteStudent(student) {
    const confirmed = window.confirm(`Delete ${student.last_name}, ${student.first_name}? This also removes the learner's grades, attendance logs, and academic history.`);
    if (!confirmed) return;

    setError('');
    try {
      await api.students.delete(student.id);
      setStudents((current) => current.filter((row) => row.id !== student.id));

      if (form.id === student.id) {
        setForm(blankStudent);
      }
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function importRoster() {
    setError('');
    setImportReport(null);
    setIsImporting(true);
    try {
      const report = await api.students.importCsv(selectedClass.id);
      if (report?.canceled) {
        setImportReport({ imported: 0, skipped: 0, errors: ['Import canceled.'] });
      } else {
        setImportReport(report);
        await refreshStudents();
      }
    } catch (importError) {
      setError(importError.message);
    } finally {
      setIsImporting(false);
    }
  }

  if (!selectedClass) return <EmptyState text="Select or create a class before adding learners." />;

  return (
    <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <form onSubmit={saveStudent} className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">{isEditing ? 'Edit learner' : 'Add learner'}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="LRN">
            <input
              className="rounded border px-3 py-2"
              inputMode="numeric"
              maxLength={12}
              pattern="\d{12}"
              placeholder="12-digit LRN"
              value={form.lrn}
              onChange={(event) => updateForm('lrn', event.target.value.replace(/\D/g, '').slice(0, 12))}
              required
            />
          </Field>
          <Field label="Sex">
            <select className="rounded border px-3 py-2" value={form.sex} onChange={(event) => updateForm('sex', event.target.value)}>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </Field>
          <Field label="Last Name">
            <input className="rounded border px-3 py-2" placeholder="Last name" value={form.last_name} onChange={(event) => updateForm('last_name', event.target.value)} required />
          </Field>
          <Field label="First Name">
            <input className="rounded border px-3 py-2" placeholder="First name" value={form.first_name} onChange={(event) => updateForm('first_name', event.target.value)} required />
          </Field>
          <Field label="Middle Name">
            <input className="rounded border px-3 py-2" placeholder="Middle name" value={form.middle_name} onChange={(event) => updateForm('middle_name', event.target.value)} />
          </Field>
          <Field label="Extension">
            <input className="rounded border px-3 py-2" placeholder="Extension" value={form.name_extn} onChange={(event) => updateForm('name_extn', event.target.value)} />
          </Field>
          <Field label="Birthdate">
            <input className="rounded border px-3 py-2" type="date" value={form.birthdate} onChange={(event) => updateForm('birthdate', event.target.value)} required />
          </Field>
          <Field label="Eligibility Credential">
            <input className="rounded border px-3 py-2" placeholder="Eligibility credential" value={form.eligibility_credential} onChange={(event) => updateForm('eligibility_credential', event.target.value)} />
          </Field>
        </div>
        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded bg-blue-700 px-4 py-2 font-medium text-white" type="submit">
            {isEditing ? 'Update learner' : 'Save learner'}
          </button>
          {isEditing ? (
            <button className="rounded border px-4 py-2 font-medium text-slate-700" type="button" onClick={() => setForm(blankStudent)}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="grid gap-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Roster import</h2>
              <p className="text-sm text-slate-500">Accepts standard DepEd LIS CSV headers such as LRN, Last Name, First Name, Middle Name, Sex, and Birth Date.</p>
            </div>
            <button className="rounded bg-blue-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={isImporting} type="button" onClick={importRoster}>
              {isImporting ? 'Importing...' : 'Import CSV'}
            </button>
          </div>
          {importReport ? (
            <div className="mt-3 rounded border bg-slate-50 p-3 text-sm text-slate-700">
              <p>Imported {importReport.imported} learner{importReport.imported === 1 ? '' : 's'}; skipped {importReport.skipped}.</p>
              {importReport.errors?.length ? (
                <ul className="mt-2 list-disc pl-5 text-red-700">
                  {importReport.errors.slice(0, 8).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2">LRN</th>
                <th className="px-3 py-2">Learner</th>
                <th className="px-3 py-2">Sex</th>
                <th className="px-3 py-2">Birthdate</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr className="border-t" key={student.id}>
                  <td className="px-3 py-2">{student.lrn}</td>
                  <td className="px-3 py-2">{student.last_name}, {student.first_name} {student.middle_name}</td>
                  <td className="px-3 py-2">{student.sex}</td>
                  <td className="px-3 py-2">{student.birthdate}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded border px-2 py-1 text-xs font-medium text-slate-700" type="button" onClick={() => setForm(student)}>
                        Edit
                      </button>
                      <button className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700" type="button" onClick={() => deleteStudent(student)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {students.length === 0 ? <p className="p-4 text-sm text-slate-500">No learners in this class yet.</p> : null}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-lg border bg-white p-6 text-sm text-slate-500 shadow-sm">{text}</div>;
}
