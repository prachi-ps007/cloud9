import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Cloud, XCircle } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { deviceLabel } from '../util.js';
import { Spinner } from '../components/Modal.jsx';

// Opened on the phone after scanning the QR code
export default function Pair() {
  const [params] = useSearchParams();
  const { user, startSession } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);
  const code = params.get('code');

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; a code works only once
    started.current = true;
    if (!code) return setError('This link has no pairing code.');
    api
      .post('/pairing/claim', { code, deviceName: deviceLabel() })
      .then(startSession)
      .catch((e) => setError(e.message));
  }, [code, startSession]);

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <Cloud size={40} className="text-indigo-600" />
      {error ? (
        <>
          <XCircle size={32} className="text-red-500" />
          <p className="font-medium">{error}</p>
          <p className="text-sm text-slate-500">Generate a fresh QR code on your laptop and scan it again.</p>
        </>
      ) : (
        <>
          <Spinner />
          <p className="text-slate-600">Connecting this device to your Cloud9…</p>
        </>
      )}
    </div>
  );
}
