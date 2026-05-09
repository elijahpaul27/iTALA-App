import { useState } from 'react';
import { api } from '../../lib/api';

export function SettingsPanel() {
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  async function backupDatabase() {
    setIsBusy(true);
    setMessage('');
    try {
      const result = await api.settings.backupDatabase();
      if (result?.canceled) setMessage('Backup canceled.');
      else setMessage(`Backup saved: ${result.filePath}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function restoreDatabase() {
    const confirmed = window.confirm('Restore will overwrite the current iTALA database. Continue?');
    if (!confirmed) return;

    setIsBusy(true);
    setMessage('');
    try {
      const result = await api.settings.restoreDatabase();
      if (result?.canceled) setMessage('Restore canceled.');
      else setMessage('Database restored. Restart iTALA if open screens still show old records.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Settings</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded border p-4">
          <h3 className="font-semibold">Backup database</h3>
          <p className="mt-1 text-sm text-slate-500">Copy the local iTALA SQLite database to Downloads.</p>
          <button className="mt-4 rounded bg-blue-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={isBusy} type="button" onClick={backupDatabase}>
            Backup to Downloads
          </button>
        </div>
        <div className="rounded border p-4">
          <h3 className="font-semibold">Restore database</h3>
          <p className="mt-1 text-sm text-slate-500">Overwrite the local database from a previous `.sqlite3` backup.</p>
          <button className="mt-4 rounded bg-red-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={isBusy} type="button" onClick={restoreDatabase}>
            Restore Backup
          </button>
        </div>
      </div>
      {message ? <p className="mt-4 rounded border bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
