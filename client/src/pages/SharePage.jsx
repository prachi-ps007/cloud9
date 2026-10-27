import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Cloud, Download, FileText } from 'lucide-react';
import { formatBytes, formatDate } from '../util.js';
import { Spinner } from '../components/Modal.jsx';

// Public page - anyone with the link sees this, no account needed
export default function SharePage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/share/${token}/info`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok) throw new Error(d?.error || 'Link not available');
        setInfo(d);
      })
      .catch((e) => setError(e.message === 'Failed to fetch' ? 'Cannot reach the server' : e.message));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
        <Cloud size={32} className="mx-auto text-indigo-600" />
        <p className="mb-6 mt-1 text-sm text-slate-500">Someone shared a file with you via Cloud9</p>
        {!info && !error && <Spinner className="mx-auto" />}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {info && (
          <>
            <FileText size={48} className="mx-auto text-slate-400" />
            <p className="mt-3 break-all font-semibold">{info.name}</p>
            <p className="text-sm text-slate-500">{formatBytes(info.size)}</p>
            <a
              href={`/api/share/${token}/download`}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Download size={16} /> Download
            </a>
            <p className="mt-4 text-xs text-slate-400">Link expires {formatDate(info.expiresAt)}</p>
          </>
        )}
      </div>
    </div>
  );
}
