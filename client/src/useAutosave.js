import { useCallback, useEffect, useRef, useState } from 'react';

const DELAY_MS = 800;

// Collects field changes and sends them in one PATCH after the user pauses.
// Returns a status string the UI can show: idle | pending | saving | saved | error.
export default function useAutosave(save) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const pending = useRef({});
  const timer = useRef(null);
  const inFlight = useRef(Promise.resolve());

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const changes = pending.current;
    if (Object.keys(changes).length === 0) return inFlight.current;
    pending.current = {};

    // Chain saves so an older request can never land after a newer one.
    inFlight.current = inFlight.current.then(async () => {
      setStatus('saving');
      try {
        await save(changes);
        if (Object.keys(pending.current).length === 0) setStatus('saved');
        setError('');
      } catch (err) {
        // Put the changes back so the next edit (or retry) includes them.
        pending.current = { ...changes, ...pending.current };
        setStatus('error');
        setError(err.message);
      }
    });
    return inFlight.current;
  }, [save]);

  const queue = useCallback((changes) => {
    pending.current = { ...pending.current, ...changes };
    setStatus('pending');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DELAY_MS);
  }, [flush]);

  useEffect(() => {
    const warn = (e) => {
      if (Object.keys(pending.current).length) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      flush(); // save whatever is left when leaving the editor
    };
  }, [flush]);

  return { status, error, queue, flush };
}
