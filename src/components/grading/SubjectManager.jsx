import { Edit3, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field } from '../ui';

const blankSubject = {
  name: '',
  written_work_weight: 0.3,
  perf_task_weight: 0.5,
  quarterly_weight: 0.2
};

export function SubjectManager({ selectedClass, selectedSubject, onSelectSubject }) {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(blankSubject);
  const [editingSubject, setEditingSubject] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (selectedClass) refreshSubjects();
    else setSubjects([]);
  }, [selectedClass?.id]);

  async function refreshSubjects() {
    setMessage('');
    try {
      const rows = await api.subjects.list(selectedClass.id);
      setSubjects(rows);
      if (!selectedSubject && rows[0]) onSelectSubject(rows[0]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function normalizePayload(subject) {
    return {
      ...subject,
      class_id: selectedClass.id,
      name: String(subject.name ?? '').trim(),
      written_work_weight: Number(subject.written_work_weight),
      perf_task_weight: Number(subject.perf_task_weight),
      quarterly_weight: Number(subject.quarterly_weight)
    };
  }

  function validateSubject(subject) {
    if (!subject.name) return 'Subject name is required.';
    const total = subject.written_work_weight + subject.perf_task_weight + subject.quarterly_weight;
    if (![subject.written_work_weight, subject.perf_task_weight, subject.quarterly_weight].every(Number.isFinite)) {
      return 'Weights must be valid numbers.';
    }
    if (Math.abs(total - 1) > 0.0001) return 'Subject weights must total 1.00.';
    return '';
  }

  async function saveSubject(event) {
    event.preventDefault();
    const payload = normalizePayload(form);
    const validationError = validateSubject(payload);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    try {
      const result = await api.subjects.save(payload);
      const created = { ...payload, id: result.id };
      setSubjects((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      onSelectSubject(created);
      setForm(blankSubject);
      setMessage('Subject created.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveEditedSubject(event) {
    event.preventDefault();
    const payload = normalizePayload(editingSubject);
    const validationError = validateSubject(payload);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    try {
      await api.subjects.save(payload);
      setSubjects((current) => current.map((subject) => (subject.id === payload.id ? payload : subject)).sort((a, b) => a.name.localeCompare(b.name)));
      if (selectedSubject?.id === payload.id) onSelectSubject(payload);
      setEditingSubject(null);
      setMessage('Subject updated.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteSubject(subject) {
    const confirmed = window.confirm(`Delete ${subject.name}? This also removes its assessments and grades.`);
    if (!confirmed) return;

    try {
      await api.subjects.delete(subject.id);
      const remaining = subjects.filter((current) => current.id !== subject.id);
      setSubjects(remaining);
      if (selectedSubject?.id === subject.id) onSelectSubject(remaining[0] ?? null);
      setMessage('Subject deleted.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!selectedClass) return <Card className="p-6 text-sm text-muted-foreground">Select a class before creating subjects.</Card>;

  return (
    <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Subject weights</CardTitle>
          <CardDescription>Weights must total 1.00.</CardDescription>
        </CardHeader>
        <CardContent>
          <SubjectForm form={form} onChange={setForm} onSubmit={saveSubject} submitLabel="Save Subject" />
          {message ? <p className="mt-4 rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground shadow-inset">{message}</p> : null}
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Subjects</CardTitle>
          <CardDescription>Edit, delete, or select the active subject.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {subjects.map((subject) => {
              const isSelected = selectedSubject?.id === subject.id;
              return (
                <div
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 shadow-inset ${isSelected ? 'border-primary/50 bg-blue-50/70' : 'border-border bg-card'}`}
                  key={subject.id}
                >
                  <button className="min-w-0 flex-1 text-left" onClick={() => onSelectSubject(subject)} type="button">
                    <span className="block truncate font-medium">{subject.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      WW {Math.round(subject.written_work_weight * 100)}% / PT {Math.round(subject.perf_task_weight * 100)}% / QA {Math.round(subject.quarterly_weight * 100)}%
                    </span>
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Button size="icon" variant="secondary" aria-label={`Edit ${subject.name}`} title="Edit subject" onClick={() => setEditingSubject(subject)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="secondary" className="text-red-700 hover:text-red-700" aria-label={`Delete ${subject.name}`} title="Delete subject" onClick={() => deleteSubject(subject)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {subjects.length === 0 ? <p className="text-sm text-muted-foreground">No subjects yet.</p> : null}
          </div>
        </CardContent>
      </Card>

      {editingSubject ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Edit Subject</CardTitle>
                  <CardDescription>Update subject weights and name.</CardDescription>
                </div>
                <Button size="icon" variant="ghost" aria-label="Close edit subject modal" onClick={() => setEditingSubject(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <SubjectForm form={editingSubject} onChange={setEditingSubject} onSubmit={saveEditedSubject} submitLabel="Update Subject" />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}

function SubjectForm({ form, onChange, onSubmit, submitLabel }) {
  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <Field label="Subject Name">
        <input className="rounded-xl border border-border bg-input-background px-3 py-2 shadow-inset outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} required />
      </Field>
      <WeightInput label="Written work" value={form.written_work_weight} onChange={(value) => onChange({ ...form, written_work_weight: value })} />
      <WeightInput label="Performance task" value={form.perf_task_weight} onChange={(value) => onChange({ ...form, perf_task_weight: value })} />
      <WeightInput label="Quarterly assessment" value={form.quarterly_weight} onChange={(value) => onChange({ ...form, quarterly_weight: value })} />
      <Button className="mt-1" type="submit">{submitLabel}</Button>
    </form>
  );
}

function WeightInput({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input className="rounded-xl border border-border bg-input-background px-3 py-2 shadow-inset outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20" max="1" min="0" step="0.05" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
