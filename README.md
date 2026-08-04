# ⌨️ Typist

**Type with your voice. Anywhere. In 99+ languages.**

Typist is a **free, open-source alternative to Wispr Flow** — press a hotkey, speak, press it again, and your words appear wherever your cursor is. No subscriptions. No lock-in. Your voice, your machine, your choice of engine.

🌐 **Cloud or fully offline** · 🔒 **Privacy-first** · 💻 **Linux · macOS · Windows** · 📜 **MIT licensed**

---

## 🎬 Demo

<video src="https://github.com/user-attachments/assets/2d584ae7-a1f0-4aac-a453-f9b99953dd2b" controls preload="metadata"></video>

Hotkey → speak → typed at your cursor. English and Tamil, fully offline.

---

## ✨ Why Typist?

- **⌨️ Global push-to-talk** — one hotkey (`Ctrl+Shift+Space` / `Cmd+Shift+Space`, configurable) starts and stops dictation from anywhere
- **🗣️ Truly multilingual** — auto-detect, or pin English, Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, or Odia
- **🎛️ Voice commands, not just dictation** — say "send this" to type *and* hit Enter, "undo that" for Ctrl+Z, "new line", "select all", and more
- **🧭 Context-aware typing** — knows whether you're in an email client, a chat app, or a code editor, and formats accordingly (paragraphs for email, one casual line for chat, literal in code)
- **🧠 Memory** — "remember my address is …" saves a fact; later "type my address" drops it right in. Manage saved facts in Settings
- **👁️ Screen-aware coding help** — "solve this" / "fix this error" screenshots the active window and asks your **local Claude Code or Codex CLI** (no API key) or a cloud vision model. Answers are typed into editors, pasted into terminals
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
| 🍎 **macOS** | `Typist-<version>.dmg` | Unsigned — see the Gatekeeper note below ⬇️ |
| 🐧 **Linux** | `Typist-<version>.AppImage` / `.deb` | One-time input permission step below ⬇️ |

> **🍎 macOS: "Typist is damaged and can't be opened"**
>
> The app isn't damaged — macOS quarantines unsigned apps. Three ways to fix it (once, permanent):
>
> **Right-click** (easiest): right-click **Typist.app** instead of double-clicking →
> choose **Open** → click **Open** again if prompted.
>
> **Terminal** (after dragging Typist to **Applications**):
>
> ```bash
> sudo xattr -cr /Applications/Typist.app
> ```
>
> **Or System Settings**: try to open Typist (click **Cancel** on the dialog), then go to
> **System Settings → Privacy & Security**, scroll down, and click
> **Open Anyway** next to the Typist message.
>
> Then open it normally, and grant **Microphone** + **Accessibility** permissions when asked.

### 🐧 Linux: one-time input permission (required)

Typing into other apps goes through `/dev/uinput` via `ydotool`, and the Wayland clipboard via `wl-copy`:

```bash
sudo apt install ydotool ydotoold wl-clipboard
sudo groupadd -f input
sudo usermod -aG input $USER
echo 'KERNEL=="uinput", GROUP="input", MODE="0660", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/85-uinput.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
sudo setfacl -m u:$USER:rw /dev/uinput   # applies immediately, no re-login
```

Typist starts `ydotoold` automatically if it's installed. Voice-command keystrokes (Enter, Ctrl+Z, …) use Typist's own uinput injector, so they work on every Wayland compositor including KWin. Optional extras: `kdotool` (focused-app detection on KDE Wayland), `spectacle` (KDE) or `gnome-screenshot` (GNOME) for screen-aware coding help.

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

### 🎛️ Voice commands

Dictate naturally — Typist splits the command from the text:

| You say | What happens |
| --- | --- |
| "hey Pavun the meeting moved to 4 **send this**" | types the message, then presses **Enter** |
| "**undo that**" | presses **Ctrl+Z** |
| "**redo**" | presses **Ctrl+Shift+Z** |
| "**new line**" | presses **Enter** |
| "**select all**" / "**copy**" / "**paste**" | the obvious shortcuts |
| "**scratch that**" | presses **Backspace** |

With an **AI cleanup** provider enabled (Settings → AI cleanup, free keys from Groq / OpenRouter / NVIDIA), natural phrasing is understood ("shoot that off", "jot this down and send it"). Without one, a built-in offline parser still catches the commands above.

### 🧭 Context-aware typing

Typist detects the app you're dictating into and formats for it: paragraphs in **email and documents**, a single casual line in **chat**, literal text in **code editors**. Detection is best-effort — on Wayland it depends on what the compositor exposes; when the app can't be identified, Typist falls back to safe single-line typing.

### 🧠 Memory

- "Remember my address is 12 Anna Nagar, Chennai" → saved (the pill confirms)
- "Type my address" → the address is typed at your cursor
- Works inline too: "ship it to my address"

View and delete saved facts in **Settings → Memory**.

### 👁️ Screen-aware coding help

Focus an editor or terminal with a problem visible, then say **"solve this"**, **"fix this error"**, or **"write the code for this"**:

1. Typist screenshots the **active window** (only on these explicit phrases — plain dictation never touches your screen)
2. The problem goes to your coding assistant — **locally installed Claude Code / Codex CLI** by default (uses their own auth, no API key), with a cloud vision model as fallback
3. The answer is **typed into editors** or **pasted into terminals** (so multi-line code never executes early in a CLI)

Pick the assistant in **Settings → Screen coding help** (Auto / Claude Code / Codex / Cloud AI). On Linux, screen capture needs `spectacle` (KDE) or `gnome-screenshot` (GNOME).

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
    controller.ts  idle → recording → transcribing state machine, STT routing,
                   voice-action execution (type / command / remember / recall)
    hotkey.ts      global shortcut registration
    sarvam.ts      Sarvam cloud STT client (+ API key validation)
    local-stt.ts   offline Whisper engine (download/delete, idle auto-unload)
    sherpa-stt.ts  sherpa-onnx CTC models (Dolphin / Omnilingual)
    ai-cleanup.ts  AI intent pass: rewrite + context formatting + memory +
                   command detection, via Groq / OpenRouter / NVIDIA
    commands.ts    offline regex fallback for commands & memory (no AI key)
    memory.ts      persistent user facts ("remember my address is …")
    active-window.ts  focused-app detection (xdotool/kdotool, AppleScript, user32)
    audio.ts       PCM → WAV encoding
    paste.ts       text insertion & key presses (ydotool/wtype/xdotool on
                   Linux, nut.js elsewhere)
    settings.ts    electron-store, safeStorage-encrypted API key
    updater.ts     auto-updates via electron-updater + GitHub Releases
    ipc.ts         IPC handlers
    windows.ts     settings / overlay / recorder window factories
  preload/     contextBridge API (window.typist)
  renderer/
    settings/  React settings window (engine, API key, models, hotkey,
               memory, updates)
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
