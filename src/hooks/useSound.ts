import { useCallback, useRef, useState } from 'react';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gain: number = 0.3,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function useSound() {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('mathMammoth_muted') === 'true';
    } catch {
      return false;
    }
  });
  const mutedRef = useRef(muted);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      mutedRef.current = next;
      try { localStorage.setItem('mathMammoth_muted', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const playCorrect = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Bright bell ding: triangle wave for bell timbre
    playNote(ctx, 880, now, 0.35, 0.22, 'triangle');       // A5 - main bell tone
    playNote(ctx, 1760, now, 0.2, 0.08, 'sine');           // A6 - soft harmonic shimmer
    playNote(ctx, 1318.5, now + 0.06, 0.25, 0.12, 'triangle'); // E6 - brightness
  }, []);

  const playIncorrect = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    playNote(ctx, 220, now, 0.3, 0.15);  // A3 gentle low tone
  }, []);

  const playMilestone = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Ascending arpeggio: C5 E5 G5 C6
    playNote(ctx, 523.25, now, 0.2, 0.2);
    playNote(ctx, 659.25, now + 0.15, 0.2, 0.2);
    playNote(ctx, 783.99, now + 0.3, 0.2, 0.2);
    playNote(ctx, 1046.50, now + 0.45, 0.3, 0.25);
  }, []);

  const playComplete = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Fanfare: C5 E5 G5 C6, then a final triumphant chord
    playNote(ctx, 523.25, now, 0.15, 0.2);
    playNote(ctx, 659.25, now + 0.12, 0.15, 0.2);
    playNote(ctx, 783.99, now + 0.24, 0.15, 0.2);
    playNote(ctx, 1046.50, now + 0.36, 0.3, 0.25);
    // Chord
    playNote(ctx, 523.25, now + 0.6, 0.5, 0.15);
    playNote(ctx, 659.25, now + 0.6, 0.5, 0.15);
    playNote(ctx, 783.99, now + 0.6, 0.5, 0.15);
    playNote(ctx, 1046.50, now + 0.6, 0.5, 0.2);
  }, []);

  return { muted, toggleMute, playCorrect, playIncorrect, playMilestone, playComplete };
}
