import { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../toast.jsx';
import { copyText, formatDate } from '../util.js';
import { EmptyState, ErrorBox, Spinner } from '../components/Modal.jsx';
import { ConfirmDialog } from '../components/FileDialogs.jsx';

export default function Shares() {
  const toast = useToast();
  const [links, setLinks] = useState(null);
  const [error, setError] = useState('');
  const [revoke, setRevoke] = useState(null);

  const load = useCallback(() => {
    setError('');
    api.get('/share').then((d) => setLinks(d.links)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Shared links</h1>
      <p className="text-sm text-slate-500">Files you've shared with a link. Revoke a link to stop access immediately.</p>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!links && !error && <div className="flex justify-center py-16"><Spinner /></div>}
      {links && links.length === 0 && <EmptyState icon={Link2} title="No shared links yet" text="Use the share icon next to any file." />}

      {links && links.length > 0 && (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.fileName}</p>
                <p className="text-xs text-slate-400">
                  {l.expired ? <span className="text-red-500">Expired {formatDate(l.expiresAt)}</span> : <>Expires {formatDate(l.expiresAt)}</>} · {l.downloadCount} download{l.downloadCount === 1 ? '' : 's'}
                </p>
              </div>
              {!l.expired && (
                <button
                  title="Copy link"
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                  onClick={async () => toast.success((await copyText(l.url)) ? 'Link copied' : 'Copy failed')}
                >
                  <Copy size={16} />
                </button>
              )}
              <button title="Revoke" className="rounded p-1.5 text-red-500 hover:bg-red-50" onClick={() => setRevoke(l)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {revoke && (
        <ConfirmDialog
          title="Revoke link"
          message={`Anyone using the link to “${revoke.fileName}” will lose access.`}
          confirmText="Revoke"
          onClose={() => setRevoke(null)}
          onConfirm={async () => {
            await api.del(`/share/${revoke.id}`);
            toast.success('Link revoked');
            load();
          }}
        />
      )}
    </div>
  );
}
