import { Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field } from '../ui';

const statusCycle = ['', 'Present', 'Absent', 'Tardy'];
const statusLabels = {
  Present: 'P',
  Absent: 'A',
  Tardy: 'T'
};

function getLastDayOfMonth(month) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex, 0).getDate();
}

function buildDate(month, day) {
  return `${month}-${String(day).padStart(2, '0')}`;
}

function getStatus(student, month, day) {
  const date = buildDate(month, day);
  return student.statuses?.[`${student.id}:${date}`] ?? '';
}

function countStatus(student, month, status) {
  return Object.entries(student.statuses ?? {}).filter(([key, value]) => {
    const date = key.split(':').slice(1).join(':');
    return date.startsWith(month) && value === status;
  }).length;
}

function cellClass(status) {
  if (status === 'Present') return 'bg-green-50 text-green-700';
  if (status === 'Absent') return 'bg-red-50 text-red-700 shadow-inner';
  if (status === 'Tardy') return 'bg-amber-50 text-amber-700 shadow-inner';
  return 'bg-white text-slate-400 hover:bg-slate-50';
}

export function AttendancePanel({ selectedClass }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [isMarkingPresent, setIsMarkingPresent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const days = useMemo(() => Array.from({ length: getLastDayOfMonth(month) }, (_value, index) => index + 1), [month]);

  useEffect(() => {
    if (selectedClass) refresh();
    else setRows([]);
  }, [selectedClass?.id, month]);

  useEffect(() => {
    setAttendanceDate((currentDate) => (currentDate.startsWith(month) ? currentDate : `${month}-01`));
  }, [month]);

  async function refresh() {
    setMessage('');
    try {
      setRows(await api.attendance.dailyGrid({ classId: selectedClass.id, month }));
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateLocalStatus(studentId, date, status) {
    setRows((current) =>
      current.map((student) => {
        if (student.id !== studentId) return student;
        const statuses = { ...(student.statuses ?? {}) };
        if (status) statuses[`${studentId}:${date}`] = status;
        else delete statuses[`${studentId}:${date}`];
        return { ...student, statuses };
      })
    );
  }

  async function setStatus(studentId, day, status) {
    const date = buildDate(month, day);
    const previousRows = rows;
    updateLocalStatus(studentId, date, status);

    try {
      if (status) await api.attendance.save({ student_id: studentId, date, status });
      else await api.attendance.delete({ studentId, date });
    } catch (error) {
      setRows(previousRows);
      setMessage(error.message);
    }
  }

  async function cycleStatus(student, day) {
    const currentStatus = getStatus(student, month, day);
    const nextStatus = statusCycle[(statusCycle.indexOf(currentStatus) + 1) % statusCycle.length];
    await setStatus(student.id, day, nextStatus);
  }

  async function markAllPresent() {
    if (rows.length === 0) return;

    setIsMarkingPresent(true);
    setMessage('');
    const previousRows = rows;
    const day = Number(attendanceDate.slice(-2));
    for (const student of rows) updateLocalStatus(student.id, attendanceDate, 'Present');

    try {
      await Promise.all(
        rows.map((student) =>
          api.attendance.save({
            student_id: student.id,
            date: attendanceDate,
            status: 'Present'
          })
        )
      );
      setMessage(`Marked all present for day ${day}.`);
    } catch (error) {
      setRows(previousRows);
      setMessage(error.message);
    } finally {
      setIsMarkingPresent(false);
    }
  }

  async function exportSf2() {
    if (!selectedClass) return;
    setIsExporting(true);
    setMessage('');
    try {
      const result = await api.forms.exportSf2({ classId: selectedClass.id, month });
      if (result?.canceled) setMessage('SF2 export canceled.');
      else setMessage(`Exported SF2: ${result.filePath}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsExporting(false);
    }
  }

  if (!selectedClass) return <Card className="p-6 text-sm text-muted-foreground">Select a class to view SF2 attendance.</Card>;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>SF2 daily attendance</CardTitle>
            <CardDescription>Click a date cell to cycle blank, present, absent, and tardy.</CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Month">
              <input className="rounded-xl border border-border bg-input-background px-3 py-2 shadow-inset outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </Field>
            <Field label="Date">
              <input
                className="rounded-xl border border-border bg-input-background px-3 py-2 shadow-inset outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                max={`${month}-${String(getLastDayOfMonth(month)).padStart(2, '0')}`}
                min={`${month}-01`}
                type="date"
                value={attendanceDate}
                onChange={(event) => setAttendanceDate(event.target.value)}
              />
            </Field>
            <Button variant="secondary" disabled={isMarkingPresent || rows.length === 0} onClick={markAllPresent}>
              {isMarkingPresent ? 'Marking...' : 'Mark All Present'}
            </Button>
            <Button disabled={isExporting || rows.length === 0} onClick={exportSf2}>
              <Download className="h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export SF2'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="max-h-[70vh] w-full overflow-auto rounded-2xl border border-slate-200 shadow-inset">
          <table className="table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-56" />
              {days.map((day) => <col className="w-9" key={day} />)}
              <col className="w-10" />
              <col className="w-10" />
              <col className="w-10" />
            </colgroup>
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="sticky left-0 top-0 z-30 border border-slate-200 bg-slate-100 px-3 py-2 text-left shadow-[1px_0_0_0_rgb(226,232,240)]">Learner</th>
                {days.map((day) => (
                  <th className="sticky top-0 z-20 border border-slate-200 bg-slate-100 px-0 py-2 text-center font-semibold" key={day}>
                    {day}
                  </th>
                ))}
                <th className="sticky right-20 top-0 z-30 border border-slate-200 bg-slate-100 px-0 py-2 text-center">P</th>
                <th className="sticky right-10 top-0 z-30 border border-slate-200 bg-slate-100 px-0 py-2 text-center">A</th>
                <th className="sticky right-0 top-0 z-30 border border-slate-200 bg-slate-100 px-0 py-2 text-center">T</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => (
                <tr key={student.id}>
                  <td className="sticky left-0 z-10 border border-slate-200 bg-white px-3 py-2 font-medium shadow-[1px_0_0_0_rgb(226,232,240)]">
                    <span className="block truncate">{student.last_name}, {student.first_name}</span>
                  </td>
                  {days.map((day) => {
                    const status = getStatus(student, month, day);
                    return (
                      <td className="border border-slate-200 p-0 text-center" key={day}>
                        <button
                          className={`block h-8 w-full font-semibold transition ${cellClass(status)}`}
                          type="button"
                          onClick={() => cycleStatus(student, day)}
                          aria-label={`${student.last_name}, ${student.first_name} day ${day}: ${status || 'blank'}`}
                        >
                          {statusLabels[status] ?? ''}
                        </button>
                      </td>
                    );
                  })}
                  <td className="sticky right-20 border border-slate-200 bg-white px-0 py-2 text-center font-semibold text-green-700">{countStatus(student, month, 'Present')}</td>
                  <td className="sticky right-10 border border-slate-200 bg-white px-0 py-2 text-center font-semibold text-red-700">{countStatus(student, month, 'Absent')}</td>
                  <td className="sticky right-0 border border-slate-200 bg-white px-0 py-2 text-center font-semibold text-amber-700">{countStatus(student, month, 'Tardy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Add learners before tracking attendance.</p> : null}
        </div>

        {message ? <p className="mt-4 rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground shadow-inset">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
