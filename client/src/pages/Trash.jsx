import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, File as FileIcon, FileAudio, FileImage, FileText, FileVideo, RotateCcw, Trash2, Trash } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../toast.jsx';
import { formatBytes, formatDate } from '../util.js';
import { EmptyState, Spinner } from '../components/Modal.jsx';

function iconFor(mime = '') {
  if (mime.startsWith('image/')) return <FileImage size={21} className="text-pink-500" />;
  if (mime.startsWith('video/')) return <FileVideo size={21} className="text-purple-500" />;
  if (mime.startsWith('audio/')) return <FileAudio size={21} className="text-teal-500" />;
  if (mime === 'application/pdf' || mime.startsWith('text/')) return <FileText size={21} className="text-blue-500" />;
  return <FileIcon size={21} className="text-slate-400" />;
}

export default function TrashPage() {
  const toast = useToast();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/files/trash');
      setFiles(data.files || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function restore(file) {
    setBusyId(file.id);
    try {
      const result = await api.post(`/files/${file.id}/restore`);
      toast.success(result.file?.name !== file.name ? `Restored as “${result.file.name}” to avoid a name conflict` : 'File restored successfully');
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function permanentlyDelete(file) {
    const confirmed = window.confirm(`Permanently delete “${file.name}”? This also removes the file from disk and cannot be undone.`);
    if (!confirmed) return;
    setBusyId(file.id);
    try {
      await api.del(`/files/${file.id}/permanent`);
      toast.success('File permanently deleted');
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-indigo-600"><Trash size={20} /><span className="text-sm font-semibold">CLOUD9 RECOVERY</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Trash & Recovery</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Deleted files stay on your device until you permanently remove them. Restore anything you deleted by mistake.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Recoverable storage</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatBytes(totalBytes)}</p>
          <p className="text-xs text-slate-500">{files.length} {files.length === 1 ? 'file' : 'files'} in Trash</p>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle size={19} className="mt-0.5 shrink-0" />
        <div className="text-sm"><p className="font-semibold">Files in Trash still use disk space</p><p className="mt-1 text-amber-800">Restore a file to keep using it, or permanently delete it to free the space. Permanent deletion cannot be undone.</p></div>
      </div>

      {loading && <div className="flex justify-center py-16"><Spinner /></div>}
      {!loading && error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={load} className="ml-3 font-semibold underline">Try again</button></div>}
      {!loading && !error && files.length === 0 && <EmptyState icon={Trash2} title="Your Trash is empty" text="Files you delete from CLOUD9 will appear here so you can recover them." />}

      {!loading && !error && files.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="hidden grid-cols-[minmax(0,1fr)_100px_160px_170px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <span>File</span><span className="text-right">Size</span><span className="text-right">Deleted</span><span className="text-right">Actions</span>
          </div>
          {files.map((file) => (
            <div key={file.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50">
              <div className="flex min-w-0 flex-1 items-center gap-3">{iconFor(file.mimeType)}<div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{file.name}</p><p className="text-xs text-slate-400">Deleted {formatDate(file.deletedAt)}</p></div></div>
              <span className="w-20 text-right text-xs text-slate-500">{formatBytes(file.size)}</span>
              <div className="flex w-full justify-end gap-2 sm:w-auto">
                <button disabled={busyId === file.id} onClick={() => restore(file)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"><RotateCcw size={14} /> Restore</button>
                <button disabled={busyId === file.id} onClick={() => permanentlyDelete(file)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} /> Delete forever</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
