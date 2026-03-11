import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiEffectProps {
  trigger: boolean;
  intensity?: 'small' | 'big';
}

export default function ConfettiEffect({ trigger, intensity = 'small' }: ConfettiEffectProps) {
  useEffect(() => {
    if (!trigger) return;

    if (intensity === 'big') {
      // Full celebration
      const duration = 2000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'],
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    } else {
      // Small burst
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10B981', '#4F46E5'],
      });
    }
  }, [trigger, intensity]);

  return null;
}
