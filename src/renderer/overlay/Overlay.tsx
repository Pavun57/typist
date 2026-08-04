import { useEffect, useState } from 'react';
import type { StatePayload } from '../../shared/types';

export default function Overlay() {
  const [payload, setPayload] = useState<StatePayload>({ state: 'idle' });

  useEffect(() => window.typist.onStateChange(setPayload), []);

  if (payload.state === 'idle') return null;

  if (payload.state === 'recording') {
    return (
      <div
        className="pill recording"
        title="Click to cancel"
        onClick={() => void window.typist.cancelRecording()}
      >
        <span className="bars">
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="label">Listening…</span>
        <span className="cancel-hint">click to cancel</span>
      </div>
    );
  }

  if (payload.state === 'transcribing') {
    return (
      <div className="pill">
        <span className="ring" />
        <span className="label">Transcribing…</span>
      </div>
    );
  }

  if (payload.state === 'polishing') {
    return (
      <div className="pill">
        <svg className="spark" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
        </svg>
        <span className="label">Polishing with AI…</span>
      </div>
    );
  }

  if (payload.state === 'done') {
    return (
      <div className="pill done">
        <span className="label">✓ {payload.message ?? 'Done.'}</span>
      </div>
    );
  }

  return (
    <div className="pill error">
      <span className="label">{payload.message ?? 'Something went wrong.'}</span>
    </div>
  );
}
