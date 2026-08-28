/**
 * Synthesises the game's sound effects as 16-bit mono WAVs.
 * Run with:  node scripts/make-audio.js
 * Everything is generated from oscillators and noise, so there are no
 * third-party samples and no licensing to track.
 */
const fs = require('fs');
const path = require('path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sfx');

function writeWav(name, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, name), Buffer.concat([header, data]));
  console.log('  ' + name + '  ' + (data.length / 1024).toFixed(1) + ' KB');
}

const buffer = (seconds) => new Float32Array(Math.floor(RATE * seconds));
const t = (i) => i / RATE;
const env = (x, attack, release) =>
  Math.min(1, x / attack) * Math.min(1, Math.max(0, (1 - x) / release));

/** Low-passed noise, used for breath and impact texture. */
function noise(state, amount) {
  state.v += (Math.random() * 2 - 1 - state.v) * amount;
  return state.v;
}

/* ------------------------------------------------------------- heartbeat */
function heartbeat() {
  const buf = buffer(0.9);
  const thump = (start, gain, freq) => {
    const len = Math.floor(RATE * 0.22);
    const from = Math.floor(RATE * start);
    for (let i = 0; i < len && from + i < buf.length; i += 1) {
      const x = i / len;
      const decay = Math.exp(-9 * x);
      const f = freq * (1 - 0.45 * x);
      buf[from + i] += Math.sin(2 * Math.PI * f * t(i)) * decay * gain;
    }
  };
  thump(0.0, 0.95, 78);
  thump(0.26, 0.62, 66);
  return buf;
}

/* ----------------------------------------------------------------- growl */
function growl() {
  const buf = buffer(1.1);
  const ns = { v: 0 };
  let phase = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const x = i / buf.length;
    const base = 62 + 26 * Math.sin(2 * Math.PI * 3.1 * t(i));
    phase += (2 * Math.PI * base) / RATE;
    const rasp = noise(ns, 0.35) * 0.55;
    const body = Math.sin(phase) * 0.7 + Math.sin(phase * 2.02) * 0.22;
    buf[i] = (body + rasp * (0.5 + 0.5 * Math.sin(phase))) * env(x, 0.12, 0.45) * 0.8;
  }
  return buf;
}

/* ---------------------------------------------------------------- pickup */
function pickup() {
  const buf = buffer(0.42);
  for (let i = 0; i < buf.length; i += 1) {
    const x = i / buf.length;
    const f = 520 + 900 * x * x;
    const shimmer = Math.sin(2 * Math.PI * f * t(i));
    const octave = Math.sin(2 * Math.PI * f * 1.5 * t(i)) * 0.35;
    buf[i] = (shimmer + octave) * Math.exp(-3.4 * x) * 0.55;
  }
  return buf;
}

/* ------------------------------------------------------------------- hit */
function hit() {
  const buf = buffer(0.55);
  const ns = { v: 0 };
  for (let i = 0; i < buf.length; i += 1) {
    const x = i / buf.length;
    const crunch = noise(ns, 0.75) * Math.exp(-11 * x);
    const thud = Math.sin(2 * Math.PI * (110 - 70 * x) * t(i)) * Math.exp(-7 * x);
    buf[i] = (crunch * 0.75 + thud * 0.85) * 0.95;
  }
  return buf;
}

/* ------------------------------------------------------------------ wave */
function waveAlarm() {
  const buf = buffer(1.3);
  for (let i = 0; i < buf.length; i += 1) {
    const x = i / buf.length;
    const sweep = 300 + 260 * Math.sin(2 * Math.PI * 1.1 * t(i) - Math.PI / 2);
    const tone = Math.sin(2 * Math.PI * sweep * t(i));
    const sub = Math.sin(2 * Math.PI * sweep * 0.5 * t(i)) * 0.4;
    buf[i] = (tone + sub) * env(x, 0.06, 0.3) * 0.42;
  }
  return buf;
}

/* -------------------------------------------------------------- gameover */
function gameover() {
  const buf = buffer(2.4);
  const ns = { v: 0 };
  for (let i = 0; i < buf.length; i += 1) {
    const x = i / buf.length;
    const f = 150 * Math.pow(0.35, x);
    const drone =
      Math.sin(2 * Math.PI * f * t(i)) * 0.6 +
      Math.sin(2 * Math.PI * f * 1.01 * t(i)) * 0.4 +
      Math.sin(2 * Math.PI * f * 0.5 * t(i)) * 0.3;
    buf[i] = (drone + noise(ns, 0.06) * 0.25) * env(x, 0.02, 0.55) * 0.75;
  }
  return buf;
}

fs.mkdirSync(OUT, { recursive: true });
console.log('Rendering sound effects to assets/sfx');
writeWav('heartbeat.wav', heartbeat());
writeWav('growl.wav', growl());
writeWav('pickup.wav', pickup());
writeWav('hit.wav', hit());
writeWav('wave.wav', waveAlarm());
writeWav('gameover.wav', gameover());
console.log('Done.');
