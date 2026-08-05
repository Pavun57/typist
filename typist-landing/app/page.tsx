const DEMO_VIDEO =
  'https://github.com/user-attachments/assets/2d584ae7-a1f0-4aac-a453-f9b99953dd2b';

const RELEASE = 'https://github.com/Pavun57/typist/releases/tag/v0.3.0';

const FEATURES = [
  {
    icon: '⌨️',
    title: 'Voice commands',
    body: (
      <>
        Say <em>&ldquo;send this&rdquo;</em> and your message is typed <em>and</em> sent.{' '}
        <em>&ldquo;Undo that&rdquo;</em>, <em>&ldquo;new line&rdquo;</em>,{' '}
        <em>&ldquo;select all&rdquo;</em> — keystrokes, not just words.
      </>
    ),
  },
  {
    icon: '🧠',
    title: 'Memory',
    body: (
      <>
        <em>&ldquo;Remember my address is X&rdquo;</em> — saved forever. Later,{' '}
        <em>&ldquo;type my address&rdquo;</em> drops it at your cursor. View and delete
        facts anytime.
      </>
    ),
  },
  {
    icon: '👁️',
    title: 'Screen-aware coding help',
    body: (
      <>
        <em>&ldquo;Solve this&rdquo;</em> screenshots the error and asks your local{' '}
        <span className="mono">claude</span> or <span className="mono">codex</span> CLI —
        no API key — then types the fix.
      </>
    ),
  },
  {
    icon: '🧭',
    title: 'Context-aware typing',
    body: 'Paragraphs in email, one casual line in chat, literal text in your IDE. Typist knows which app you are dictating into and formats for it.',
  },
  {
    icon: '🗣️',
    title: '99+ languages',
    body: 'Auto-detect, or pin English, Hindi, Tamil, Telugu, Bengali, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia, and more.',
  },
  {
    icon: '🔐',
    title: 'Private by design',
    body: 'Go fully offline and nothing leaves your machine. API keys are encrypted with your OS keychain. MIT licensed, forever.',
  },
];

const DEMOS = [
  {
    say: 'hey Pavun the meeting moved to 4, send this',
    does: (
      <>
        Types <strong>Hey Pavun, the meeting moved to 4.</strong> and presses Enter. Sent.
      </>
    ),
  },
  {
    say: 'remember my wifi password is blue turtle 42',
    does: (
      <>
        Saved. Later, <em>&ldquo;type my wifi password&rdquo;</em> types it at your cursor.
      </>
    ),
  },
  {
    say: 'undo that',
    does: (
      <>
        Presses Ctrl+Z. Also: <em>redo</em>, <em>select all</em>, <em>scratch that</em>,{' '}
        <em>new line</em>.
      </>
    ),
  },
  {
    say: 'solve this (error on screen)',
    does: (
      <>
        Reads the screen, asks Claude Code, types the fix:
        <code>const total = items.reduce((s, i) =&gt; s + i.price, 0)</code>
      </>
    ),
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Press the hotkey',
    body: 'From any app, any input field. A small pill shows Typist is listening — click it to cancel.',
  },
  {
    n: '02',
    title: 'Speak naturally',
    body: 'Dictate a message, a command, a fact to remember, or ask for help with what is on screen.',
  },
  {
    n: '03',
    title: 'Press again — done',
    body: 'The transcript is polished and typed at your cursor. It is on your clipboard too, just in case.',
  },
];

