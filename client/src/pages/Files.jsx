import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  ChevronRight, Download, File as FileIcon, FileAudio, FileImage, FileText, FileVideo, Folder,
  FolderInput, FolderOpen, FolderPlus, Home, Pencil, Search, Share2, Trash2, Upload, X,
} from 'lucide-react';
import { api, fileUrl, uploadFiles } from '../api.js';
import { useToast } from '../toast.jsx';
import { formatBytes, formatDate } from '../util.js';
import { Button, EmptyState, ErrorBox, inputClass, Spinner } from '../components/Modal.jsx';
import { ConfirmDialog, MoveDialog, PreviewDialog, PromptDialog, ShareDialog } from '../components/FileDialogs.jsx';

function iconFor(mime) {
  if (mime.startsWith('image/')) return <FileImage size={20} className="text-pink-500" />;
  if (mime.startsWith('video/')) return <FileVideo size={20} className="text-purple-500" />;
  if (mime.startsWith('audio/')) return <FileAudio size={20} className="text-teal-500" />;
  if (mime === 'application/pdf' || mime.startsWith('text/')) return <FileText size={20} className="text-blue-500" />;
  return <FileIcon size={20} className="text-slate-400" />;
}

function IconBtn({ title, onClick, href, danger, children }) {
  const cls = `rounded p-1.5 ${danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-500 hover:bg-slate-100'}`;
  return href ? (
    <a href={href} title={title} className={cls}>{children}</a>
  ) : (
    <button title={title} onClick={onClick} className={cls}>{children}</button>
  );
}

