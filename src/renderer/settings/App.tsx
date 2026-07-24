import { useEffect, useState } from 'react';
import { AI_MODELS, LANGUAGES } from '../../shared/types';
import type {
  AiProviderId,
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

  const refreshStt = () => window.typist.getSttState().then(setStt);

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
    const offProgress = window.typist.onDownloadProgress((p) => {
      setDownloading((d) => ({ ...d, [p.modelId]: p.percent }));
    });
    const offUpdate = window.typist.onUpdateStatus(setUpdate);
    return () => {
      offProgress();
      offUpdate();
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
    available: `Update ${update.version ?? ''} available — downloading…`,
    downloading: `Downloading update… ${update.percent ?? 0}%`,
    ready: `Update ${update.version ?? ''} ready to install.`,
    none: 'You are on the latest version.',
    error: update.message ?? 'Update check failed.',
  };

  return (
    <div className="app">
      <header className="brand">
        <h1 className="wordmark">
          Typist<span className="dot">.</span>
        </h1>
        <p className="tagline">Voice typing, anywhere</p>
        <p className="subtitle">
          Press <kbd>{hotkey}</kbd> anywhere to start dictating, press again to
          stop — the transcript is typed where your cursor is.
        </p>
      </header>

      <div className="field">
        <label>Speech-to-text engine</label>
        <label className="checkbox">
          <input
            type="radio"
            name="provider"
            checked={stt.provider === 'sarvam'}
            onChange={() => void pickProvider('sarvam')}
          />
          Sarvam AI (cloud, best for Indian languages)
        </label>
        <label className="checkbox">
          <input
            type="radio"
            name="provider"
            checked={stt.provider === 'local'}
            onChange={() => void pickProvider('local')}
          />
          Local Whisper (offline, runs on this device)
        </label>
      </div>

      {stt.provider === 'sarvam' && (
        <div className="field">
          <label htmlFor="apikey">Sarvam API key</label>
          <div className="row">
            <input
              id="apikey"
              type="password"
              style={{ flex: 1 }}
              placeholder="api-subscription-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button className="secondary" onClick={testKey} disabled={testing}>
              {testing ? 'Testing…' : 'Test key'}
            </button>
          </div>
          <span className="hint">
            Get a key at dashboard.sarvam.ai — it is stored encrypted on this device.
          </span>
          {keyStatus && (
            <span className={`status ${keyStatus.ok ? 'ok' : 'err'}`}>
              {keyStatus.message}
            </span>
          )}
        </div>
      )}

      {stt.provider === 'local' && (
        <div className="field">
          <label>Local models</label>
          <span className="hint">
            Downloaded once, then work fully offline. The model loads when you dictate
            and unloads automatically after 5 minutes idle.
          </span>
          {stt.models.map((m) => (
            <div key={m.id} className={`model-card${m.active ? ' active' : ''}`}>
              <div className="model-info">
                <strong>{m.label}</strong>
                <span className="hint">
                  ~{m.sizeMB}&nbsp;MB · {m.note}
                </span>
              </div>
              {m.id in downloading ? (
                <span className="percent">{downloading[m.id]}%</span>
              ) : m.downloaded ? (
                <div className="row">
                  {m.active ? (
                    <span className="status ok">Active</span>
                  ) : (
                    <button className="secondary" onClick={() => void pickModel(m.id)}>
                      Use
                    </button>
                  )}
                  <button className="secondary" onClick={() => void remove(m)}>
                    Delete
                  </button>
                </div>
              ) : (
                <button className="secondary" onClick={() => void download(m)}>
                  Download
                </button>
              )}
            </div>
          ))}
          {modelMsg && <span className="status">{modelMsg}</span>}
        </div>
      )}

      <div className="field">
        <label>AI cleanup (optional)</label>
        <span className="hint">
          After transcription, an LLM detects intent: prompts meant for an AI
          get enhanced, messages to people get grammar fixes only.
        </span>
        {(['none', 'groq', 'openrouter', 'nvidia'] as const).map((p) => (
          <label className="checkbox" key={p}>
            <input
              type="radio"
              name="aiProvider"
              checked={aiProvider === p}
              onChange={() => {
                setAiProvider(p);
                setAiKeyStatus(null);
                if (p !== 'none') loadAiModels(p);
              }}
            />
            {p === 'none'
              ? 'Off'
              : p === 'groq'
                ? 'Groq (free tier)'
                : p === 'openrouter'
                  ? 'OpenRouter (free models)'
                  : 'NVIDIA NIM (free tier)'}
          </label>
        ))}
      </div>

      {aiProvider !== 'none' && (
        <>
          <div className="field">
            <label htmlFor="aikey">
              {aiProvider === 'groq'
                ? 'Groq'
                : aiProvider === 'nvidia'
                  ? 'NVIDIA'
                  : 'OpenRouter'}{' '}
              API key
            </label>
            <div className="row">
              <input
                id="aikey"
                type="password"
                style={{ flex: 1 }}
                placeholder="API key"
                value={aiKeyFor(aiProvider)}
                onChange={(e) => setAiKeyFor(aiProvider, e.target.value)}
              />
              <button className="secondary" onClick={testAiKey} disabled={testingAi}>
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
          </div>

          <div className="field">
            <label htmlFor="aimodel">Model</label>
            <input
              id="aimodel"
              type="text"
              list="ai-models"
              placeholder="Model ID"
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
            <span className="hint">
              Models are fetched live from the provider — pick one or type any
              model ID. Leave empty for the default.
            </span>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={translateToEnglish}
              onChange={(e) => setTranslateToEnglish(e.target.checked)}
            />
            Translate to English — output fluent English (tone-matched messages,
            structured prompts) instead of the spoken language
          </label>
        </>
      )}

      <div className="field">
        <label htmlFor="language">Spoken language</label>
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
      </div>

      <div className="field">
        <label htmlFor="hotkey">Hotkey</label>
        <input
          id="hotkey"
          type="text"
          readOnly
          value={capturing ? 'Press your shortcut…' : hotkey}
          onFocus={() => setCapturing(true)}
          onBlur={() => setCapturing(false)}
          onKeyDown={onHotkeyKeyDown}
        />
        <span className="hint">
          Click the box and press the new shortcut (needs a modifier like Ctrl/Alt/Shift).
        </span>
        {hotkeyStatus && (
          <span className={`status ${hotkeyStatus.ok ? 'ok' : 'err'}`}>
            {hotkeyStatus.message}
          </span>
        )}
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={launchAtLogin}
          onChange={(e) => setLaunchAtLogin(e.target.checked)}
        />
        Launch Typist at login
      </label>

      <div className="field">
        <label>Updates</label>
        <div className="row">
          <button className="secondary" onClick={() => void window.typist.checkForUpdates()}>
            Check for updates
          </button>
          {update.state === 'ready' && (
            <button onClick={() => void window.typist.installUpdate()}>
              Restart &amp; update
            </button>
          )}
        </div>
        {update.state !== 'idle' && (
          <span className={`status ${update.state === 'error' ? 'err' : ''}`}>
            {updateText[update.state]}
          </span>
        )}
      </div>

      <div className="footer">
        {saved && <span className="status ok">Saved.</span>}
        <button onClick={save}>Save</button>
      </div>

      <div className="madeby">
        Made by <strong>Pavun</strong>
      </div>
    </div>
  );
}
