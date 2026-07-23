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

  return (
    <div className="pill error">
      <span className="label">{payload.message ?? 'Something went wrong.'}</span>
    </div>
  );
}
