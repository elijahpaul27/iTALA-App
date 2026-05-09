import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui';

const blankTeacher = {
  name: '',
  school_name: '',
  school_id: '',
  pin: ''
};

export function TeacherManagement() {
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(blankTeacher);
  const [pinReset, setPinReset] = useState({ teacherId: '', pin: '' });
  const [message, setMessage] = useState('');
  const isEditing = Boolean(form.id);

  useEffect(() => {
    refreshTeachers();
  }, []);

  async function refreshTeachers() {
    setMessage('');
    try {
      setTeachers(await api.teachers.list());
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateForm(field, value) {
    setMessage('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveTeacher(event) {
    event.preventDefault();
    setMessage('');

    if (!isEditing && form.pin.length < 4) {
      setMessage('PIN must contain at least 4 characters.');
      return;
    }

    try {
      await api.teachers.save(form);
      setForm(blankTeacher);
      await refreshTeachers();
      setMessage(isEditing ? 'Teacher account updated.' : 'Teacher account created.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteTeacher(teacher) {
    const confirmed = window.confirm(`Delete ${teacher.name}? This also removes their classes, learners, grades, attendance, and forms data.`);
    if (!confirmed) return;

    setMessage('');
    try {
      await api.teachers.delete(teacher.id);
      await refreshTeachers();
      if (form.id === teacher.id) setForm(blankTeacher);
      if (pinReset.teacherId === teacher.id) setPinReset({ teacherId: '', pin: '' });
      setMessage('Teacher account deleted.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function resetPin(event) {
    event.preventDefault();
    setMessage('');

    if (!pinReset.teacherId || pinReset.pin.length < 4) {
      setMessage('Choose a teacher and enter a PIN with at least 4 characters.');
      return;
    }

    try {
      await api.teachers.resetPin({ teacherId: Number(pinReset.teacherId), pin: pinReset.pin });
      setPinReset({ teacherId: '', pin: '' });
      setMessage('Teacher PIN reset.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Teacher Management</p>
        <h1 className="mt-2 text-3xl font-medium">Manage local teacher accounts</h1>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? 'Edit teacher' : 'Add teacher'}</CardTitle>
              <CardDescription>Accounts are stored locally and unlocked with a hashed PIN.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={saveTeacher}>
                <Field label="Teacher Name">
                  <Input placeholder="Teacher name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} required />
                </Field>
                <Field label="School Name">
                  <Input placeholder="School name" value={form.school_name} onChange={(event) => updateForm('school_name', event.target.value)} required />
                </Field>
                <Field label="School ID">
                  <Input placeholder="School ID" value={form.school_id} onChange={(event) => updateForm('school_id', event.target.value)} required />
                </Field>
                {!isEditing ? (
                  <Field label="Initial PIN">
                    <Input minLength={4} placeholder="Initial PIN" type="password" value={form.pin} onChange={(event) => updateForm('pin', event.target.value)} required />
                  </Field>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit">{isEditing ? 'Update Teacher' : 'Create Teacher'}</Button>
                  {isEditing ? (
                    <Button variant="secondary" onClick={() => setForm(blankTeacher)}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reset PIN</CardTitle>
              <CardDescription>Issue a new local unlock PIN for a teacher profile.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={resetPin}>
                <Field label="Teacher Account">
                  <Select
                    value={pinReset.teacherId}
                    onChange={(event) => setPinReset((current) => ({ ...current, teacherId: event.target.value }))}
                    required
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name} - {teacher.school_name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="New PIN">
                  <Input minLength={4} placeholder="New PIN" type="password" value={pinReset.pin} onChange={(event) => setPinReset((current) => ({ ...current, pin: event.target.value }))} required />
                </Field>
                <Button type="submit" variant="secondary">Reset PIN</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Teacher accounts</CardTitle>
            <CardDescription>Add, update, delete, and secure local teacher profiles.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>School ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell>{teacher.school_name}</TableCell>
                    <TableCell>{teacher.school_id}</TableCell>
                    <TableCell>{teacher.created_at ? new Date(teacher.created_at).toLocaleDateString() : ''}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setForm({ ...teacher, pin: '' })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => deleteTeacher(teacher)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {teachers.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No teacher profiles have been created yet.</p> : null}
          </CardContent>
        </Card>
      </div>

      {message ? <p className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground shadow-inset">{message}</p> : null}
    </section>
  );
}
