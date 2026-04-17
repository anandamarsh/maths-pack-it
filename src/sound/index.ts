let ctx: AudioContext | null = null;
let footToggle = false;
let musicMuted = import.meta.env.DEV;
const MUSIC_VOLUME_SCALE = 0.25;
const SFX_VOLUME_SCALE = 1;
const RECORDING_SOUNDTRACK_SCALE = 0.11;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  vol = 0.08,
  type: OscillatorType = "square",
  channel: "sfx" | "music" = "sfx",
) {
  if (channel === "music" && musicMuted) return;
  const c = ac();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  const scaledVol = vol * (channel === "music" ? MUSIC_VOLUME_SCALE : SFX_VOLUME_SCALE);
  gain.gain.setValueAtTime(scaledVol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.01);
}

function noiseBurst(startTime: number, filterFreq: number, vol: number, dur: number, channel: "sfx" | "music" = "sfx") {
  if (channel === "music" && musicMuted) return;
  const c = ac();
  const bufLen = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.8;
  const gain = c.createGain();
  const scaledVol = vol * (channel === "music" ? MUSIC_VOLUME_SCALE : SFX_VOLUME_SCALE);
  gain.gain.setValueAtTime(scaledVol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(startTime);
  src.stop(startTime + dur + 0.01);
}

function toneToTarget(
  freq: number,
  start: number,
  dur: number,
  target: AudioNode,
  vol = 0.08,
  type: OscillatorType = "square",
) {
  const c = ac();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(target);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.01);
}

export function toggleMute(): boolean {
  musicMuted = !musicMuted;
  return musicMuted;
}

export function isMuted() {
  return musicMuted;
}

export function ensureAudioReady() {
  ac();
}

export function playRipple(pitch: number = 440) {
  const t = ac().currentTime;
  tone(pitch, t, 0.28, 0.09, "sine");
  tone(pitch * 1.5, t + 0.06, 0.18, 0.05, "triangle");
  noiseBurst(t, 1200, 0.06, 0.08);
}

export function playCorrect() {
  const t = ac().currentTime;
  tone(110, t, 0.08, 0.18, "sine");
  tone(523.25, t, 0.12, 0.11, "square");
  tone(659.25, t + 0.06, 0.15, 0.1, "square");
  tone(783.99, t + 0.12, 0.15, 0.1, "square");
  tone(1046.5, t + 0.18, 0.22, 0.12, "square");
  tone(1318.5, t + 0.24, 0.28, 0.09, "triangle");
}

export function playWrong() {
  const t = ac().currentTime;
  tone(90, t, 0.1, 0.2, "sine");
  tone(440, t, 0.12, 0.12, "sawtooth");
  tone(349.23, t + 0.1, 0.15, 0.11, "sawtooth");
  tone(261.63, t + 0.2, 0.18, 0.1, "sawtooth");
  tone(196, t + 0.3, 0.22, 0.09, "sawtooth");
}

export function playLevelComplete() {
  const t = ac().currentTime;
  const melody = [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
  melody.forEach((f, i) => tone(f, t + i * 0.12, 0.2, 0.09));
}

export function playButton() {
  const t = ac().currentTime;
  tone(659.25, t, 0.05, 0.06, "square");
  tone(783.99, t + 0.04, 0.05, 0.045, "square");
}

export function playDragStep() {
  const t = ac().currentTime;
  footToggle = !footToggle;
  const side = footToggle ? 1 : -1;
  noiseBurst(t, 420 + side * 60, 0.36, 0.06);
  tone(footToggle ? 72 : 88, t, 0.1, 0.3, "sine");
  noiseBurst(t, 2800, 0.14, 0.022);
}

export function playCameraShutter() {
  const t = ac().currentTime;
  noiseBurst(t, 1800, 0.12, 0.025);
  noiseBurst(t + 0.018, 2600, 0.1, 0.02);
  tone(1244.51, t, 0.028, 0.055, "square");
  tone(830.61, t + 0.03, 0.04, 0.05, "triangle");
}

export function playKeyClick() {
  const t = ac().currentTime;
  noiseBurst(t, 2600, 0.14, 0.02);
  tone(1900, t, 0.026, 0.08, "square");
}

export function playTypewriterTick() {
  const c = ac();
  const t = c.currentTime;
  const bufLen = Math.ceil(c.sampleRate * 0.018);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.25));
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const flt = c.createBiquadFilter();
  flt.type = "bandpass";
  flt.frequency.value = 3200;
  flt.Q.value = 1.2;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.22, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
  src.connect(flt);
  flt.connect(gain);
  gain.connect(c.destination);
  src.start(t);
  src.stop(t + 0.02);
}

// ─── Background music ─────────────────────────────────────────────────────────

interface MusicPattern {
  melody: number[];
  bass: number[];
  bpm: number;
  melodyVol?: number;
  bassVol?: number;
  melodyType?: OscillatorType;
  bassType?: OscillatorType;
}

