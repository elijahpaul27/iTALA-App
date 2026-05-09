import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export function AwardsPanel({ selectedClass }) {
  const [honorRoll, setHonorRoll] = useState([]);
  const [message, setMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (selectedClass) refresh();
    else setHonorRoll([]);
  }, [selectedClass?.id]);

  async function refresh() {
    setMessage('');
    try {
      setHonorRoll(await api.awards.listHonorRoll(selectedClass.id));
    } catch (error) {
      setMessage(error.message);
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

  if (!selectedClass) return <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">Select a class to compute honor roll awards.</div>;

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Honor roll</h2>
          <p className="text-sm text-slate-500">Learners with any grade below 75 are excluded before final general average ranking.</p>
        </div>
        <button
          className="rounded bg-blue-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={honorRoll.length === 0 || isGenerating}
          type="button"
          onClick={generateCertificates}
        >
          {isGenerating ? 'Generating...' : 'Generate Certificates'}
        </button>
      </div>

      <div className="mt-4 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Learner</th>
              <th className="px-3 py-2">LRN</th>
              <th className="px-3 py-2">Final General Average</th>
              <th className="px-3 py-2">Award</th>
            </tr>
          </thead>
          <tbody>
            {honorRoll.map((learner, index) => (
              <tr className="border-t" key={learner.student_id}>
                <td className="px-3 py-2 font-semibold">{index + 1}</td>
                <td className="px-3 py-2">{learner.last_name}, {learner.first_name} {learner.middle_name}</td>
                <td className="px-3 py-2">{learner.lrn}</td>
                <td className="px-3 py-2 font-semibold text-green-700">{learner.final_general_average}</td>
                <td className="px-3 py-2">{learner.award_category}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {honorRoll.length === 0 ? <p className="p-4 text-sm text-slate-500">No qualified honor roll learners yet. Complete all four quarters to calculate awards.</p> : null}
      </div>

      {message ? <p className="mt-4 rounded border bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
