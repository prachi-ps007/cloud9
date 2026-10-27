import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Cloud, FolderOpen, HardDrive, Link2, LogOut, QrCode, Smartphone, Trash2, Waves } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { formatBytes } from '../util.js';
import PairPhoneModal from './PairPhoneModal.jsx';

const nav = [
  { to: '/', label: 'My files', short: 'Files', icon: FolderOpen, end: true },
  { to: '/shared', label: 'Shared links', short: 'Shared', icon: Link2 },
  { to: '/devices', label: 'Devices', short: 'Devices', icon: Smartphone },
  { to: '/storage', label: 'Storage', short: 'Storage', icon: HardDrive },
  { to: '/trash', label: 'Trash & recovery', short: 'Trash', icon: Trash2 },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [storage, setStorage] = useState(null);
  const [pairOpen, setPairOpen] = useState(false);

  const refreshStorage = useCallback(() => {
    api.get('/storage').then(setStorage).catch(() => {});
  }, []);

  useEffect(() => { refreshStorage(); }, [refreshStorage, location.pathname]);

  const link = ({ isActive }) => `c9-nav-link ${isActive ? 'active' : ''}`;

  return (
    <div className="c9-app-shell">
      <aside className="c9-sidebar">
        <div className="c9-brand">
          <span className="c9-brand-mark"><Waves size={23} /></span>
          <span>cloud<span className="c9-brand-nine">9</span><small>YOUR LITTLE CLOUD BY THE SEA</small></span>
        </div>
        <div className="c9-side-label">YOUR SPACE</div>
        <nav className="c9-nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={link}>
              <n.icon size={18} strokeWidth={1.9} /> <span>{n.label}</span>
              {n.to === '/trash' && <span className="c9-nav-dot" />}
            </NavLink>
          ))}
          <button onClick={() => setPairOpen(true)} className="c9-nav-link c9-connect">
            <QrCode size={18} strokeWidth={1.9} /> <span>Connect phone</span>
          </button>
        </nav>

        <div className="c9-sidebar-bottom">
          {storage && (
            <div className="c9-storage-card">
              <div className="c9-storage-heading"><span>Cloud capacity</span><Cloud size={15} /></div>
              <div className="c9-storage-track"><div className={`c9-storage-fill ${storage.usedPercent > 90 ? 'warning' : ''}`} style={{ width: `${Math.min(Math.max(storage.usedPercent, 1), 100)}%` }} /></div>
              <p>{formatBytes(storage.usedBytes)} <span>of {formatBytes(storage.limitBytes)}</span></p>
            </div>
          )}
          <div className="c9-user-row">
            <div className="c9-avatar">{(user?.username || 'C').slice(0, 1).toUpperCase()}</div>
            <div className="c9-user-info"><strong>{user.username}</strong><span>Beachside member</span></div>
            <button onClick={logout} title="Log out" className="c9-logout"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="c9-main">
        <header className="c9-mobile-header">
          <div className="c9-brand compact"><span className="c9-brand-mark"><Waves size={20} /></span><span>cloud<span className="c9-brand-nine">9</span></span></div>
          <button onClick={logout} className="c9-logout" title="Log out"><LogOut size={18} /></button>
        </header>
        <div className="c9-page-wrap">
          <div className="c9-welcome-strip"><span className="c9-sun">☀</span><span>A little sunshine for your files. Keep everything safe with CLOUD9.</span></div>
          <Outlet context={{ refreshStorage, openPair: () => setPairOpen(true) }} />
          <footer className="c9-footer"><span>☼</span> CLOUD9 <i>·</i> YOUR FILES, YOUR HORIZON</footer>
        </div>
      </main>

      <nav className="c9-mobile-nav">
        {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `c9-mobile-link ${isActive ? 'active' : ''}`}>
          <n.icon size={19} /><span>{n.short}</span>
        </NavLink>)}
      </nav>
      {pairOpen && <PairPhoneModal onClose={() => setPairOpen(false)} />}
    </div>
  );
}