export default function Files() {
  const { folderId } = useParams();
  const currentId = folderId ? Number(folderId) : null;
  const { refreshStorage } = useOutletContext();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInput = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [modal, setModal] = useState(null);
  const [upload, setUpload] = useState(null);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.get(`/files/browse${currentId ? `?folderId=${currentId}` : ''}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [currentId]);

  useEffect(() => {
    load();
    setQuery('');
    setResults(null);
  }, [load]);

  // debounced search
  useEffect(() => {
    if (!query.trim()) return setResults(null);
    const t = setTimeout(() => {
      api
        .get(`/files/search?q=${encodeURIComponent(query.trim())}`)
        .then(setResults)
        .catch((e) => toast.error(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [query, toast]);

  async function handleUpload(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    setUpload({ pct: 0, count: files.length });
    try {
      await uploadFiles(files, currentId, (pct) => setUpload({ pct, count: files.length }));
      toast.success(`Uploaded ${files.length} file${files.length > 1 ? 's' : ''}`);
      await load();
      refreshStorage();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUpload(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const changed = () => {
    load();
    refreshStorage();
  };

  const view = results || data;
  const folders = view?.folders || [];
  const files = view?.files || [];
  const empty = view && folders.length === 0 && files.length === 0;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleUpload(e.dataTransfer.files);
      }}
      className={`min-h-[60vh] rounded-xl ${dragging ? 'ring-2 ring-indigo-400 ring-offset-4' : ''}`}
    >
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input className={`${inputClass} pl-9`} placeholder="Search files and folders…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && (
            <button className="absolute right-2 top-2 text-slate-400" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>
        <Button variant="secondary" onClick={() => setModal({ type: 'newFolder' })}>
          <FolderPlus size={16} /> New folder
        </Button>
        <Button onClick={() => fileInput.current?.click()} loading={!!upload}>
          <Upload size={16} /> Upload
        </Button>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
      </div>

      {/* Breadcrumbs */}
      {!results && data && (
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm text-slate-600">
          <Link to="/" className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100"><Home size={15} /> My files</Link>
          {data.breadcrumbs.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-slate-400" />
              <Link to={`/folder/${b.id}`} className="rounded px-1.5 py-0.5 hover:bg-slate-100">{b.name}</Link>
            </span>
          ))}
        </nav>
      )}
      {results && <p className="mb-3 text-sm text-slate-500">{folders.length + files.length} result(s) for “{query}”</p>}

      {/* Upload progress */}
      {upload && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm">
          Uploading {upload.count} file{upload.count > 1 ? 's' : ''}… {upload.pct}%
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-100">
            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${upload.pct}%` }} />
          </div>
        </div>
      )}

      {loading && !data && <div className="flex justify-center py-20"><Spinner /></div>}
      {error && <ErrorBox message={error} onRetry={load} />}

      {empty && !results && (
        <EmptyState icon={FolderOpen} title="This folder is empty" text="Drag files here, or press Upload." />
      )}
      {empty && results && <EmptyState icon={Search} title="Nothing found" text="Try a different search." />}

      {view && !empty && (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {folders.map((f) => (
            <div key={`d${f.id}`} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => navigate(`/folder/${f.id}`)}>
                <Folder size={20} className="shrink-0 text-amber-500" />
                <span className="truncate text-sm font-medium">{f.name}</span>
              </button>
              <span className="hidden text-xs text-slate-400 sm:block">{formatDate(f.updatedAt)}</span>
              <div className="flex shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <IconBtn title="Rename" onClick={() => setModal({ type: 'rename', kind: 'folder', item: f })}><Pencil size={16} /></IconBtn>
                <IconBtn title="Move" onClick={() => setModal({ type: 'move', kind: 'folder', item: f })}><FolderInput size={16} /></IconBtn>
                <IconBtn title="Delete" danger onClick={() => setModal({ type: 'delete', kind: 'folder', item: f })}><Trash2 size={16} /></IconBtn>
              </div>
            </div>
          ))}
          {files.map((f) => (
            <div key={`f${f.id}`} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setModal({ type: 'preview', item: f })}>
                <span className="shrink-0">{iconFor(f.mimeType)}</span>
                <span className="truncate text-sm">{f.name}</span>
              </button>
              <span className="hidden w-20 text-right text-xs text-slate-400 sm:block">{formatBytes(f.size)}</span>
              <span className="hidden w-36 text-right text-xs text-slate-400 md:block">{formatDate(f.updatedAt)}</span>
              <div className="flex shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <IconBtn title="Download" href={fileUrl(f.id, 'download')}><Download size={16} /></IconBtn>
                <IconBtn title="Share" onClick={() => setModal({ type: 'share', item: f })}><Share2 size={16} /></IconBtn>
                <IconBtn title="Rename" onClick={() => setModal({ type: 'rename', kind: 'file', item: f })}><Pencil size={16} /></IconBtn>
                <IconBtn title="Move" onClick={() => setModal({ type: 'move', kind: 'file', item: f })}><FolderInput size={16} /></IconBtn>
                <IconBtn title="Delete" danger onClick={() => setModal({ type: 'delete', kind: 'file', item: f })}><Trash2 size={16} /></IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      {modal?.type === 'newFolder' && (
        <PromptDialog
          title="New folder"
          label="Folder name"
          confirmText="Create"
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            await api.post('/folders', { name, parentId: currentId });
            toast.success('Folder created');
            load();
          }}
        />
      )}
      {modal?.type === 'rename' && (
        <PromptDialog
          title={`Rename ${modal.kind}`}
          label="New name"
          initial={modal.item.name}
          confirmText="Rename"
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            await api.patch(`/${modal.kind === 'file' ? 'files' : 'folders'}/${modal.item.id}`, { name });
            toast.success('Renamed');
            changed();
          }}
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title={`Delete ${modal.kind}`}
          message={
            modal.kind === 'folder'
              ? `Delete “${modal.item.name}” and everything inside it? This cannot be undone.`
              : `Delete “${modal.item.name}”? This cannot be undone.`
          }
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await api.del(`/${modal.kind === 'file' ? 'files' : 'folders'}/${modal.item.id}`);
            toast.success('Deleted');
            changed();
          }}
        />
      )}
      {modal?.type === 'move' && (
        <MoveDialog kind={modal.kind} item={modal.item} onClose={() => setModal(null)} onMoved={() => { toast.success('Moved'); changed(); }} />
      )}
      {modal?.type === 'share' && <ShareDialog file={modal.item} onClose={() => setModal(null)} />}
      {modal?.type === 'preview' && <PreviewDialog file={modal.item} onClose={() => setModal(null)} />}
    </div>
  );
}
