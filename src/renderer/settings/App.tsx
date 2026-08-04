import { useEffect, useState } from 'react';
import { AI_MODELS, LANGUAGES } from '../../shared/types';
import type {
  AiProviderId,
  AppState,
  MemoryEntry,
  ModelInfo,
  Settings,
  SttState,
  UpdateStatus,
} from '../../shared/types';

/** Builds an Electron accelerator string from a keydown event. */
function acceleratorFromEvent(e: React.KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Control');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Super');

  const key = e.key;
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return null; // modifier-only

  let normalized: string;
  if (key === ' ') normalized = 'Space';
  else if (key.length === 1) normalized = key.toUpperCase();
  else normalized = key; // F1..F24, Enter, Tab, ArrowUp, etc.

  if (parts.length === 0) return null; // require at least one modifier
  return [...parts, normalized].join('+');
}

/** Status chip next to the wordmark, mirrors the controller state. */
const CHIP_LABEL: Record<AppState, string> = {
  idle: 'agent ready',
  recording: 'listening',
  transcribing: 'transcribing',
  polishing: 'polishing',
  done: 'done',
  error: 'needs attention',
};

export default function App() {
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [stt, setStt] = useState<SttState | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [language, setLanguage] = useState('unknown');
  const [hotkey, setHotkey] = useState('');
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [hotkeyStatus, setHotkeyStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const [modelMsg, setModelMsg] = useState('');
  const [update, setUpdate] = useState<UpdateStatus>({ state: 'idle' });
  const [aiProvider, setAiProvider] = useState<AiProviderId>('none');
  const [aiModel, setAiModel] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [nvidiaApiKey, setNvidiaApiKey] = useState('');
  const [translateToEnglish, setTranslateToEnglish] = useState(false);
  const [aiKeyStatus, setAiKeyStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingAi, setTestingAi] = useState(false);
  const [aiModels, setAiModels] = useState<{ id: string; label: string }[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [appState, setAppState] = useState<AppState>('idle');

  const refreshStt = () => window.typist.getSttState().then(setStt);
  const refreshMemories = () => window.typist.getMemories().then(setMemories);

  const loadAiModels = (provider: 'groq' | 'openrouter' | 'nvidia') => {
    window.typist
      .fetchAiModels(provider)
      .then((models) => {
        setAiModels(models.length > 0 ? models : AI_MODELS[provider]);
      })
      .catch(() => setAiModels(AI_MODELS[provider]));
  };

  const aiKeyFor = (p: 'groq' | 'openrouter' | 'nvidia'): string =>
    p === 'groq' ? groqApiKey : p === 'nvidia' ? nvidiaApiKey : openrouterApiKey;

  const setAiKeyFor = (p: 'groq' | 'openrouter' | 'nvidia', v: string): void => {
    if (p === 'groq') setGroqApiKey(v);
    else if (p === 'nvidia') setNvidiaApiKey(v);
    else setOpenrouterApiKey(v);
  };

  useEffect(() => {
    void window.typist.getSettings().then((s) => {
      setSettingsState(s);
      setApiKey(s.apiKey);
      setLanguage(s.language);
      setHotkey(s.hotkey);
      setLaunchAtLogin(s.launchAtLogin);
      setAiProvider(s.aiProvider);
      setAiModel(s.aiModel);
      setGroqApiKey(s.groqApiKey);
      setOpenrouterApiKey(s.openrouterApiKey);
      setNvidiaApiKey(s.nvidiaApiKey);
      setTranslateToEnglish(s.translateToEnglish);
      if (s.aiProvider !== 'none') loadAiModels(s.aiProvider);
    });
    void refreshStt();
    void refreshMemories();
    const offProgress = window.typist.onDownloadProgress((p) => {
      setDownloading((d) => ({ ...d, [p.modelId]: p.percent }));
    });
    const offUpdate = window.typist.onUpdateStatus(setUpdate);
    const offState = window.typist.onStateChange((p) => setAppState(p.state));
    // Facts can be added by voice while this window is open.
    const onFocus = () => void refreshMemories();
    window.addEventListener('focus', onFocus);
    return () => {
      offProgress();
      offUpdate();
      offState();
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!settings || !stt) return <div className="app">Loading…</div>;

  const save = async () => {
    const s = await window.typist.setSettings({
      apiKey,
      language,
      launchAtLogin,
      aiProvider,
      aiModel,
      groqApiKey,
      openrouterApiKey,
      nvidiaApiKey,
      translateToEnglish,
    });
    setSettingsState(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testKey = async () => {
    setTesting(true);
    setKeyStatus(null);
    const result = await window.typist.validateApiKey(apiKey);
    setKeyStatus(result);
    setTesting(false);
  };

  const testAiKey = async () => {
    if (aiProvider === 'none') return;
    setTestingAi(true);
    setAiKeyStatus(null);
    const key = aiKeyFor(aiProvider);
    const result = await window.typist.validateAiKey(aiProvider, key);
    setAiKeyStatus(result);
    setTestingAi(false);
    if (result.ok) {
      // Persist the key so the main process can use it, then load models.
      await window.typist.setSettings({ [`${aiProvider}ApiKey`]: key });
      loadAiModels(aiProvider);
    }
  };

  const onHotkeyKeyDown = async (e: React.KeyboardEvent) => {
    e.preventDefault();
    const accel = acceleratorFromEvent(e);
    if (!accel) return;
    const result = await window.typist.setHotkey(accel);
    setHotkeyStatus(result);
    if (result.ok) setHotkey(accel);
    setCapturing(false);
  };

  const pickProvider = async (provider: 'sarvam' | 'local') => {
    await window.typist.setSttProvider(provider);
    await refreshStt();
  };

  const pickModel = async (modelId: string) => {
    await window.typist.setSttProvider('local', modelId);
    await refreshStt();
  };

  const download = async (model: ModelInfo) => {
    setModelMsg('');
    setDownloading((d) => ({ ...d, [model.id]: 0 }));
    const result = await window.typist.downloadModel(model.id);
    setDownloading((d) => {
      const next = { ...d };
      delete next[model.id];
      return next;
    });
    setModelMsg(result.message);
    await refreshStt();
    if (result.ok) await pickModel(model.id);
  };

  const remove = async (model: ModelInfo) => {
    setModelMsg('');
    const result = await window.typist.deleteModel(model.id);
    setModelMsg(result.message);
    await refreshStt();
  };

  const updateText: Record<string, string> = {
    idle: '',
    checking: 'Checking for updates…',
    available:
      update.message ??
      `Update ${update.version ?? ''} available — downloading…`,
    downloading: `Downloading update… ${update.percent ?? 0}%`,
    ready: `Update ${update.version ?? ''} ready to install.`,
    installing: 'Installing update… the app will restart in a moment.',
    none: 'You are on the latest version.',
    error: update.message ?? 'Update check failed.',
  };

  const aiChoices: { id: AiProviderId; name: string; meta: string; badge?: string }[] = [
    { id: 'none', name: 'Off', meta: 'Raw transcript' },
    { id: 'groq', name: 'Groq', meta: 'Llama, Gemma', badge: 'free' },
    { id: 'openrouter', name: 'OpenRouter', meta: 'Many models', badge: 'free' },
    { id: 'nvidia', name: 'NVIDIA NIM', meta: 'Llama, Gemma', badge: 'free' },
  ];

  return (
    <div className="app">
      <header className="brand">
        <div>
          <h1 className="wordmark">
            Typist<span className="dot">.</span>
          </h1>
          <p className="tagline">Voice typing, anywhere</p>
        </div>
        <span className={`status-chip${appState !== 'idle' ? ' busy' : ''}`}>
          <span className="pulse" />
          {CHIP_LABEL[appState]}
        </span>
      </header>

      <p className="subtitle">
        Press <kbd>{hotkey}</kbd> anywhere to dictate. Say <em>“send this”</em> to
        fire it off, or <em>“remember my address is…”</em> to teach me.
      </p>

      <div className="body">
        <section className="section">
          <div className="section-label">Speech engine</div>
          <div className="choice-grid">
            <div
              className={`choice${stt.provider === 'sarvam' ? ' selected' : ''}`}
              onClick={() => void pickProvider('sarvam')}
            >
              <div className="name">
                Sarvam AI <span className="badge">cloud</span>
              </div>
              <div className="meta">Best for Indian languages</div>
            </div>
            <div
              className={`choice${stt.provider === 'local' ? ' selected' : ''}`}
              onClick={() => void pickProvider('local')}
            >
              <div className="name">
                Local Whisper <span className="badge">offline</span>
              </div>
              <div className="meta">Never leaves this device</div>
            </div>
          </div>

          {stt.provider === 'sarvam' && (
            <div style={{ marginTop: 12 }}>
              <div className="row">
                <input
                  id="apikey"
                  type="password"
                  className="grow"
                  placeholder="Sarvam API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button className="btn-ghost" onClick={testKey} disabled={testing}>
                  {testing ? 'Testing…' : 'Test key'}
                </button>
              </div>
              <span className="hint">
                Get a key at dashboard.sarvam.ai — stored encrypted on this device.
              </span>
              {keyStatus && (
                <span className={`status ${keyStatus.ok ? 'ok' : 'err'}`}>
                  {keyStatus.message}
                </span>
              )}
            </div>
          )}

          {stt.provider === 'local' && (
            <div style={{ marginTop: 4 }}>
              <span className="hint">
                Downloaded once, then work fully offline. Models load when you
                dictate and unload after 5 minutes idle.
              </span>
              {stt.models.map((m) => (
                <div key={m.id} className={`card${m.active ? ' active' : ''}`}>
                  <div className="info">
                    <strong>{m.label}</strong>
                    <span>
                      ~{m.sizeMB}&nbsp;MB · {m.note}
                    </span>
                  </div>
                  {m.id in downloading ? (
                    <span className="percent">{downloading[m.id]}%</span>
                  ) : m.downloaded ? (
                    <div className="actions">
                      {m.active ? (
                        <span className="active-tag">Active</span>
                      ) : (
                        <button className="btn-ghost" onClick={() => void pickModel(m.id)}>
                          Use
                        </button>
                      )}
                      <button className="btn-ghost" onClick={() => void remove(m)}>
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="actions">
                      <button className="btn-ghost" onClick={() => void download(m)}>
                        Download
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {modelMsg && <span className="status">{modelMsg}</span>}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-label">AI cleanup</div>
          <div className="choice-grid">
            {aiChoices.map((c) => (
              <div
                key={c.id}
                className={`choice${aiProvider === c.id ? ' selected' : ''}`}
                onClick={() => {
                  setAiProvider(c.id);
                  setAiKeyStatus(null);
                  if (c.id !== 'none') loadAiModels(c.id);
                }}
              >
                <div className="name">
                  {c.name} {c.badge && <span className="badge">{c.badge}</span>}
                </div>
                <div className="meta">{c.meta}</div>
              </div>
            ))}
          </div>
          <span className="hint">
            Detects intent: prompts get enhanced, messages get grammar fixes,
            commands get executed.
          </span>

          {aiProvider !== 'none' && (
            <div style={{ marginTop: 12 }}>
              <div className="row">
                <input
                  id="aikey"
                  type="password"
                  className="grow"
                  placeholder={`${aiProvider === 'groq' ? 'Groq' : aiProvider === 'nvidia' ? 'NVIDIA' : 'OpenRouter'} API key`}
                  value={aiKeyFor(aiProvider)}
                  onChange={(e) => setAiKeyFor(aiProvider, e.target.value)}
                />
                <button className="btn-ghost" onClick={testAiKey} disabled={testingAi}>
                  {testingAi ? 'Testing…' : 'Test key'}
                </button>
              </div>
              <span className="hint">
                {aiProvider === 'groq'
                  ? 'Free key at console.groq.com → API Keys.'
                  : aiProvider === 'nvidia'
                    ? 'Free key at build.nvidia.com → any model → Get API Key.'
                    : 'Free key at openrouter.ai → Keys.'}
              </span>
              {aiKeyStatus && (
                <span className={`status ${aiKeyStatus.ok ? 'ok' : 'err'}`}>
                  {aiKeyStatus.message}
                </span>
              )}

              <div style={{ marginTop: 10 }}>
                <input
                  id="aimodel"
                  type="text"
                  list="ai-models"
                  placeholder="Model ID (empty = default)"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                />
                <datalist id="ai-models">
                  {(aiModels.length > 0 ? aiModels : AI_MODELS[aiProvider]).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </datalist>
              </div>

              <label className="check">
                <input
                  type="checkbox"
                  checked={translateToEnglish}
                  onChange={(e) => setTranslateToEnglish(e.target.checked)}
                />
                Translate everything to English
              </label>
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-label">Memory</div>
          {memories.length === 0 ? (
            <span className="hint">
              Nothing saved yet. Say “remember my address is …” while dictating,
              then “type my address” to use it.
            </span>
          ) : (
            <>
              {memories.map((m) => (
                <div key={m.key} className="card">
                  <div className="info">
                    <strong className="memory-key">{m.key}</strong>
                    <span>{m.value}</span>
                  </div>
                  <div className="actions">
                    <button
                      className="btn-ghost"
                      onClick={() =>
                        void window.typist.deleteMemory(m.key).then(refreshMemories)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              <div className="row" style={{ marginTop: 8 }}>
                <button
                  className="btn-ghost"
                  onClick={() =>
                    void window.typist.clearMemories().then(refreshMemories)
                  }
                >
                  Clear all
                </button>
              </div>
            </>
          )}
        </section>

        <section className="section">
          <div className="section-label">Language</div>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="hint">Auto-detect works across all supported languages.</span>
        </section>

        <section className="section">
          <div className="section-label">Hotkey</div>
          <div className={`hotkey-box${capturing ? ' capturing' : ''}`}>
            <input
              id="hotkey"
              type="text"
              readOnly
              value={capturing ? 'Press your shortcut…' : hotkey}
              onFocus={() => setCapturing(true)}
              onBlur={() => setCapturing(false)}
              onKeyDown={onHotkeyKeyDown}
            />
            <span className="edit">{capturing ? 'listening…' : 'click to change'}</span>
          </div>
          {hotkeyStatus && (
            <span className={`status ${hotkeyStatus.ok ? 'ok' : 'err'}`}>
              {hotkeyStatus.message}
            </span>
          )}
        </section>

        <section className="section">
          <div className="section-label">General</div>
          <label className="check">
            <input
              type="checkbox"
              checked={launchAtLogin}
              onChange={(e) => setLaunchAtLogin(e.target.checked)}
            />
            Launch Typist at login
          </label>
        </section>

        <section className="section">
          <div className="section-label">Updates</div>
          <div className="row">
            <button className="btn-ghost" onClick={() => void window.typist.checkForUpdates()}>
              Check for updates
            </button>
            {update.state === 'ready' && (
              <button className="btn-primary" onClick={() => void window.typist.installUpdate()}>
                Restart &amp; update
              </button>
            )}
            {update.state === 'available' && update.message && (
              <button className="btn-primary" onClick={() => void window.typist.installUpdate()}>
                Update now
              </button>
            )}
            {update.state !== 'idle' && update.state !== 'ready' && (
              <span
                className={`status ${update.state === 'error' ? 'err' : 'ok'}`}
                style={{ margin: 0 }}
              >
                {updateText[update.state]}
              </span>
            )}
          </div>
          {(update.state === 'ready' || (update.state === 'available' && update.message)) && (
            <span className="status ok">{updateText[update.state]}</span>
          )}
        </section>
      </div>

      <footer className="footer">
        <span className="madeby">
          Made by <strong>Pavun</strong>
        </span>
        <div className="save-area">
          {saved && <span className="status ok">Saved.</span>}
          <button className="btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </footer>
    </div>
  );
}
