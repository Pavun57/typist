/**
 * Hidden recorder window: owns the microphone. Captures 16 kHz mono float32
 * PCM via an AudioWorklet (raw PCM serves both the Sarvam upload — encoded
 * to WAV in the main process — and local Whisper inference directly).
 * Commands come from the main process: 'start' / 'stop' / 'cancel'.
 */

const WORKLET_SOURCE = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) {
      this.port.postMessage(channel.slice(0));
    }
    return true;
  }
}
registerProcessor('capture', CaptureProcessor);
`;

let stream: MediaStream | null = null;
let ctx: AudioContext | null = null;
let chunks: Float32Array[] = [];
let discard = false;

async function start(): Promise<void> {
  try {
    stream ??= await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1 },
    });
    chunks = [];
    discard = false;

    ctx = new AudioContext({ sampleRate: 16000 });
    await ctx.resume();
    const workletUrl = URL.createObjectURL(
      new Blob([WORKLET_SOURCE], { type: 'application/javascript' }),
    );
    await ctx.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);

    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'capture');
    node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      chunks.push(e.data);
    };
    // The worklet must reach the destination to keep processing; a zero-gain
    // node keeps it silent (no mic feedback).
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(ctx.destination);
  } catch (err) {
    window.typist.sendRecorderError(
      `Microphone access failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function stop(): Promise<void> {
  if (!ctx) return;
  await ctx.close();
  ctx = null;
  if (discard) return;

  const length = chunks.reduce((n, c) => n + c.length, 0);
  const pcm = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    pcm.set(c, offset);
    offset += c.length;
  }
  chunks = [];
  window.typist.sendAudio(pcm.buffer);
}

window.typist.onRecorderCommand((cmd) => {
  if (cmd === 'start') void start();
  else if (cmd === 'stop') void stop();
  else if (cmd === 'cancel') {
    discard = true;
    void stop();
  }
});
