import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Field } from '../ui';

const currentYear = new Date().getFullYear();
const blankRecord = {
  school_year: `${currentYear - 1}-${currentYear}`,
  grade_level: 'Grade 1',
  section: '',
  final_rating: '',
  action_taken: 'PROMOTED'
};

export function SF10HistoryForm({ selectedClass, students }) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(blankRecord);
  const [message, setMessage] = useState('');
  const isEditing = Boolean(form.student_id);

  useEffect(() => {
    setSelectedStudentId('');
    setRecords([]);
    setForm(blankRecord);
    setMessage('');
  }, [selectedClass?.id]);

  useEffect(() => {
    if (selectedStudentId) refreshRecords();
    else setRecords([]);
  }, [selectedStudentId]);

  async function refreshRecords() {
    setMessage('');
    try {
      setRecords(await api.history.list(Number(selectedStudentId)));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveRecord(event) {
    event.preventDefault();
    setMessage('');

    const finalRating = Number(form.final_rating);
    if (!Number.isFinite(finalRating) || finalRating < 0 || finalRating > 100) {
      setMessage('Final rating must be between 0 and 100.');
      return;
    }

    const payload = {
      ...form,
      student_id: Number(selectedStudentId),
      final_rating: finalRating
    };

    try {
      await api.history.save(payload);
      setForm(blankRecord);
      await refreshRecords();
      setMessage('Academic history saved.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteRecord(record) {
    const confirmed = window.confirm(`Delete ${record.grade_level} ${record.school_year} history?`);
    if (!confirmed) return;

    setMessage('');
    try {
      await api.history.delete(record);
      await refreshRecords();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!selectedClass) return null;

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">SF10 academic history</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <form onSubmit={saveRecord} className="grid gap-3">
          <Field label="Learner">
            <select className="rounded border px-3 py-2" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} required>
              <option value="">Select learner</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.last_name}, {student.first_name} - {student.lrn}
                </option>
              ))}
            </select>
          </Field>
          <Field label="School Year">
            <input className="rounded border px-3 py-2" placeholder="School year" value={form.school_year} onChange={(event) => setForm({ ...form, school_year: event.target.value })} required />
          </Field>
          <Field label="Grade Level">
            <input className="rounded border px-3 py-2" placeholder="Grade level" value={form.grade_level} onChange={(event) => setForm({ ...form, grade_level: event.target.value })} required />
          </Field>
          <Field label="Section">
            <input className="rounded border px-3 py-2" placeholder="Section" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} required />
          </Field>
          <Field label="Final Rating">
            <input className="rounded border px-3 py-2" max="100" min="0" placeholder="Final rating" step="0.01" type="number" value={form.final_rating} onChange={(event) => setForm({ ...form, final_rating: event.target.value })} required />
          </Field>
          <Field label="Action Taken">
            <select className="rounded border px-3 py-2" value={form.action_taken} onChange={(event) => setForm({ ...form, action_taken: event.target.value })}>
              <option value="PROMOTED">Promoted</option>
              <option value="RETAINED">Retained</option>
              <option value="TRANSFERRED OUT">Transferred out</option>
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <button className="rounded bg-blue-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!selectedStudentId} type="submit">
              {isEditing ? 'Update history' : 'Save history'}
            </button>
            {isEditing ? (
              <button className="rounded border px-4 py-2 font-medium text-slate-700" type="button" onClick={() => setForm(blankRecord)}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="overflow-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2">School Year</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Section</th>
                <th className="px-3 py-2">Final</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr className="border-t" key={`${record.student_id}-${record.school_year}-${record.grade_level}`}>
                  <td className="px-3 py-2">{record.school_year}</td>
                  <td className="px-3 py-2">{record.grade_level}</td>
                  <td className="px-3 py-2">{record.section}</td>
                  <td className="px-3 py-2">{record.final_rating}</td>
                  <td className="px-3 py-2">{record.action_taken}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded border px-2 py-1 text-xs font-medium text-slate-700" type="button" onClick={() => setForm(record)}>
                        Edit
                      </button>
                      <button className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700" type="button" onClick={() => deleteRecord(record)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 ? <p className="p-4 text-sm text-slate-500">No encoded history for this learner yet.</p> : null}
        </div>
      </div>
      {message ? <p className="mt-4 rounded border bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
