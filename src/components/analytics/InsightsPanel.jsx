import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Select } from '../ui';

export function InsightsPanel({ selectedClass }) {
  const [quarter, setQuarter] = useState(1);
  const [distribution, setDistribution] = useState([]);
  const [atRisk, setAtRisk] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (selectedClass) refresh();
    else {
      setDistribution([]);
      setAtRisk([]);
    }
  }, [selectedClass?.id, quarter]);

  async function refresh() {
    setMessage('');
    try {
      const [distributionRows, atRiskRows] = await Promise.all([
        api.analytics.gradeDistribution({ classId: selectedClass.id }),
        api.analytics.atRisk({ classId: selectedClass.id, quarter })
      ]);
      setDistribution(distributionRows);
      setAtRisk(atRiskRows);
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!selectedClass) return <Card className="p-6 text-sm text-muted-foreground">Select a class to view grade insights.</Card>;

  return (
    <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Grade distribution</CardTitle>
          <CardDescription>Final general average distribution for the selected class.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 rounded-2xl p-4 shadow-inset">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <CartesianGrid stroke="rgba(0,0,0,0.08)" vertical={false} />
                <XAxis dataKey="range" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(76,95,189,0.08)' }} />
                <Bar dataKey="count" fill="#4C5FBD" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>At-risk learners</CardTitle>
              <CardDescription>Students currently below 75 in any subject.</CardDescription>
            </div>
            <Field className="w-28" label="Quarter">
              <Select value={quarter} onChange={(event) => setQuarter(Number(event.target.value))}>
                <option value={1}>Q1</option>
                <option value={2}>Q2</option>
                <option value={3}>Q3</option>
                <option value={4}>Q4</option>
              </Select>
            </Field>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid max-h-72 gap-3 overflow-auto pr-1">
            {atRisk.map((student) => (
              <div className="rounded-xl border border-border p-3 shadow-inset" key={student.student_id}>
                <p className="font-medium">{student.last_name}, {student.first_name}</p>
                <p className="text-xs text-muted-foreground">{student.lrn}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {student.subjects.map((subject) => (
                    <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700" key={`${student.student_id}-${subject.subject_name}`}>
                      {subject.subject_name}: {subject.grade}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {atRisk.length === 0 ? <p className="text-sm text-muted-foreground">No failing grades for this quarter.</p> : null}
          </div>
          {message ? <p className="mt-3 rounded-xl border border-border bg-background p-3 text-sm text-destructive shadow-inset">{message}</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
