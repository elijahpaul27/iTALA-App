import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Button, Card, CardContent, Field, Input, Select, cn } from '../ui';
import { AssessmentManager } from './AssessmentManager';
import { RawScoreGrid } from './RawScoreGrid';

const GradebookInsightsPanel = lazy(() =>
  import('./InsightsPanel').then((module) => ({ default: module.GradebookInsightsPanel }))
);

const gradebookTabs = [
  { id: 'setup', label: 'Setup Assessments' },
  { id: 'q1', label: 'Q1 Scores', quarter: 1 },
  { id: 'q2', label: 'Q2 Scores', quarter: 2 },
  { id: 'q3', label: 'Q3 Scores', quarter: 3 },
  { id: 'q4', label: 'Q4 Scores', quarter: 4 },
  { id: 'analytics', label: 'Analytics & Summary' }
];

export function Gradebook({
  teacher,
  selectedClass,
  selectedSubject,
  spreadsheetMode,
  onToggleSpreadsheetMode,
  onSelectClass,
  onSelectSubject
}) {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [activeTab, setActiveTab] = useState('setup');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!teacher?.id) {
      setClasses([]);
      return;
    }

    let ignore = false;
    api.classes.list(teacher.id)
      .then((rows) => {
        if (ignore) return;
        setClasses(rows);
        if (!selectedClass && rows[0]) onSelectClass?.(rows[0]);
      })
      .catch((error) => setMessage(error.message));

    return () => {
      ignore = true;
    };
  }, [teacher?.id]);

  useEffect(() => {
    if (!api.grades.onChanged) return undefined;
    try {
      return api.grades.onChanged(() => notifyDataChanged());
    } catch (_error) {
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!selectedClass?.id) {
      setSubjects([]);
      return;
    }

    let ignore = false;
    api.subjects.list(selectedClass.id)
      .then((rows) => {
        if (ignore) return;
        setSubjects(rows);
        if (!selectedSubject && rows[0]) onSelectSubject?.(rows[0]);
      })
      .catch((error) => setMessage(error.message));

    return () => {
      ignore = true;
    };
  }, [selectedClass?.id]);

  function handleClassChange(classId) {
    const nextClass = classes.find((classRecord) => classRecord.id === Number(classId)) ?? null;
    onSelectClass?.(nextClass);
    onSelectSubject?.(null);
    setActiveTab('setup');
  }

  function handleSubjectChange(subjectId) {
    const nextSubject = subjects.find((subject) => subject.id === Number(subjectId)) ?? null;
    onSelectSubject?.(nextSubject);
    setActiveTab('setup');
  }

  function notifyDataChanged() {
    setRefreshTrigger((current) => current + 1);
  }

  const activeQuarter = useMemo(
    () => gradebookTabs.find((tab) => tab.id === activeTab)?.quarter ?? null,
    [activeTab]
  );

  if (!teacher) {
    return <Card className="p-6 text-sm text-muted-foreground">Unlock a teacher profile before opening the gradebook.</Card>;
  }

  return (
    <section className={`grid w-full min-w-0 gap-5 overflow-hidden ${spreadsheetMode ? 'itala-spreadsheet-mode' : ''}`}>
      <Card className="w-full min-w-0 overflow-hidden">
        <CardContent className="grid gap-4 p-4 sm:p-5">
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,0.8fr)]">
            <Field label="Class">
              <Select value={selectedClass?.id ?? ''} onChange={(event) => handleClassChange(event.target.value)}>
                <option value="">Select class</option>
                {classes.map((classRecord) => (
                  <option key={classRecord.id} value={classRecord.id}>
                    {classRecord.grade_level} - {classRecord.section} / {classRecord.school_year}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject">
              <Select disabled={!selectedClass} value={selectedSubject?.id ?? ''} onChange={(event) => handleSubjectChange(event.target.value)}>
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Search">
              <Input
                type="search"
                placeholder="Filter learners or assessments"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </Field>
          </div>

          <nav className="w-full overflow-x-auto rounded-2xl p-2 shadow-inset">
            <div className="flex min-w-max items-center gap-2">
              {gradebookTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <Button
                    key={tab.id}
                    size="sm"
                    variant={isActive ? 'primary' : 'secondary'}
                    className={cn('whitespace-nowrap', isActive ? 'shadow-active' : '')}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </Button>
                );
              })}
              <Button size="sm" variant={spreadsheetMode ? 'primary' : 'secondary'} className="whitespace-nowrap" onClick={onToggleSpreadsheetMode}>
                Spreadsheet Mode
              </Button>
            </div>
          </nav>
        </CardContent>
      </Card>

      {message ? <p className="rounded-xl border border-border bg-background p-3 text-sm text-destructive shadow-inset">{message}</p> : null}

      {!selectedClass || !selectedSubject ? (
        <Card className="p-6 text-sm text-muted-foreground">Select a class and subject to continue.</Card>
      ) : null}

      {selectedClass && selectedSubject && activeTab === 'setup' ? (
        <AssessmentManager
          selectedSubject={selectedSubject}
          refreshTrigger={refreshTrigger}
          onDataChanged={notifyDataChanged}
        />
      ) : null}

      {selectedClass && selectedSubject && activeQuarter ? (
        <RawScoreGrid
          quarter={activeQuarter}
          searchQuery={searchQuery}
          selectedClass={selectedClass}
          selectedSubject={selectedSubject}
          refreshTrigger={refreshTrigger}
          onDataChanged={notifyDataChanged}
        />
      ) : null}

      {selectedClass && selectedSubject && activeTab === 'analytics' ? (
        <Suspense fallback={<Card className="p-6 text-sm text-muted-foreground">Loading analytics...</Card>}>
          <GradebookInsightsPanel
            searchQuery={searchQuery}
            selectedClass={selectedClass}
            selectedSubject={selectedSubject}
            refreshTrigger={refreshTrigger}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
