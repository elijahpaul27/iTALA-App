import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select } from '../ui';
import { sortAssessments } from './gradebookUtils';

const blankAssessment = {
  quarter: 1,
  type: 'WW',
  max_score: 10,
  name: ''
};

export function AssessmentManager({ selectedSubject, refreshTrigger, onDataChanged }) {
  const [assessments, setAssessments] = useState([]);
  const [form, setForm] = useState(blankAssessment);
  const [filters, setFilters] = useState({ quarter: 'all', type: 'all' });
  const [message, setMessage] = useState('');
  const isEditing = Boolean(form.id);

  useEffect(() => {
    refreshAssessments();
    setForm(blankAssessment);
    setMessage('');
  }, [selectedSubject?.id, refreshTrigger]);

  async function refreshAssessments() {
    if (!selectedSubject?.id) return;
    try {
      const rows = await api.assessments.list(selectedSubject.id, null);
      setAssessments(rows.sort(sortAssessments));
    } catch (error) {
      setMessage(error.message);
    }
  }

  const filteredAssessments = useMemo(() => {
    return assessments.filter((assessment) => {
      const quarterMatches = filters.quarter === 'all' || assessment.quarter === Number(filters.quarter);
      const typeMatches = filters.type === 'all' || assessment.type === filters.type;
      return quarterMatches && typeMatches;
    });
  }, [assessments, filters]);

  function updateForm(field, value) {
    setMessage('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveAssessment(event) {
    event.preventDefault();
    setMessage('');

    const payload = {
      ...form,
      subject_id: selectedSubject.id,
      quarter: Number(form.quarter),
      max_score: Number(form.max_score),
      name: String(form.name).trim()
    };

    if (!payload.name) {
      setMessage('Assessment name is required.');
      return;
    }

    if (!Number.isFinite(payload.max_score) || payload.max_score <= 0) {
      setMessage('Maximum score must be greater than zero.');
      return;
    }

    try {
      await api.assessments.save(payload);
      setForm(blankAssessment);
      await refreshAssessments();
      onDataChanged?.();
      setMessage(isEditing ? 'Assessment updated.' : 'Assessment created.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteAssessment(assessment) {
    const confirmed = window.confirm(`Delete ${assessment.name}? This removes all raw scores for this assessment and recalculates grades.`);
    if (!confirmed) return;

    const previous = assessments;
    setAssessments((current) => current.filter((row) => row.id !== assessment.id));
    setForm((current) => (current.id === assessment.id ? blankAssessment : current));
    setMessage('');

    try {
      await api.assessments.delete(assessment.id);
      await refreshAssessments();
      onDataChanged?.();
      setMessage('Assessment deleted.');
    } catch (error) {
      setAssessments(previous);
      setMessage(error.message);
    }
  }

  return (
    <section className="grid w-full min-w-0 gap-5 overflow-hidden xl:grid-cols-[420px_minmax(0,1fr)]">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit assessment' : 'Create assessment'}</CardTitle>
          <CardDescription>Setup assessments by quarter and component type.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={saveAssessment}>
            <Field label="Assessment Name">
              <Input value={form.name} onChange={(event) => updateForm('name', event.target.value)} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Quarter">
                <Select value={form.quarter} onChange={(event) => updateForm('quarter', Number(event.target.value))}>
                  <option value={1}>Q1</option>
                  <option value={2}>Q2</option>
                  <option value={3}>Q3</option>
                  <option value={4}>Q4</option>
                </Select>
              </Field>
              <Field label="Type">
                <Select value={form.type} onChange={(event) => updateForm('type', event.target.value)}>
                  <option value="WW">Written Work</option>
                  <option value="PT">Performance Task</option>
                  <option value="QA">Quarterly Assessment</option>
                </Select>
              </Field>
              <Field label="Max Score">
                <Input min="1" step="0.01" type="number" value={form.max_score} onChange={(event) => updateForm('max_score', event.target.value)} required />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit">{isEditing ? 'Update Assessment' : 'Add Assessment'}</Button>
              {isEditing ? (
                <Button variant="secondary" onClick={() => setForm(blankAssessment)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
          {message ? <p className="mt-4 rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground shadow-inset">{message}</p> : null}
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Assessment list</CardTitle>
              <CardDescription>Filter, edit, or delete assessment columns.</CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Quarter">
                <Select value={filters.quarter} onChange={(event) => setFilters((current) => ({ ...current, quarter: event.target.value }))}>
                  <option value="all">All</option>
                  <option value="1">Q1</option>
                  <option value="2">Q2</option>
                  <option value="3">Q3</option>
                  <option value="4">Q4</option>
                </Select>
              </Field>
              <Field label="Type">
                <Select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
                  <option value="all">All</option>
                  <option value="WW">WW</option>
                  <option value="PT">PT</option>
                  <option value="QA">QA</option>
                </Select>
              </Field>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid max-h-[520px] gap-2 overflow-y-auto pr-1">
            {filteredAssessments.map((assessment) => (
              <div className="rounded-xl border border-border p-3 text-sm shadow-inset" key={assessment.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{assessment.name}</p>
                    <p className="text-xs text-muted-foreground">Q{assessment.quarter} / {assessment.type} / {assessment.max_score} pts</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setForm(assessment)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => deleteAssessment(assessment)}>Delete</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filteredAssessments.length === 0 ? <p className="text-sm text-muted-foreground">No assessments match the current filters.</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