export default function Home() {
  return (
    <>
      <nav className="nav">
        <div className="wrap">
          <a className="logo" href="#">
            Typist<span className="dot">.</span>
          </a>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#engines">Engines</a>
            <a href="#how">How it works</a>
            <a href="https://github.com/Pavun57/typist">GitHub</a>
            <a className="btn btn-primary btn-sm" href="#download">
              Download
            </a>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <span className="chip">
            <span className="pulse" />
            v0.3.0 — free &amp; open source (MIT)
          </span>
          <h1>
            Type with your voice.
            <br />
            <span className="accent">Anywhere.</span>
          </h1>
          <p className="lede">
            Press <kbd>Ctrl+Shift+Space</kbd>, speak, press again — your words appear
            wherever your cursor is. 99+ languages, cloud or fully offline. No
            subscriptions, no lock-in.
          </p>
          <div className="cta">
            <a className="btn btn-primary" href="#download">
              Download for free
            </a>
            <a className="btn btn-ghost" href="https://github.com/Pavun57/typist">
              ★ Star on GitHub
            </a>
          </div>
          <p className="note">
            Linux · macOS · Windows — the open-source alternative to Wispr Flow
          </p>
          <div className="pill-demo">
            <span className="bars">
              <span />
              <span />
              <span />
              <span />
              <span />
            </span>
            Listening…
          </div>
          <video src={DEMO_VIDEO} controls preload="metadata" />
        </div>
      </header>

      <section id="features" className="section">
        <div className="wrap">
          <div className="section-label">More than dictation</div>
          <h2>A voice assistant that types, sends, remembers, and fixes your code.</h2>
          <div className="grid grid-3">
            {FEATURES.map((f) => (
              <div className="card" key={f.title}>
                <div className="icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="commands" className="section section-flush">
        <div className="wrap">
          <div className="section-label">Just say it</div>
          <h2>Talk like you normally would.</h2>
          <div className="demo-row">
            {DEMOS.map((d) => (
              <div className="demo" key={d.say}>
                <div className="say">
                  You say<span className="quote">&ldquo;{d.say}&rdquo;</span>
                </div>
                <div className="does">
                  <span className="arrow">→</span>
                  <span>{d.does}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="engines" className="section dark-band">
        <div className="wrap">
          <div className="section-label">Your engine, your choice</div>
          <h2>Cloud speed or total privacy. Switch anytime.</h2>
          <p className="section-lede">
            Two speech-to-text engines, plus an optional AI cleanup pass that fixes
            grammar, enhances prompts, and detects commands — via free-tier Groq,
            OpenRouter, or NVIDIA keys.
          </p>
          <div className="engine-cards">
            <div className="engine">
              <span className="badge">Cloud</span>
              <h3>Sarvam AI</h3>
              <p>Fast and excellent for Indian languages.</p>
              <ul>
                <li>
                  <strong>saarika:v2.5</strong> — built for Indic speech
                </li>
                <li>Long dictations auto-chunked</li>
                <li>Key stored encrypted in your OS keychain</li>
              </ul>
            </div>
            <div className="engine">
              <span className="badge">Offline</span>
              <h3>Local models</h3>
              <p>
                Audio never leaves your device. One-time download, auto-unload when idle.
              </p>
              <ul>
                <li>
                  <strong>Whisper</strong> Base / Small / Large v3 Turbo — 99 languages
                </li>
                <li>
                  <strong>Dolphin CTC</strong> — fast, strong on Tamil, Hindi, Telugu
                </li>
                <li>
                  <strong>Omnilingual 300M</strong> — Meta&rsquo;s 1600-language model
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="section">
        <div className="wrap">
          <div className="section-label">How it works</div>
          <h2>Three keys to a sent message.</h2>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.n}>
                <span className="n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="download" className="section section-flush">
        <div className="wrap">
          <div className="section-label">Download</div>
          <h2>Free forever. All platforms.</h2>
          <p className="section-lede">
            Grab v0.3.0 for your OS. Unsigned builds — one extra click to open the first
            time; instructions on the release page.
          </p>
          <div className="download-cards">
            <a
              className="dl"
              href="https://github.com/Pavun57/typist/releases/download/v0.3.0/Typist-Setup-0.3.0.exe"
            >
              <span className="os">🪟 Windows</span>
              <span className="file">Typist-Setup-0.3.0.exe</span>
              <span className="go">Download →</span>
            </a>
            <a
              className="dl"
              href="https://github.com/Pavun57/typist/releases/download/v0.3.0/Typist-0.3.0-arm64.dmg"
            >
              <span className="os">🍎 macOS</span>
              <span className="file">Typist-0.3.0-arm64.dmg</span>
              <span className="go">Download →</span>
            </a>
            <a className="dl" href={RELEASE}>
              <span className="os">🐧 Linux</span>
              <span className="file">AppImage · deb</span>
              <span className="go">Download →</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">
          <span>
            Made by <a href="https://github.com/Pavun57">Pavun</a> · MIT licensed · Cloud
            STT by Sarvam AI
          </span>
          <span>
            <a href="https://github.com/Pavun57/typist">GitHub</a> ·{' '}
            <a href="https://github.com/Pavun57/typist/issues">Issues</a> ·{' '}
            <a href="https://github.com/Pavun57/typist/releases">Releases</a>
          </span>
        </div>
      </footer>
    </>
  );
}