const MUSIC_PATTERNS: MusicPattern[] = [
  {
    melody: [659.25, 659.25, 0, 523.25, 659.25, 0, 783.99, 0, 392, 0, 523.25, 0, 392, 329.63, 440, 493.88],
    bass: [130.81, 0, 130.81, 0, 98.0, 0, 146.83, 0, 98.0, 0, 82.41, 0, 110.0, 0, 123.47, 0],
    bpm: 140,
  },
  {
    melody: [783.99, 0, 659.25, 0, 523.25, 587.33, 659.25, 0, 783.99, 0, 880, 0, 783.99, 659.25, 523.25, 0],
    bass: [196.0, 0, 164.81, 0, 130.81, 0, 196.0, 0, 196.0, 0, 220.0, 0, 196.0, 0, 130.81, 0],
    bpm: 155,
    melodyType: "square",
    bassType: "triangle",
  },
  {
    melody: [329.63, 0, 392, 0, 440, 493.88, 523.25, 0, 493.88, 0, 440, 0, 392, 329.63, 293.66, 0],
    bass: [82.41, 0, 98.0, 0, 110.0, 0, 130.81, 0, 110.0, 0, 98.0, 0, 82.41, 0, 73.42, 0],
    bpm: 110,
    melodyVol: 0.055,
    bassVol: 0.035,
    melodyType: "triangle",
    bassType: "sine",
  },
  {
    melody: [523.25, 587.33, 659.25, 698.46, 783.99, 0, 659.25, 0, 523.25, 0, 659.25, 0, 783.99, 0, 1046.5, 0],
    bass: [130.81, 0, 164.81, 0, 196.0, 0, 164.81, 0, 130.81, 0, 130.81, 0, 98.0, 0, 130.81, 0],
    bpm: 170,
    melodyVol: 0.06,
  },
];

let bgTimer: ReturnType<typeof setTimeout> | null = null;
let musicOn = false;
let step = 0;
let currentPattern: MusicPattern = MUSIC_PATTERNS[0];
let recordingTimer: ReturnType<typeof setTimeout> | null = null;
let recordingFadeTimer: ReturnType<typeof setTimeout> | null = null;
let recordingOn = false;
let recordingStep = 0;
let recordingPattern: MusicPattern = MUSIC_PATTERNS[0];
let recordingMaster: GainNode | null = null;

function tick() {
  if (!musicOn) return;
  const t = ac().currentTime;
  const beat = 60 / currentPattern.bpm;
  const { melody, bass, melodyVol = 0.05, bassVol = 0.04, melodyType = "square", bassType = "triangle" } = currentPattern;
  if (melody[step]) tone(melody[step], t, beat * 0.7, melodyVol, melodyType, "music");
  if (bass[step]) tone(bass[step], t, beat * 0.9, bassVol, bassType, "music");
  step = (step + 1) % melody.length;
  bgTimer = setTimeout(tick, beat * 1000);
}

export function startMusic() {
  if (musicOn) return;
  currentPattern = MUSIC_PATTERNS[Math.floor(Math.random() * MUSIC_PATTERNS.length)];
  step = 0;
  musicOn = true;
  ac();
  tick();
}

export function shuffleMusic() {
  const others = MUSIC_PATTERNS.filter((p) => p !== currentPattern);
  currentPattern = others[Math.floor(Math.random() * others.length)];
  step = 0;
}

export function stopMusic() {
  musicOn = false;
  if (bgTimer) clearTimeout(bgTimer);
  bgTimer = null;
}

export function isMusicOn() {
  return musicOn;
}

function getRecordingMaster(): GainNode {
  const c = ac();
  if (!recordingMaster) {
    recordingMaster = c.createGain();
    recordingMaster.gain.value = 0.0001;
    recordingMaster.connect(c.destination);
  }
  return recordingMaster;
}

function recordingTick() {
  if (!recordingOn) return;
  const t = ac().currentTime;
  const beat = 60 / recordingPattern.bpm;
  const {
    melody,
    bass,
    melodyVol = 0.05,
    bassVol = 0.04,
    melodyType = "square",
    bassType = "triangle",
  } = recordingPattern;
  const target = getRecordingMaster();
  if (melody[recordingStep]) {
    toneToTarget(melody[recordingStep], t, beat * 0.7, target, melodyVol * RECORDING_SOUNDTRACK_SCALE, melodyType);
  }
  if (bass[recordingStep]) {
    toneToTarget(bass[recordingStep], t, beat * 0.9, target, bassVol * RECORDING_SOUNDTRACK_SCALE, bassType);
  }
  recordingStep = (recordingStep + 1) % melody.length;
  recordingTimer = setTimeout(recordingTick, beat * 1000);
}

export function startRecordingSoundtrack(fadeInMs = 1200) {
  const c = ac();
  const target = getRecordingMaster();
  if (recordingFadeTimer) {
    clearTimeout(recordingFadeTimer);
    recordingFadeTimer = null;
  }
  recordingPattern = MUSIC_PATTERNS[Math.floor(Math.random() * MUSIC_PATTERNS.length)];
  recordingStep = 0;
  recordingOn = true;
  target.gain.cancelScheduledValues(c.currentTime);
  target.gain.setValueAtTime(0.0001, c.currentTime);
  target.gain.linearRampToValueAtTime(1, c.currentTime + fadeInMs / 1000);
  if (recordingTimer) clearTimeout(recordingTimer);
  recordingTick();
}

export function fadeOutRecordingSoundtrack(fadeOutMs = 1200) {
  if (!recordingMaster) return;
  const c = ac();
  recordingMaster.gain.cancelScheduledValues(c.currentTime);
  recordingMaster.gain.setValueAtTime(Math.max(recordingMaster.gain.value, 0.0001), c.currentTime);
  recordingMaster.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fadeOutMs / 1000);
  if (recordingFadeTimer) clearTimeout(recordingFadeTimer);
  recordingFadeTimer = setTimeout(() => {
    stopRecordingSoundtrack();
  }, fadeOutMs + 40);
}

export function stopRecordingSoundtrack() {
  recordingOn = false;
  if (recordingTimer) clearTimeout(recordingTimer);
  if (recordingFadeTimer) clearTimeout(recordingFadeTimer);
  recordingTimer = null;
  recordingFadeTimer = null;
  if (recordingMaster) {
    const c = ac();
    recordingMaster.gain.cancelScheduledValues(c.currentTime);
    recordingMaster.gain.setValueAtTime(0.0001, c.currentTime);
  }
}
