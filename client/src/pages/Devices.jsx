import { useCallback, useEffect, useState } from 'react';
import { Monitor, QrCode, Smartphone } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../toast.jsx';
import { formatDate } from '../util.js';
import { Button, EmptyState, ErrorBox, Spinner } from '../components/Modal.jsx';
import { ConfirmDialog } from '../components/FileDialogs.jsx';
import PairPhoneModal from '../components/PairPhoneModal.jsx';

const isPhone = (name) => /phone|android|ipad|iphone|paired/i.test(name);

export default function Devices() {
  const toast = useToast();
  const [devices, setDevices] = useState(null);
  const [error, setError] = useState('');
  const [revoke, setRevoke] = useState(null);
  const [pairOpen, setPairOpen] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.get('/auth/devices').then((d) => setDevices(d.devices)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Devices</h1>
        <Button onClick={() => setPairOpen(true)}><QrCode size={16} /> Connect phone</Button>
      </div>
      <p className="text-sm text-slate-500">Every browser and phone logged in to your cloud. Removing a device logs it out immediately.</p>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!devices && !error && <div className="flex justify-center py-16"><Spinner /></div>}
      {devices && devices.length === 0 && <EmptyState icon={Smartphone} title="No devices" />}

      {devices && (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              {isPhone(d.name) ? <Smartphone size={22} className="text-indigo-500" /> : <Monitor size={22} className="text-slate-500" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {d.name} {d.current && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">This device</span>}
                </p>
                <p className="text-xs text-slate-400">Last active {formatDate(d.lastUsedAt)}</p>
              </div>
              {!d.current && <Button variant="secondary" onClick={() => setRevoke(d)}>Remove</Button>}
            </div>
          ))}
        </div>
      )}

      {revoke && (
        <ConfirmDialog
          title="Remove device"
          message={`Log out “${revoke.name}”? It will need to sign in or pair again.`}
          confirmText="Remove"
          onClose={() => setRevoke(null)}
          onConfirm={async () => {
            await api.del(`/auth/devices/${revoke.id}`);
            toast.success('Device removed');
            load();
          }}
        />
      )}
      {pairOpen && <PairPhoneModal onClose={() => setPairOpen(false)} onPaired={load} />}
    </div>
  );
}
