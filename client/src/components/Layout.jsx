import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Cloud, FolderOpen, HardDrive, Link2, LogOut, QrCode, Smartphone, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { formatBytes } from '../util.js';
import PairPhoneModal from './PairPhoneModal.jsx';

const nav = [
  { to: '/', label: 'Files', icon: FolderOpen, end: true },
  { to: '/shared', label: 'Shared links', icon: Link2 },
  { to: '/devices', label: 'Devices', icon: Smartphone },
  { to: '/storage', label: 'Storage', icon: HardDrive },
  { to: '/trash', label: 'Trash', icon: Trash2 },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [storage, setStorage] = useState(null);
  const [pairOpen, setPairOpen] = useState(false);

  const refreshStorage = useCallback(() => {
    api.get('/storage').then(setStorage).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStorage();
  }, [refreshStorage, location.pathname]);

  const link = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2 text-xl font-bold text-indigo-600">
          <Cloud /> Cloud9
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={link}>
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
          <button
            onClick={() => setPairOpen(true)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <QrCode size={18} /> Connect phone
          </button>
        </nav>

        <div className="mt-auto space-y-4">
          {storage && (
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full ${storage.usedPercent > 90 ? 'bg-red-500' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.max(storage.usedPercent, 1)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {formatBytes(storage.usedBytes)} of {formatBytes(storage.limitBytes)} used
              </p>
            </div>
          )}
          <div className="flex items-center justify-between px-2 text-sm">
            <span className="truncate font-medium">{user.username}</span>
            <button onClick={logout} title="Log out" className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-20 md:pb-0">
        {/* Top bar (mobile) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="flex items-center gap-2 font-bold text-indigo-600">
            <Cloud size={20} /> Cloud9
          </span>
          <button onClick={logout} className="text-slate-500" title="Log out">
            <LogOut size={18} />
          </button>
        </div>
        <div className="mx-auto max-w-5xl p-4 md:p-8">
          <Outlet context={{ refreshStorage, openPair: () => setPairOpen(true) }} />
        </div>
      </main>

      {/* Bottom tabs (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white md:hidden">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-indigo-600' : 'text-slate-500'}`
            }
          >
            <n.icon size={20} /> {n.label.split(' ')[0]}
          </NavLink>
        ))}
      </nav>

      {pairOpen && <PairPhoneModal onClose={() => setPairOpen(false)} />}
    </div>
  );
}
