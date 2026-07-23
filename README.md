# ⌨️ Typist

**Type with your voice. Anywhere. In 99+ languages.**

Typist is a **free, open-source alternative to Wispr Flow** — press a hotkey, speak, press it again, and your words appear wherever your cursor is. No subscriptions. No lock-in. Your voice, your machine, your choice of engine.

🌐 **Cloud or fully offline** · 🔒 **Privacy-first** · 💻 **Linux · macOS · Windows** · 📜 **MIT licensed**

---

## 🎬 Demo

<video src="https://github.com/Pavun57/typist/raw/main/demo-compressed.mp4" controls preload="metadata"></video>

Hotkey → speak → typed at your cursor. English and Tamil, fully offline.

---

## ✨ Why Typist?

- **⌨️ Global push-to-talk** — one hotkey (`Ctrl+Shift+Space` / `Cmd+Shift+Space`, configurable) starts and stops dictation from anywhere
- **🗣️ Truly multilingual** — auto-detect, or pin English, Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, or Odia
- **☁️ / 📴 Two STT engines, your choice**
  - **Sarvam AI (cloud)** — fast and excellent for Indian languages
  - **Local Whisper (offline)** — OpenAI Whisper running on your device; audio never leaves your machine
- **🎯 Types where your cursor is** — any app, any input field
- **📥 In-app model manager** — download, switch, and delete offline models from Settings; models auto-unload when idle
- **🔄 Auto-updates** — get notified in-app, one click to install
- **🧷 Tray app** — sits quietly in the system tray with a small status pill while you dictate
- **🔐 Private by design** — API key encrypted with your OS keychain; go offline and nothing leaves the device at all

---

## 📦 Download & install

Grab the latest package for your OS from [**Releases**](https://github.com/Pavun57/typist/releases):

| OS | Package | Notes |
| --- | --- | --- |
| 🪟 **Windows** | `Typist-Setup-<version>.exe` | Unsigned: click **More info → Run anyway** on SmartScreen |
| 🍎 **macOS** | `Typist-<version>.dmg` | Unsigned: right-click → **Open** the first time. Grant **Microphone** + **Accessibility** permissions |
| 🐧 **Linux** | `Typist-<version>.AppImage` / `.deb` | One-time input permission step below ⬇️ |

### 🐧 Linux: one-time input permission (required)

Typing into other apps goes through `/dev/uinput` via `ydotool`, and the Wayland clipboard via `wl-copy`:

```bash
sudo apt install ydotool wl-clipboard
sudo groupadd -f input
sudo usermod -aG input $USER
echo 'KERNEL=="uinput", GROUP="input", MODE="0660", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/85-uinput.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
sudo setfacl -m u:$USER:rw /dev/uinput   # applies immediately, no re-login
```

On X11, `xdotool` is used instead (`sudo apt install xdotool`) — no setup needed.

---

## 🧠 Choose your speech-to-text engine

Open **Settings** (right-click the tray icon) and pick under **Speech-to-text engine**.

### ☁️ Sarvam AI (cloud)

1. Go to [dashboard.sarvam.ai](https://dashboard.sarvam.ai/) and sign up / log in
2. Open **API Keys** → **Create new key** → copy it
3. Paste it into Typist Settings → click **Test key** ✔️

The key is stored only on your device, encrypted with the OS keychain.

### 📴 Local models (offline)

1. In Settings, choose the **Local** engine
2. Download a model (one-time). Two model families are available:

   | Model | Size | Best for |
   | --- | --- | --- |
   | **Dolphin Small (int8)** | ~239 MB | Fast CTC, 40 languages incl. **Tamil**, Hindi, Telugu, Marathi |
   | **Omnilingual ASR 300M (int8)** | ~348 MB | Meta's **1600-language** model, auto language ID |
   | **Whisper Base** | ~300 MB | Fastest Whisper, 99 languages |
   | **Whisper Small** | ~980 MB | Balanced Whisper |
   | **Whisper Large v3 Turbo** | ~3.2 GB | Best Whisper accuracy |

3. Click **Use** — done. Works fully offline.

Models load when you dictate and **unload automatically after 5 minutes idle**. Delete them anytime to free disk space. Offline models run via [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) and [transformers.js](https://huggingface.co/docs/transformers.js).

---

## 🚀 Usage

1. Click into any input box, in any app
2. Press the hotkey — the pill shows **Listening…** *(click the pill to cancel)*
3. Speak 🎙️
4. Press the hotkey again — the transcript is typed at your cursor ✍️

The transcript also stays on your clipboard, so `Ctrl+V` always works as a fallback.

---

## 🔄 Updates

Typist checks for new releases automatically and lets you know in Settings (**Restart & update** in one click). There's also **Check for Updates** in the tray menu.

- ✅ Auto-update: **Windows** and **Linux AppImage**
- ℹ️ **deb** builds: you'll be notified; install the new package over the old one
- ℹ️ **macOS**: auto-update needs a signed build; unsigned builds update via a fresh download

---

## 🛠️ Platform notes

- **macOS** — typing into other apps needs **Accessibility** (and possibly **Input Monitoring**) permission; recording needs **Microphone**
- **Linux Wayland** — use `ydotool` (KWin doesn't support `wtype`); hotkeys work via XWayland; non-Latin text is pasted, English is typed directly

---

## 👨‍💻 Build from source

Requires Node.js 20+:

```bash
git clone https://github.com/Pavun57/typist.git
cd typist
npm install
npm run dev      # develop with hot reload
npm run build    # typecheck + production build
npm run dist     # package installers for the current OS into dist/
```

Releases for all three OSes are built by GitHub Actions (`.github/workflows/release.yml`) — push a `v*` tag and the workflow builds Windows, macOS, and Linux packages and attaches them to a GitHub Release.

## 🏗️ Architecture

```
src/
  main/        Electron main process
    index.ts       bootstrap, tray, single-instance lock
    controller.ts  idle → recording → transcribing state machine, STT routing
    hotkey.ts      global shortcut registration
    sarvam.ts      Sarvam cloud STT client (+ API key validation)
    local-stt.ts   offline Whisper engine (download/delete, idle auto-unload)
    audio.ts       PCM → WAV encoding
    paste.ts       text insertion (ydotool/wtype/xdotool on Linux, nut.js elsewhere)
    settings.ts    electron-store, safeStorage-encrypted API key
    updater.ts     auto-updates via electron-updater + GitHub Releases
    ipc.ts         IPC handlers
    windows.ts     settings / overlay / recorder window factories
  preload/     contextBridge API (window.typist)
  renderer/
    settings/  React settings window (engine, API key, models, hotkey, updates)
    overlay/   frameless always-on-top status pill
    recorder/  hidden window owning the microphone (AudioWorklet, 16 kHz PCM)
  shared/      types shared between main, preload, and renderers
```

---

## 🤝 Contributing

Issues and pull requests are welcome at [github.com/Pavun57/typist](https://github.com/Pavun57/typist).

## 👤 Author

**Pavun** — [github.com/Pavun57](https://github.com/Pavun57) · [rpavun57@gmail.com](mailto:rpavun57@gmail.com)

Cloud speech-to-text by [Sarvam AI](https://www.sarvam.ai/) · offline speech-to-text by OpenAI Whisper via [transformers.js](https://huggingface.co/docs/transformers.js) (ONNX)

## 📜 License

[MIT](LICENSE) — free for everyone, forever.
