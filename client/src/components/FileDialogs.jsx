import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Copy, Download, Folder, Home } from 'lucide-react';
import { api, fileUrl } from '../api.js';
import { Button, ErrorBox, inputClass, Modal, Spinner } from './Modal.jsx';
import { copyText, formatDate } from '../util.js';
import { useToast } from '../toast.jsx';

// ---------- Text prompt (new folder / rename) ----------
export function PromptDialog({ title, label, initial = '', confirmText, onSubmit, onClose }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">{label}</label>
          <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} autoFocus required maxLength={255} />
        </div>
        {error && <ErrorBox message={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {confirmText}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Confirm (delete) ----------
export function ConfirmDialog({ title, message, confirmText = 'Delete', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-slate-600">{message}</p>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError(e.message);
              setBusy(false);
            }
          }}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}

// ---------- Move to... (folder picker) ----------
export function MoveDialog({ kind, item, onMoved, onClose }) {
  const [folderId, setFolderId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api.get(`/files/browse${folderId ? `?folderId=${folderId}` : ''}`));
    } catch (e) {
      setError(e.message);
    }
  }, [folderId]);
  useEffect(() => {
    load();
  }, [load]);

  const current = kind === 'file' ? item.folderId : item.parentId;
  const parent = data?.breadcrumbs.length > 1 ? data.breadcrumbs[data.breadcrumbs.length - 2].id : null;
  const subfolders = (data?.folders || []).filter((f) => !(kind === 'folder' && f.id === item.id));
  const insideSelf = kind === 'folder' && data?.breadcrumbs.some((b) => b.id === item.id);

  async function moveHere() {
    setBusy(true);
    setError('');
    try {
      if (kind === 'file') await api.patch(`/files/${item.id}`, { folderId });
      else await api.patch(`/folders/${item.id}`, { parentId: folderId });
      onMoved();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Move "${item.name}"`} onClose={onClose}>
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
        {folderId !== null && (
          <button onClick={() => setFolderId(parent)} className="rounded p-1 hover:bg-slate-100" aria-label="Back">
            <ChevronLeft size={18} />
          </button>
        )}
        <Home size={16} />
        <span className="truncate">{data ? ['My files', ...data.breadcrumbs.map((b) => b.name)].join(' / ') : '…'}</span>
      </div>
      <div className="h-56 overflow-auto rounded-lg border border-slate-200">
        {!data && !error && <div className="flex justify-center py-10"><Spinner /></div>}
        {data && subfolders.length === 0 && <p className="p-4 text-sm text-slate-400">No folders here</p>}
        {subfolders.map((f) => (
          <button key={f.id} onClick={() => setFolderId(f.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50">
            <Folder size={18} className="text-amber-500" /> {f.name}
          </button>
        ))}
      </div>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} disabled={!data || folderId === current || insideSelf} onClick={moveHere}>
          Move here
        </Button>
      </div>
    </Modal>
  );
}

// ---------- Share link ----------
const EXPIRIES = [
  { label: '1 hour', hours: 1 },
  { label: '1 day', hours: 24 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
];

export function ShareDialog({ file, onClose }) {
  const toast = useToast();
  const [hours, setHours] = useState(24);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    setBusy(true);
    setError('');
    try {
      setLink((await api.post(`/share/files/${file.id}`, { expiresInHours: hours })).link);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Share "${file.name}"`} onClose={onClose}>
      {!link ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Anyone with the link can download this file until it expires. No account needed.</p>
          <div>
            <label className="mb-1 block text-sm font-medium">Link expires after</label>
            <div className="grid grid-cols-4 gap-2">
              {EXPIRIES.map((o) => (
                <button
                  key={o.hours}
                  onClick={() => setHours(o.hours)}
                  className={`rounded-lg border px-2 py-2 text-sm ${hours === o.hours ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {error && <ErrorBox message={error} />}
          <div className="flex justify-end">
            <Button loading={busy} onClick={create}>
              Create link
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <input readOnly value={link.url} className={inputClass} onFocus={(e) => e.target.select()} />
          <p className="text-xs text-slate-500">Expires {formatDate(link.expiresAt)}. The link works for devices on your network, or anywhere if your cloud is publicly reachable.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={async () => toast.success((await copyText(link.url)) ? 'Link copied' : 'Copy failed - select and copy manually')}>
              <Copy size={16} /> Copy link
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------- Preview ----------
export function PreviewDialog({ file, onClose }) {
  const src = fileUrl(file.id, 'preview');
  const mime = file.mimeType;
  let body;
  if (mime.startsWith('image/')) body = <img src={src} alt={file.name} className="mx-auto max-h-[70vh] rounded" />;
  else if (mime.startsWith('video/')) body = <video src={src} controls className="mx-auto max-h-[70vh] w-full rounded" />;
  else if (mime.startsWith('audio/')) body = <audio src={src} controls className="w-full" />;
  else if (mime === 'application/pdf' || mime.startsWith('text/'))
    body = <iframe src={src} title={file.name} className="h-[70vh] w-full rounded border border-slate-200" />;
  else
    body = <p className="py-10 text-center text-slate-500">No preview available for this file type.</p>;

  return (
    <Modal title={file.name} onClose={onClose} wide>
      {body}
      <div className="mt-4 flex justify-end">
        <a
          href={fileUrl(file.id, 'download')}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Download size={16} /> Download
        </a>
      </div>
    </Modal>
  );
}
