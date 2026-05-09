import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Field } from '../ui';

const currentYear = new Date().getFullYear();
const blankClass = {
  grade_level: 'Grade 1',
  section: '',
  school_year: `${currentYear}-${currentYear + 1}`,
  curriculum: 'MATATAG'
};

export function ClassManager({ teacher, selectedClass, onSelectClass }) {
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(blankClass);
  const [error, setError] = useState('');
  const [standardWeights, setStandardWeights] = useState(true);
  const [templateMessage, setTemplateMessage] = useState('');
  const isEditing = Boolean(form.id);

  useEffect(() => {
    refreshClasses();
  }, [teacher.id]);

  async function refreshClasses() {
    const rows = await api.classes.list(teacher.id);
    setClasses(rows);
    if (!selectedClass && rows[0]) onSelectClass(rows[0]);
  }

  async function saveClass(event) {
    event.preventDefault();
    setError('');
    const payload = { ...form, teacher_id: teacher.id };

    try {
      const result = await api.classes.save(payload);
      const saved = { ...payload, id: payload.id ?? result.id };

      setClasses((current) => {
        if (payload.id) {
          return current.map((classRecord) => (classRecord.id === payload.id ? saved : classRecord));
        }
        return [saved, ...current];
      });
      onSelectClass(saved);
      if (standardWeights) {
        const applyResult = await api.classes.applyStandardWeights(saved.id);
        setTemplateMessage(`Applied ${applyResult.count} DepEd standard subject weight templates.`);
      } else {
        setTemplateMessage('');
      }
      setForm(blankClass);
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function applyTemplatesToSelected() {
    if (!selectedClass?.id) return;
    setError('');
    try {
      const result = await api.classes.applyStandardWeights(selectedClass.id);
      setTemplateMessage(`Applied ${result.count} DepEd standard subject weight templates to ${selectedClass.grade_level} - ${selectedClass.section}.`);
    } catch (applyError) {
      setError(applyError.message);
    }
  }

  async function deleteClass(classRecord) {
    const confirmed = window.confirm(`Delete ${classRecord.grade_level} - ${classRecord.section}? This also removes its learners, subjects, assessments, grades, and attendance logs.`);
    if (!confirmed) return;

    setError('');
    try {
      await api.classes.delete(classRecord.id);
      const remaining = classes.filter((current) => current.id !== classRecord.id);
      setClasses(remaining);

      if (selectedClass?.id === classRecord.id) {
        onSelectClass(remaining[0] ?? null);
      }

      if (form.id === classRecord.id) {
        setForm(blankClass);
      }
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <form onSubmit={saveClass} className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">{isEditing ? 'Edit class' : 'Class setup'}</h2>
        <div className="mt-4 grid gap-3">
          <Field label="Grade Level">
            <input className="rounded border px-3 py-2" value={form.grade_level} onChange={(event) => setForm({ ...form, grade_level: event.target.value })} required />
          </Field>
          <Field label="Section">
            <input className="rounded border px-3 py-2" placeholder="Section" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} required />
          </Field>
          <Field label="School Year">
            <input className="rounded border px-3 py-2" value={form.school_year} onChange={(event) => setForm({ ...form, school_year: event.target.value })} required />
          </Field>
          <Field label="Curriculum">
            <input className="rounded border px-3 py-2" value={form.curriculum} onChange={(event) => setForm({ ...form, curriculum: event.target.value })} required />
          </Field>
          <label className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-inset">
            <input checked={standardWeights} type="checkbox" onChange={(event) => setStandardWeights(event.target.checked)} />
            Apply DepEd Standard Weights
          </label>
        </div>
        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
        {templateMessage ? <p className="mt-3 rounded-xl border border-border bg-slate-50 p-3 text-sm text-slate-700">{templateMessage}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded bg-blue-700 px-4 py-2 font-medium text-white" type="submit">
            {isEditing ? 'Update class' : 'Save class'}
          </button>
          {isEditing ? (
            <button className="rounded border px-4 py-2 font-medium text-slate-700" type="button" onClick={() => setForm(blankClass)}>
              Cancel
            </button>
          ) : null}
          {selectedClass ? (
            <button className="rounded border px-4 py-2 font-medium text-slate-700" type="button" onClick={applyTemplatesToSelected}>
              Apply weights now
            </button>
          ) : null}
        </div>
      </form>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Classes</h2>
        <div className="mt-4 grid gap-2">
          {classes.map((classRecord) => (
            <div
              className={`rounded border px-3 py-2 ${selectedClass?.id === classRecord.id ? 'border-blue-700 bg-blue-50' : 'bg-white'}`}
              key={classRecord.id}
            >
              <button className="w-full text-left" onClick={() => onSelectClass(classRecord)} type="button">
                <span className="font-medium">{classRecord.grade_level} - {classRecord.section}</span>
                <span className="block text-sm text-slate-500">{classRecord.school_year} - {classRecord.curriculum}</span>
              </button>
              <div className="mt-2 flex gap-2">
                <button className="rounded border px-2 py-1 text-xs font-medium text-slate-700" type="button" onClick={() => setForm(classRecord)}>
                  Edit
                </button>
                <button className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700" type="button" onClick={() => deleteClass(classRecord)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {classes.length === 0 ? <p className="text-sm text-slate-500">No classes yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
