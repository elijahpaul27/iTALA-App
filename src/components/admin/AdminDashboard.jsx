import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui';

const statCards = [
  { key: 'teachers', label: 'Teachers', detail: 'Registered profiles' },
  { key: 'classes', label: 'Classes', detail: 'Active class records' },
  { key: 'students', label: 'Learners', detail: 'Enrolled locally' },
  { key: 'grades', label: 'Grades', detail: 'Raw score entries' }
];

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.admin.stats().then(setStats).catch((error) => setMessage(error.message));
  }, []);

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Admin Dashboard</p>
        <h1 className="mt-2 text-3xl font-medium">School data overview</h1>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <Card interactive key={item.key}>
            <CardHeader>
              <CardDescription>{item.detail}</CardDescription>
              <CardTitle className="text-base">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl p-5 text-center shadow-inset">
                <p className="text-4xl font-medium text-primary">{stats?.[item.key] ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent teacher profiles</CardTitle>
            <CardDescription>Latest local accounts created on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>School ID</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats?.recentTeachers ?? []).map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell>{teacher.school_name}</TableCell>
                    <TableCell>{teacher.school_id}</TableCell>
                    <TableCell>{teacher.created_at ? new Date(teacher.created_at).toLocaleDateString() : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {stats?.recentTeachers?.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No teacher profiles yet.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Records depth</CardTitle>
            <CardDescription>Supporting records stored in the local SQLite database.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Metric label="Subjects" value={stats?.subjects ?? 0} />
              <Metric label="Assessments" value={stats?.assessments ?? 0} />
              <Metric label="Attendance logs" value={stats?.attendanceLogs ?? 0} />
            </div>
          </CardContent>
        </Card>
      </div>

      {message ? <p className="rounded-xl border border-border bg-background p-3 text-sm text-destructive shadow-inset">{message}</p> : null}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-3 shadow-inset">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium text-primary">{value}</span>
    </div>
  );
}
