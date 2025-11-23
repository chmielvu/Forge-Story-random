
import React, { useEffect, useRef } from 'react';
import { YandereLedger } from '../types';

interface Props {
  ledger: YandereLedger;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
}

const ReactiveCanvas: React.FC<Props> = ({ ledger }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);

  // Mapping ledger to visual params
  const traumaIntensity = ledger.traumaLevel / 100; // 0 to 1
  const hopeIntensity = ledger.hopeLevel / 100; // 0 to 1
  const isHighStress = ledger.fearOfAuthority > 70;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const createParticle = () => {
      const isAsh = Math.random() < traumaIntensity; // More trauma = more dark ash
      const isGold = Math.random() < (hopeIntensity * 0.3); // Rare gold motes

      const x = Math.random() * canvas.width;
      // Ash falls from top, Gold floats from bottom
      const y = isAsh ? -10 : canvas.height + 10; 

      return {
        x,
        y,
        vx: (Math.random() - 0.5) * (isHighStress ? 2 : 0.5),
        vy: isAsh ? (Math.random() * 2 + 1) : (Math.random() * -1 - 0.5),
        size: Math.random() * 3 + (isAsh ? 2 : 1),
        color: isAsh ? `rgba(28, 25, 23, ${Math.random() * 0.5 + 0.2})` : `rgba(250, 204, 21, ${Math.random() * 0.8 + 0.2})`,
        life: 1.0
      };
    };

    const loop = () => {
      // Clear with trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Spawn rate depends on intensity
      if (Math.random() < 0.1 + (traumaIntensity * 0.2)) {
        particles.current.push(createParticle());
      }

      // Update & Draw
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.005;

        // Jitter effect for high fear
        if (isHighStress) {
           p.x += (Math.random() - 0.5) * 2;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        if (p.life <= 0 || p.y > canvas.height + 20 || p.y < -20) {
          particles.current.splice(i, 1);
        }
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [ledger]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 z-0 pointer-events-none mix-blend-screen"
    />
  );
};

export default ReactiveCanvas;
