import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { Modal, Spinner, ErrorBox, Button } from './Modal.jsx';
import { copyText } from '../util.js';
import { useToast } from '../toast.jsx';

export default function PairPhoneModal({ onClose, onPaired }) {
  const toast = useToast();
  const [pairing, setPairing] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('pending');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPairing(null);
    setError('');
    setStatus('pending');
    api
      .post('/pairing/create')
      .then((p) => !cancelled && setPairing(p))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // poll until the phone claims the code, and run the countdown
  useEffect(() => {
    if (!pairing || status !== 'pending') return;
    const poll = setInterval(async () => {
      try {
        const s = await api.get(`/pairing/${pairing.code}/status`);
        if (s.status !== 'pending') {
          setStatus(s.status);
          if (s.status === 'claimed') {
            toast.success('Phone connected!');
            onPaired?.();
          }
        }
      } catch {
        /* keep trying */
      }
    }, 2000);
    const tick = setInterval(() => {
      const left = Math.max(0, Math.round((pairing.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setStatus('expired');
    }, 500);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [pairing, status, toast, onPaired]);

  return (
    <Modal title="Connect your phone" onClose={onClose}>
      {error && <ErrorBox message={error} onRetry={() => setAttempt((a) => a + 1)} />}
      {!error && !pairing && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {pairing && status === 'pending' && (
        <div className="text-center">
          <img src={pairing.qrDataUrl} alt="QR code" className="mx-auto h-56 w-56 rounded-lg border border-slate-200" />
          <p className="mt-3 text-sm text-slate-600">
            Scan with your phone camera. Your phone must be on the same Wi-Fi as this laptop.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </p>
          <button
            className="mt-3 text-xs text-indigo-600 underline"
            onClick={async () => toast.success((await copyText(pairing.url)) ? 'Link copied' : 'Copy failed')}
          >
            Or copy the link
          </button>
        </div>
      )}
      {status === 'claimed' && (
        <div className="py-6 text-center">
          <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
          <p className="mt-3 font-medium">Phone connected</p>
          <Button className="mt-4" onClick={onClose}>
            Done
          </Button>
        </div>
      )}
      {status === 'expired' && (
        <div className="py-6 text-center">
          <p className="text-slate-600">This QR code expired.</p>
          <Button className="mt-4" onClick={() => setAttempt((a) => a + 1)}>
            Generate a new one
          </Button>
        </div>
      )}
    </Modal>
  );
}
