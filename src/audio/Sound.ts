/**
 * Procedural 80s-synth soundtrack and sound effects, generated with WebAudio.
 * No audio files: a minor-key progression (Am – F – Dm – E) played by a detuned
 * sawtooth pad, a square-wave arpeggio through a dotted-eighth echo, a soft bass
 * pulse and the odd music-box bell. Plus a clockmaker's house full of ticking.
 *
 * Browsers only allow audio after a user gesture, so nothing plays until the first tap.
 */

export type Mood = 'silent' | 'emerge' | 'explore' | 'memory' | 'reveal';

const BPM = 76;
const STEP = 60 / BPM / 4; // sixteenth note, seconds
const LOOKAHEAD = 0.25;

// MIDI note numbers; each chord lasts two bars (32 sixteenths)
const CHORDS: { root: number; notes: number[] }[] = [
  { root: 45, notes: [57, 60, 64] }, // A minor
  { root: 41, notes: [57, 60, 65] }, // F major
  { root: 38, notes: [57, 62, 65] }, // D minor
  { root: 40, notes: [56, 59, 64] }, // E major: the eerie leading tone
];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2]; // chord-tone index per eighth note

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const MUTE_KEY = 'ghost-mystery-muted';

class SoundEngine {
  private ctx?: AudioContext;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private echo!: DelayNode;
  private echoIn!: GainNode;
  private padFilter!: BiquadFilterNode;
  private nextTime = 0;
  private step = 0;
  private mood: Mood = 'silent';
  private ticking = false;
  private nextTick = 0;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* storage unavailable */
    }
  }

  /** Call from any user gesture; safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.build();
      this.nextTime = this.ctx.currentTime + 0.1;
      window.setInterval(() => this.schedule(), 60);
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend();
        else this.ctx.resume();
      });
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMood(m: Mood) {
    this.mood = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const level = m === 'silent' ? 0 : m === 'emerge' ? 0.55 : m === 'memory' ? 0.8 : 1;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(level, t, 1.2);
    // warmer, darker pad while remembering; brighter while exploring
    this.padFilter.frequency.setTargetAtTime(m === 'memory' ? 700 : m === 'emerge' ? 420 : 1100, t, 1.5);
  }

  /** The house is full of clocks. */
  setTicking(on: boolean) {
    this.ticking = on;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
    return this.muted;
  }

  // ------------------------------------------------------------------ sound effects

  /** A drawer sliding or a cupboard creaking open. */
  open() {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    this.noise(t, 0.35, 900, 300, 0.18);
    this.tone(t + 0.28, 110, 0.18, 'triangle', 0.25);
  }

  /** Something important found. */
  discover() {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    [76, 79, 83, 88].forEach((m, i) => this.bell(t + i * 0.11, hz(m), 0.12, 1.6));
  }

  /** Nothing here. */
  empty() {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, hz(50), 0.12, 'sine', 0.4);
    this.tone(t + 0.16, hz(47), 0.1, 'sine', 0.5);
  }

  /** A soft click for moving through pages and thoughts. */
  blip() {
    const c = this.ctx;
    if (!c) return;
    this.tone(c.currentTime, hz(84), 0.04, 'square', 0.05, 0.6);
  }

  /** Floating up or down the stairs. */
  whoosh() {
    const c = this.ctx;
    if (!c) return;
    this.noise(c.currentTime, 1.1, 300, 2200, 0.12);
  }

  /** The realisation: a deep, slow toll. */
  toll() {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    this.bell(t, hz(33), 0.35, 5);
    this.bell(t, hz(45), 0.2, 4);
  }

  // ------------------------------------------------------------------ internals

  private build() {
    const c = this.ctx!;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);

    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    // dotted-eighth echo: the unmistakable 80s shimmer
    this.echoIn = c.createGain();
    this.echoIn.gain.value = 0.45;
    this.echo = c.createDelay(2);
    this.echo.delayTime.value = STEP * 3;
    const fb = c.createGain();
    fb.gain.value = 0.42;
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    this.echoIn.connect(this.echo);
    this.echo.connect(tone).connect(fb).connect(this.echo);
    tone.connect(this.musicBus);

    this.padFilter = c.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 420;
    this.padFilter.Q.value = 3;
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(this.padFilter.frequency);
    lfo.start();
    this.padFilter.connect(this.musicBus);
    this.setMood(this.mood);
  }

  private schedule() {
    const c = this.ctx;
    if (!c) return;
    while (this.nextTime < c.currentTime + LOOKAHEAD) {
      if (this.mood !== 'silent') this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % (32 * CHORDS.length);
    }
    if (this.ticking) {
      if (this.nextTick < c.currentTime) this.nextTick = c.currentTime + 0.05;
      while (this.nextTick < c.currentTime + LOOKAHEAD) {
        const tock = Math.floor(this.nextTick) % 2 === 0;
        this.noise(this.nextTick, 0.03, tock ? 2600 : 3400, tock ? 2600 : 3400, 0.05, 'bandpass');
        this.nextTick += 1;
      }
    }
  }

  private playStep(step: number, t: number) {
    const chord = CHORDS[Math.floor(step / 32)];
    const inBar = step % 32;
    const m = this.mood;
    if (inBar === 0) this.pad(t, chord.notes, STEP * 32);
    if (m === 'explore' || m === 'reveal') {
      // bass pulse on beat 1 and the "and" of 3
      if (inBar % 16 === 0 || inBar % 16 === 10) this.bass(t, hz(chord.root), STEP * 5);
      // arpeggio on eighth notes, quietly, into the echo
      if (inBar % 2 === 0) {
        const n = chord.notes[ARP[(inBar / 2) % ARP.length]] + 12;
        this.arp(t, hz(n));
      }
    }
    // the odd music-box bell
    if (m !== 'silent' && inBar === 24 && Math.random() < 0.5) {
      const n = chord.notes[Math.floor(Math.random() * 3)] + 24;
      this.bell(t, hz(n), 0.05, 2.2, true);
    }
  }

  private pad(t: number, notes: number[], dur: number) {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 1.8);
    g.gain.setValueAtTime(0.05, t + dur - 1.2);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    g.connect(this.padFilter);
    notes.forEach((n) => {
      [-8, 8].forEach((cents) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n - 12);
        o.detune.value = cents;
        o.connect(g);
        o.start(t);
        o.stop(t + dur + 0.7);
      });
    });
  }

  private arp(t: number, f: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1600;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.022, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 1.8);
    o.connect(filt).connect(g);
    g.connect(this.musicBus);
    g.connect(this.echoIn);
    o.start(t);
    o.stop(t + STEP * 2);
  }

  private bass(t: number, f: number, dur: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private bell(t: number, f: number, vol: number, decay: number, music = false) {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    [1, 2.76, 5.4].forEach((ratio, i) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * ratio;
      const og = c.createGain();
      og.gain.value = [1, 0.35, 0.12][i];
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + decay + 0.1);
    });
    const bus = music ? this.musicBus : this.sfxBus;
    g.connect(bus);
    g.connect(this.echoIn);
  }

  private tone(t: number, f: number, dur: number, type: OscillatorType, vol: number, endRatio = 1) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (endRatio !== 1) o.frequency.exponentialRampToValueAtTime(f * endRatio, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseBuf?: AudioBuffer;
  private noise(t: number, dur: number, f0: number, f1: number, vol: number, type: BiquadFilterType = 'lowpass') {
    const c = this.ctx!;
    if (!this.noiseBuf) {
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.Q.value = type === 'bandpass' ? 8 : 1;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

export const Sound = new SoundEngine();
