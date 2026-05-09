import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Field } from '../ui';

const blankProfile = {
  name: '',
  school_name: '',
  school_id: '',
  pin: ''
};

export function ProfileGate({ onUnlock }) {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [pin, setPin] = useState('');
  const [profile, setProfile] = useState(blankProfile);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.teachers.list().then(setTeachers).catch((error) => setMessage(error.message));
  }, []);

  async function createProfile(event) {
    event.preventDefault();
    const result = await api.teachers.create(profile);
    const teacher = { ...profile, id: result.id };
    setTeachers((current) => [...current, teacher]);
    setProfile(blankProfile);
    onUnlock(teacher);
  }

  async function unlockProfile(event) {
    event.preventDefault();
    const result = await api.teachers.verifyPin(Number(selectedTeacherId), pin);
    if (!result.verified) {
      setMessage('Invalid PIN.');
      return;
    }

    onUnlock(teachers.find((teacher) => teacher.id === Number(selectedTeacherId)));
  }

  return (
    <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_1fr]">
      <div>
        <p className="text-sm font-semibold uppercase text-blue-700">iTALA</p>
        <h1 className="mt-2 text-3xl font-semibold">Teacher profile</h1>
        <p className="mt-3 text-slate-600">
          Local profiles stay on this computer. The PIN is stored as a PBKDF2 hash in SQLite.
        </p>
        {message ? <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">{message}</p> : null}
      </div>

      <div className="grid gap-4">
        {teachers.length > 0 ? (
          <form onSubmit={unlockProfile} className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Unlock existing profile</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Teacher">
                <select
                  className="rounded border px-3 py-2"
                  value={selectedTeacherId}
                  onChange={(event) => setSelectedTeacherId(event.target.value)}
                  required
                >
                  <option value="">Select profile</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.school_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="PIN">
                <input
                  className="rounded border px-3 py-2"
                  type="password"
                  minLength={4}
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  required
                />
              </Field>
            </div>
            <button className="mt-4 rounded bg-blue-700 px-4 py-2 font-medium text-white" type="submit">
              Unlock
            </button>
          </form>
        ) : null}

        <form onSubmit={createProfile} className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Create profile</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Teacher Name">
              <input className="rounded border px-3 py-2" placeholder="Teacher name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required />
            </Field>
            <Field label="School Name">
              <input className="rounded border px-3 py-2" placeholder="School name" value={profile.school_name} onChange={(event) => setProfile({ ...profile, school_name: event.target.value })} required />
            </Field>
            <Field label="School ID">
              <input className="rounded border px-3 py-2" placeholder="School ID" value={profile.school_id} onChange={(event) => setProfile({ ...profile, school_id: event.target.value })} required />
            </Field>
            <Field label="PIN">
              <input className="rounded border px-3 py-2" placeholder="PIN" type="password" minLength={4} value={profile.pin} onChange={(event) => setProfile({ ...profile, pin: event.target.value })} required />
            </Field>
          </div>
          <button className="mt-4 rounded bg-slate-950 px-4 py-2 font-medium text-white" type="submit">
            Create and unlock
          </button>
        </form>
      </div>
    </section>
  );
}
