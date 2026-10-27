import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HardDrive } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import { formatBytes } from '../util.js';
import { Button, ErrorBox, inputClass, Spinner } from '../components/Modal.jsx';

const GB = 1024 ** 3;

export default function Storage() {
  const { user } = useAuth();
  const toast = useToast();
  const { refreshStorage } = useOutletContext();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () =>
    api
      .get('/storage')
      .then((s) => {
        setInfo(s);
        setLimit(String(Math.round((s.limitBytes / GB) * 100) / 100));
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    setFormError('');
    const n = Number(limit);
    if (!n || n <= 0) return setFormError('Enter a size greater than 0');
    setBusy(true);
    try {
      const s = await api.put('/storage/limit', { limitGB: n });
      setInfo(s);
      refreshStorage();
      toast.success('Storage allocation updated');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorBox message={error} onRetry={() => { setError(''); load(); }} />;
  if (!info) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Storage</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-3 flex items-center gap-2 font-medium"><HardDrive size={18} /> Cloud9 allocation</div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full ${info.usedPercent > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.max(info.usedPercent, 0.5)}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-slate-600">
          <span>{formatBytes(info.usedBytes)} used ({info.usedPercent}%)</span>
          <span>{formatBytes(info.availableBytes)} free of {formatBytes(info.limitBytes)}</span>
        </div>
        <p className="mt-2 text-xs text-slate-400">{info.fileCount} file(s) in total · you are using {formatBytes(info.yourUsedBytes)}</p>
        {info.usedPercent > 90 && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Your cloud is almost full. Free up space or allocate more.</p>}
      </div>

      {info.disk && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-2 font-medium">Laptop drive</div>
          <p className="text-sm text-slate-600">{formatBytes(info.disk.freeBytes)} free of {formatBytes(info.disk.totalBytes)}</p>
        </div>
      )}

      {user.role === 'owner' ? (
        <form onSubmit={save} className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-1 font-medium">Allocate storage</div>
          <p className="mb-4 text-sm text-slate-500">Choose how much of this laptop's drive Cloud9 may use. It can't exceed the drive's free space or go below what's already used.</p>
          <div className="flex max-w-sm items-center gap-2">
            <input className={inputClass} type="number" step="any" min="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} />
            <span className="text-sm text-slate-500">GB</span>
            <Button type="submit" loading={busy}>Save</Button>
          </div>
          {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
        </form>
      ) : (
        <p className="text-sm text-slate-500">Only the owner can change the storage allocation.</p>
      )}
    </div>
  );
}
