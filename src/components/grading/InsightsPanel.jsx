import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui';
import { getGradeColorClass, learnerMatchesSearch } from './gradebookUtils';

export function GradebookInsightsPanel({ selectedClass, selectedSubject, searchQuery, refreshTrigger }) {
  const [quarter, setQuarter] = useState(1);
  const [distribution, setDistribution] = useState([]);
  const [atRisk, setAtRisk] = useState([]);
  const [summary, setSummary] = useState([]);
  const [honorRoll, setHonorRoll] = useState([]);
  const [message, setMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingSf9, setIsExportingSf9] = useState(false);
  const [isExportingNotices, setIsExportingNotices] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    refresh();
  }, [selectedClass?.id, selectedSubject?.id, quarter, refreshTrigger]);

  async function refresh() {
    if (!selectedClass?.id || !selectedSubject?.id) return;
    setMessage('');
    try {
      const [distributionRows, atRiskRows, summaryRows, honorRows] = await Promise.all([
        api.analytics.gradeDistribution({ classId: selectedClass.id }),
        api.analytics.atRisk({ classId: selectedClass.id, quarter }),
        api.grades.summary({ classId: selectedClass.id, subjectId: selectedSubject.id, quarter: null }),
        api.awards.listHonorRoll(selectedClass.id)
      ]);
      setDistribution(distributionRows);
      setAtRisk(atRiskRows);
      setSummary(summaryRows);
      setHonorRoll(honorRows);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function exportRawGrid() {
    setIsExporting(true);
    setExportMessage('');
    try {
      const result = await api.grades.exportRawGrid({ classId: selectedClass.id, subjectId: selectedSubject.id });
      setExportMessage(`Exported: ${result.filePath}`);
    } catch (error) {
      setExportMessage(error.message);
    } finally {
      setIsExporting(false);
    }
  }

  async function generateCertificates() {
    setIsGenerating(true);
    setMessage('');
    try {
      const result = await api.awards.generateCertificates(selectedClass.id);
      setMessage(`Generated ${result.count} certificate${result.count === 1 ? '' : 's'}: ${result.filePath}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function exportSf9Batch() {
    setIsExportingSf9(true);
    setExportMessage('');
    try {
      const result = await api.forms.exportSf9Batch(selectedClass.id);
      setExportMessage(`Generated ${result.count} SF9 report card${result.count === 1 ? '' : 's'}: ${result.filePath}`);
    } catch (error) {
      setExportMessage(error.message);
    } finally {
      setIsExportingSf9(false);
    }
  }

  async function exportAtRiskNotices() {
    setIsExportingNotices(true);
    setMessage('');
    try {
      const result = await api.analytics.exportAtRiskNotices({ classId: selectedClass.id, quarter });
      setMessage(`Generated ${result.count} at-risk notice${result.count === 1 ? '' : 's'}: ${result.filePath}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsExportingNotices(false);
    }
  }

  const visibleSummary = summary.filter((row) => learnerMatchesSearch(row, searchQuery));
  const visibleHonorRoll = honorRoll.filter((learner) => learnerMatchesSearch(learner, searchQuery));

  return (
    <section className="grid w-full min-w-0 gap-5 overflow-hidden">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Grade distribution</CardTitle>
                <CardDescription>Final general average distribution for the selected class.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={isExporting} variant="secondary" onClick={exportRawGrid}>
                  {isExporting ? 'Exporting...' : 'Export to Excel'}
                </Button>
                <Button disabled={isExportingSf9} onClick={exportSf9Batch}>
                  {isExportingSf9 ? 'Generating...' : 'Batch SF9'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80 rounded-2xl px-2 pb-8 pt-4 shadow-inset">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 12, right: 18, bottom: 22, left: 0 }}>
                  <CartesianGrid stroke="rgba(0,0,0,0.08)" vertical={false} />
                  <XAxis dataKey="range" tickLine={false} axisLine={false} interval={0} height={36} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(76,95,189,0.08)' }}
                    wrapperStyle={{ outline: 'none', zIndex: 20 }}
                    contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="count" fill="#4C5FBD" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {exportMessage ? <p className="mt-3 rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground shadow-inset">{exportMessage}</p> : null}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
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
              <Button disabled={atRisk.length === 0 || isExportingNotices} variant="secondary" onClick={exportAtRiskNotices}>
                {isExportingNotices ? 'Exporting...' : 'Export Notice'}
              </Button>
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>LRN</TableHead>
                <TableHead>Failing Subjects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atRisk.map((student) => (
                <TableRow key={student.student_id}>
                  <TableCell className="font-medium">{student.last_name}, {student.first_name}</TableCell>
                  <TableCell>{student.lrn}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {student.subjects.map((subject) => (
                        <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700" key={`${student.student_id}-${subject.subject_name}`}>
                          {subject.subject_name}: {subject.grade}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {atRisk.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No failing grades for this quarter.</p> : null}
        </CardContent>
      </Card>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Quarterly summary</CardTitle>
          <CardDescription>Live DepEd transmutation rows for the selected subject.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>Quarter</TableHead>
                <TableHead>Initial</TableHead>
                <TableHead>Transmuted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSummary.map((row) => (
                <TableRow key={`${row.student_id}-${row.subject_id}-${row.quarter}`}>
                  <TableCell className="font-medium">{row.last_name}, {row.first_name}</TableCell>
                  <TableCell>Q{row.quarter}</TableCell>
                  <TableCell className={getGradeColorClass(row.initial_grade)}>{row.initial_grade}</TableCell>
                  <TableCell className={`font-semibold ${getGradeColorClass(row.transmuted_grade)}`}>{row.transmuted_grade}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibleSummary.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No summary rows yet.</p> : null}
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Honor roll</CardTitle>
              <CardDescription>Learners with any grade below 75 are excluded before final average ranking.</CardDescription>
            </div>
            <Button disabled={visibleHonorRoll.length === 0 || isGenerating} onClick={generateCertificates}>
              {isGenerating ? 'Generating...' : 'Generate Certificates'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Learner</TableHead>
                <TableHead>LRN</TableHead>
                <TableHead>Final Average</TableHead>
                <TableHead>Award</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleHonorRoll.map((learner, index) => (
                <TableRow key={learner.student_id}>
                  <TableCell className="font-semibold">{index + 1}</TableCell>
                  <TableCell>{learner.last_name}, {learner.first_name} {learner.middle_name}</TableCell>
                  <TableCell>{learner.lrn}</TableCell>
                  <TableCell className="font-semibold text-green-700">{learner.final_general_average}</TableCell>
                  <TableCell>{learner.award_category}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibleHonorRoll.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No qualified honor roll learners yet.</p> : null}
        </CardContent>
      </Card>

      {message ? <p className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground shadow-inset">{message}</p> : null}
    </section>
  );
}
