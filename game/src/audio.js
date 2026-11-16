// All sound is synthesised in code with WebAudio — no audio files.
// Short blips and sweeps for effects, plus a quiet generative pad that
// drifts between two detuned oscillators. Mute is a single toggle.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    padGain: null,
    padNodes: [],
    muted: false,
    padStarted: false,
  };
}

// Lazily create the context on the first user gesture (browsers require it).
export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = audio.muted ? 0 : 0.55;
  audio.master.connect(audio.ctx.destination);
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.55;
}

// One oscillator burst with a pitch slide and an exponential fade.
function blip(audio, { type, from, to, seconds, volume, delay = 0 }) {
  if (!audio.ctx || audio.muted) return;
  const now = audio.ctx.currentTime + delay;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(now);
  osc.stop(now + seconds + 0.02);
}

// Filtered noise burst (for hits and explosions).
function noise(audio, { seconds, volume, cutoff, delay = 0 }) {
  if (!audio.ctx || audio.muted) return;
  const now = audio.ctx.currentTime + delay;
  const length = Math.max(1, Math.floor(audio.ctx.sampleRate * seconds));
  const buffer = audio.ctx.createBuffer(1, length, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = audio.ctx.createBufferSource();
  source.buffer = buffer;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  source.start(now);
}

export const SFX = {
  shoot(audio) {
    blip(audio, { type: 'square', from: 880, to: 320, seconds: 0.09, volume: 0.10 });
  },
  hit(audio) {
    noise(audio, { seconds: 0.06, volume: 0.12, cutoff: 2400 });
  },
  kill(audio) {
    blip(audio, { type: 'sawtooth', from: 320, to: 60, seconds: 0.22, volume: 0.14 });
    noise(audio, { seconds: 0.18, volume: 0.10, cutoff: 1200 });
  },
  hurt(audio) {
    blip(audio, { type: 'sawtooth', from: 160, to: 70, seconds: 0.25, volume: 0.18 });
  },
  dash(audio) {
    noise(audio, { seconds: 0.14, volume: 0.08, cutoff: 3200 });
  },
  pickup(audio) {
    blip(audio, { type: 'sine', from: 660, to: 990, seconds: 0.12, volume: 0.12 });
    blip(audio, { type: 'sine', from: 990, to: 1320, seconds: 0.12, volume: 0.10, delay: 0.09 });
  },
  waveClear(audio) {
    [523, 659, 784, 1047].forEach((freq, i) => {
      blip(audio, { type: 'triangle', from: freq, to: freq, seconds: 0.22, volume: 0.12, delay: i * 0.09 });
    });
  },
  waveStart(audio) {
    blip(audio, { type: 'triangle', from: 220, to: 440, seconds: 0.3, volume: 0.12 });
  },
  gameOver(audio) {
    [392, 330, 262, 196].forEach((freq, i) => {
      blip(audio, { type: 'triangle', from: freq, to: freq * 0.94, seconds: 0.4, volume: 0.13, delay: i * 0.16 });
    });
  },
  victory(audio) {
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      blip(audio, { type: 'triangle', from: freq, to: freq, seconds: 0.35, volume: 0.12, delay: i * 0.11 });
    });
  },
};

// The ambient pad: two slow detuned triangle waves through a low-pass
// filter, with a slow LFO breathing the filter. Started once, runs forever.
export function startPad(audio) {
  if (!audio.ctx || audio.padStarted) return;
  audio.padStarted = true;
  audio.padGain = audio.ctx.createGain();
  audio.padGain.gain.value = 0.05;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.connect(audio.padGain);
  audio.padGain.connect(audio.master);
  const lfo = audio.ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = audio.ctx.createGain();
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();
  [110, 164.8, 220.5].forEach((freq, i) => {
    const osc = audio.ctx.createOscillator();
    osc.type = i === 2 ? 'sine' : 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = i === 0 ? -4 : 3;
    const g = audio.ctx.createGain();
    g.gain.value = i === 2 ? 0.25 : 0.4;
    osc.connect(g);
    g.connect(filter);
    osc.start();
    audio.padNodes.push(osc);
  });
}
