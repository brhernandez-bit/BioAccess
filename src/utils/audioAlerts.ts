// Web Audio API Synthesizer for immediate, zero-latency visual/acoustic alerts

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('AudioContext not supported or allowed yet', e);
    return null;
  }
}

/**
 * Positive, clear harmonic chime (Access Granted - Green Alert)
 * Two ascending crisp tones (523Hz C5 -> 659Hz E5 -> 784Hz G5)
 */
export function playSuccessChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 523.25, time: now, dur: 0.12 },
    { freq: 659.25, time: now + 0.1, dur: 0.15 },
    { freq: 783.99, time: now + 0.22, dur: 0.35 },
  ];

  notes.forEach((n) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(n.freq, n.time);

    gain.gain.setValueAtTime(0.001, n.time);
    gain.gain.exponentialRampToValueAtTime(0.25, n.time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, n.time + n.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(n.time);
    osc.stop(n.time + n.dur + 0.05);
  });
}

/**
 * Low, authoritative double-buzz (Access Denied - Red Alert)
 * Sawtooth / low frequency warning tones (180Hz -> 140Hz)
 */
export function playDeniedBuzzer() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const buzzes = [
    { freq: 190, time: now, dur: 0.22 },
    { freq: 160, time: now + 0.28, dur: 0.32 },
  ];

  buzzes.forEach((b) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(b.freq, b.time);

    gain.gain.setValueAtTime(0.001, b.time);
    gain.gain.exponentialRampToValueAtTime(0.3, b.time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, b.time + b.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(b.time);
    osc.stop(b.time + b.dur + 0.05);
  });
}
