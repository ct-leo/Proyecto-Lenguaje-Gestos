import React, { useEffect, useRef } from 'react';
import type { Landmark } from '../lib/api';
import Webcam from 'react-webcam';

interface Props {
  onLandmarks: (hands: Landmark[][]) => void;
  width?: number;
  height?: number;
  cameraOn?: boolean;
  mirror?: boolean;
}

export const HandCapture: React.FC<Props> = ({ onLandmarks, width = 640, height = 480, cameraOn = true, mirror = false }) => {
  const webcamRef = useRef<Webcam | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number | null>(null);
  const handsRef = useRef<any>(null);

  // init MediaPipe Hands once
  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = width;
    canvas.height = height;
    ctxRef.current = canvas.getContext('2d');

    const HandsCtor = (window as any).Hands;
    if (!HandsCtor) {
      console.error('MediaPipe Hands no está cargado');
      return;
    }
    const hands = new HandsCtor({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}` });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
    hands.onResults((results: any) => {
      const canvas = canvasRef.current!;
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const handsLm: any[] = results.multiHandLandmarks || [];
      const all: Landmark[][] = handsLm.map((lm) => lm.map((p: any) => ({ x: p.x, y: p.y, z: p.z })));
      onLandmarks(all);
      // draw both hands with distinct colors
      const colors = ['#0FA958', '#2563eb'];
      all.forEach((landmarks, idx) => {
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors[idx % colors.length];
        ctx.fillStyle = colors[idx % colors.length];
        for (const p of landmarks) {
          const x = p.x * canvas.width;
          const y = p.y * canvas.height;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        const line = (a: Landmark, b: Landmark) => {
          ctx.beginPath();
          ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
          ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
          ctx.stroke();
        };
        for (let i = 1; i < 4; i++) line(landmarks[i], landmarks[i + 1]);
        for (let i = 5; i < 8; i++) line(landmarks[i], landmarks[i + 1]);
        for (let i = 9; i < 12; i++) line(landmarks[i], landmarks[i + 1]);
        for (let i = 13; i < 16; i++) line(landmarks[i], landmarks[i + 1]);
        for (let i = 17; i < 20; i++) line(landmarks[i], landmarks[i + 1]);
      });
    });
    handsRef.current = hands;

    return () => {
      hands.close && hands.close();
      handsRef.current = null;
    };
  }, [onLandmarks, width, height]);

  // start/stop RAF loop based on cameraOn
  useEffect(() => {
    const loop = async () => {
      const hands = handsRef.current;
      const video = webcamRef.current?.video as HTMLVideoElement | undefined;
      if (hands && video && video.readyState === 4) {
        await hands.send({ image: video });
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    if (cameraOn) {
      rafRef.current = requestAnimationFrame(loop);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [cameraOn]);

  const transform = mirror ? 'scaleX(-1)' : 'none';
  return (
    <div style={{ position: 'relative', width, height, background: 'var(--muted-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {cameraOn ? (
        <Webcam ref={webcamRef} audio={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--subtext)' }}>Cámara apagada</div>
      )}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform }} />
    </div>
  );
};

export default HandCapture;
