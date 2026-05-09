import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui';

export function ClassRollover({ selectedClass, onClassCreated }) {
  const [data, setData] = useState(null);
  const [nextClass, setNextClass] = useState(null);
  const [message, setMessage] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);

  useEffect(() => {
    if (selectedClass) refresh();
    else {
      setData(null);
      setNextClass(null);
    }
  }, [selectedClass?.id]);

  async function refresh() {
    setMessage('');
    try {
      const result = await api.classes.rolloverCandidates(selectedClass.id);
      setData(result);
      setNextClass(result.nextClass);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateNextClass(field, value) {
    setNextClass((current) => ({ ...current, [field]: value }));
  }

  async function promoteClass() {
    const promotedCount = data?.learners.filter((learner) => learner.status === 'PROMOTED').length ?? 0;
    const confirmed = window.confirm(`Create the next class and migrate ${promotedCount} promoted learner${promotedCount === 1 ? '' : 's'}?`);
    if (!confirmed) return;

    setIsPromoting(true);
    setMessage('');
    try {
      const result = await api.classes.rolloverPromoted({ classId: selectedClass.id, nextClass });
      setMessage(`Created next class with ${result.promotedCount} promoted learner${result.promotedCount === 1 ? '' : 's'}.`);
      onClassCreated?.(result.classId);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsPromoting(false);
    }
  }

  if (!selectedClass) return <Card className="p-6 text-sm text-muted-foreground">Select a class to run end-of-year rollover.</Card>;

  const promotedCount = data?.learners.filter((learner) => learner.status === 'PROMOTED').length ?? 0;
  const retainedCount = data?.learners.filter((learner) => learner.status === 'RETAINED').length ?? 0;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>End-of-year promotion wizard</CardTitle>
        <CardDescription>Verify SF5 promoted/retained status before creating the next school year class.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4 shadow-inset">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Promoted</p>
                <p className="text-3xl font-medium text-green-700">{promotedCount}</p>
              </div>
              <div className="rounded-2xl p-4 shadow-inset">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Retained</p>
                <p className="text-3xl font-medium text-red-700">{retainedCount}</p>
              </div>
            </div>
            {nextClass ? (
              <div className="grid gap-4 rounded-2xl p-5 shadow-raised">
                <div>
                  <p className="text-sm font-medium">Target Class</p>
                  <p className="text-xs text-muted-foreground">These values will be used when the next-year class is created.</p>
                </div>
                <Field label="Grade Level">
                  <Input value={nextClass.grade_level} onChange={(event) => updateNextClass('grade_level', event.target.value)} />
                </Field>
                <Field label="Section">
                  <Input value={nextClass.section} onChange={(event) => updateNextClass('section', event.target.value)} />
                </Field>
                <Field label="School Year">
                  <Input value={nextClass.school_year} onChange={(event) => updateNextClass('school_year', event.target.value)} />
                </Field>
                <Field label="Curriculum">
                  <Input value={nextClass.curriculum} onChange={(event) => updateNextClass('curriculum', event.target.value)} />
                </Field>
                <Button className="mt-1 w-full" disabled={!data || promotedCount === 0 || isPromoting} onClick={promoteClass}>
                  {isPromoting ? 'Promoting...' : 'Promote to Next Year'}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Average</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Failing Subjects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.learners ?? []).map((learner) => (
                  <TableRow key={learner.student_id}>
                    <TableCell className="font-medium">{learner.last_name}, {learner.first_name}</TableCell>
                    <TableCell>{learner.general_average ?? ''}</TableCell>
                    <TableCell>
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${learner.status === 'PROMOTED' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {learner.status}
                      </span>
                    </TableCell>
                    <TableCell>{learner.failing_subjects.join(', ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        {message ? <p className="mt-4 rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground shadow-inset">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
