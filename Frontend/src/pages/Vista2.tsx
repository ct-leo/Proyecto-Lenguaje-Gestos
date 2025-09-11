import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HandCapture from '../components/HandCapture';
import { api, type Landmark } from '../lib/api';
import Card from '../components/ui/Card';
import Stack from '../components/ui/Stack';
// import Select from '../components/ui/Select';
import SelectMenu from '../components/ui/SelectMenu';
import Button from '../components/ui/Button';
import SectionHeader from '../components/ui/SectionHeader';
import '../styles/vista2.css';
import { getTheme, type ThemeName } from '../lib/theme';

const Vista2: React.FC = () => {
  const letters = useMemo(() => Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), []);
  const [letter, setLetter] = useState<string>('A');
  const [sampleCount] = useState<number>(30);
  const lastHandsRef = useRef<Landmark[][]>([]);

  const [progress, setProgress] = useState<any>(null);
  const [prediction, setPrediction] = useState<{ letter: string | null; distance: number | null; threshold: number | null }>({ letter: null, distance: null, threshold: null });
  const [cameraOn, setCameraOn] = useState<boolean>(true);
  const [mirror, setMirror] = useState<boolean>(true);
  const theme: ThemeName = getTheme();
  const [hasHands, setHasHands] = useState<boolean>(false);
  const [errorShake, setErrorShake] = useState<boolean>(false);
  // UI state for parity with example
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const L of letters) init[L] = 0;
    return init;
  });
  // smoothing prediction confidence
  const smoothWindow = useRef<number[]>([]);
  const SMOOTH_SIZE = 7;
  const PREDICT_COOLDOWN_MS = 150;
  const lastPredictAtRef = useRef<number>(0);
  const predictLoopRef = useRef<number | null>(null);

  const onLandmarks = useCallback((hands: Landmark[][]) => {
    lastHandsRef.current = hands;
    setHasHands(!!hands && hands.length > 0);
  }, []);

  const refreshProgress = useCallback(async () => {
    try {
      const data = await api.progress();
      setProgress(data);
    } catch {
      setProgress(null);
    }
  }, []);

  const refreshModel = useCallback(async () => {
    try {
      await api.getModel();
    } catch {
      // noop
    }
  }, []);

  const refreshLast = useCallback(async () => {
    try {
      await api.lastDetected();
    } catch {
      // noop
    }
  }, []);

  const captureOnce = useCallback(async () => {
    // pick first hand for dataset consistency
    const lms = lastHandsRef.current?.[0];
    if (!lms || lms.length !== 21) return null;
    const payload = [{ landmarks: JSON.parse(JSON.stringify(lms)) }];
    try {
      const resp = await api.samplesBatch(letter, payload);
      return resp as any;
    } catch {
      return null;
    }
  }, [letter]);

  const toggleCapture = useCallback(async () => {
    if (isCapturing) {
      setIsCapturing(false);
      setStatusMsg('Captura detenida.');
      return;
    }
    setIsCapturing(true);
    setStatusMsg('Capturando muestras...');
    let captured = 0;
    const target = Math.max(1, Math.min(200, sampleCount));
    while (captured < target && isCapturing) {
      const r = await captureOnce();
      if (r && r.status === 'ok') {
        captured += 1;
        setSessionCounts((prev) => ({ ...prev, [letter]: (prev[letter] || 0) + 1 }));
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    setIsCapturing(false);
    await refreshProgress();
    await refreshLast();
    setStatusMsg(`Insertadas ${captured} muestras para ${letter}.`);
  }, [captureOnce, isCapturing, letter, refreshLast, refreshProgress, sampleCount]);

  const train = useCallback(async () => {
    const resp = await api.train();
    if ((resp as any).status === 'ok') {
      await refreshModel();
      alert('Modelo entrenado');
    } else {
      alert('Error al entrenar');
    }
  }, [refreshModel]);

  const predictOnce = useCallback(async () => {
    const lms = lastHandsRef.current?.[0];
    if (!lms || lms.length !== 21) return;
    const resp = await api.predict(lms);
    if ((resp as any).status === 'ok') {
      const letterOut = (resp as any).letter ?? null;
      const dist = (resp as any).distance ?? null;
      const thr = (resp as any).threshold ?? null;
      // compute confidence proxy 0..1
      let conf = 0;
      if (typeof dist === 'number' && typeof thr === 'number' && thr > 0) {
        conf = Math.max(0, Math.min(1, 1 - dist / thr));
      }
      // smoothing
      const buf = smoothWindow.current;
      buf.push(conf);
      if (buf.length > SMOOTH_SIZE) buf.shift();
      const smoothed = buf.reduce((a, b) => a + b, 0) / buf.length;
      setPrediction({ letter: letterOut, distance: dist, threshold: thr });
      // also set big letter via lastDetected state mirror
      // opcional: actualizar otros paneles si se agregan
      return smoothed;
    } else {
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
    }
  }, []);

  // auto prediction loop with cooldown
  useEffect(() => {
    if (!cameraOn) return;
    const loop = async () => {
      const now = performance.now();
      if (now - lastPredictAtRef.current >= PREDICT_COOLDOWN_MS) {
        lastPredictAtRef.current = now;
        try { await predictOnce(); } catch {}
      }
      predictLoopRef.current = requestAnimationFrame(loop);
    };
    predictLoopRef.current = requestAnimationFrame(loop);
    return () => {
      if (predictLoopRef.current) cancelAnimationFrame(predictLoopRef.current);
      predictLoopRef.current = null;
    };
  }, [cameraOn, predictOnce]);

  const resetAll = useCallback(async () => {
    if (!confirm('Esto eliminará todas las muestras y modelos. ¿Continuar?')) return;
    const resp = await api.reset();
    if ((resp as any).status === 'ok') {
      await refreshProgress();
      await refreshModel();
      setPrediction({ letter: null, distance: null, threshold: null });
      alert('Datos reiniciados');
    }
  }, [refreshModel, refreshProgress]);

  return (
    <div>
      <SectionHeader title="Entrenamiento de Lenguaje de Señas (A..Z) – vista02" subtitle="Reconocimiento en navegador con MediaPipe (URL/CDN). Guardado en BD vía endpoints de /vista02." />
      <div className="v2-stage">
        <Card className="v2-left">
          <div className="v2-video-wrap" style={{ display: 'grid', placeItems: 'center' }}>
            <AnimatePresence>
              {statusMsg && (
                <motion.div className="v2-hud"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  {statusMsg}
                </motion.div>
              )}
              {!statusMsg && (
                <motion.div className="v2-hud"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Listo
                </motion.div>
              )}
            </AnimatePresence>
            <div className={[
                theme === 'neo' ? 'neo-frame' : '',
                theme === 'neo' && hasHands ? 'neo-detect' : '',
                theme === 'neo' && errorShake ? 'neo-error' : '',
              ].filter(Boolean).join(' ')}>
              <HandCapture onLandmarks={onLandmarks} cameraOn={cameraOn} mirror={mirror} />
            </div>
          </div>
          <div className="v2-controls">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Letra:
              <SelectMenu value={letter} onChange={(v) => setLetter(v)} options={letters.map((L) => ({ label: L, value: L }))} width={90} />
            </label>
            {!cameraOn ? (
              <Button onClick={() => { setCameraOn(true); setStatusMsg('Cámara iniciada'); }}>Iniciar cámara</Button>
            ) : (
              <Button variant="danger" onClick={() => { setCameraOn(false); setStatusMsg('Cámara detenida'); }}>Detener cámara</Button>
            )}
            <Button onClick={toggleCapture}>{isCapturing ? 'Detener captura' : 'Entrenar (capturar muestras)'}</Button>
            <Button onClick={train}>Entrenar Modelo</Button>
            <Button variant="ghost" onClick={refreshProgress}>Refrescar progreso</Button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.currentTarget.checked)} /> Espejar overlay
            </label>
          </div>

          {/* Panel de progreso tipo ejemplo */}
          <div style={{ marginTop: 10 }}>
            <span className="v2-panel-title">Progreso</span>
            <div className="v2-progress-bar"><span style={{ width: `${Math.min(100, Math.round((sessionCounts[letter] / Math.max(1, sampleCount)) * 100))}%` }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--subtext)' }}>
              <span>{Math.min(100, Math.round((sessionCounts[letter] / Math.max(1, sampleCount)) * 100))}%</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 14 }}>
              <strong>Letra seleccionada:</strong> {letter}{' '}
              <strong style={{ marginLeft: 12 }}>Total muestras (todas letras):</strong> {progress?.total ?? '–'}{' '}
              <strong style={{ marginLeft: 12 }}>Guardadas en BD:</strong> {progress?.totals?.[letter] ?? '–'}{' '}
              <strong style={{ marginLeft: 12 }}>Letra detectada:</strong> {prediction.letter ?? '–'}
            </div>
          </div>
        </Card>

        <Card className="v2-right">
          <div className="v2-panel-title">Letra detectada</div>
          {(() => {
            const success = theme === 'neo' && (prediction.distance != null && prediction.threshold && (1 - (prediction.distance as number)/(prediction.threshold as number)) >= 0.85 && !!prediction.letter);
            const cls = ['v2-detected', success ? 'neo-success' : ''].filter(Boolean).join(' ');
            return (
              <motion.div key={prediction.letter ?? 'none'} className={cls}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 220 }}
          >
            {prediction.letter ?? '–'}
          </motion.div>
            );
          })()}
          <div className="v2-confidence">
            {(() => {
              const conf = prediction.distance != null && prediction.threshold ? Math.max(0, Math.min(1, 1 - (prediction.distance as number) / (prediction.threshold as number))) : 0;
              const pct = Math.round(conf * 100);
              return (
                <div className="v2-progress-bar">
                  <motion.span
                    style={{ display: 'block', height: '100%', background: 'var(--primary)' }}
                    initial={false}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 140, damping: 18 }}
                  />
                </div>
              );
            })()}
          </div>
          <Stack gap={8}>
            <Button variant="ghost" onClick={refreshModel}>Cargar modelo</Button>
            <Button variant="danger" onClick={resetAll}>Limpiar BD</Button>
          </Stack>
        </Card>
      </div>
    </div>
  );
};

export default Vista2;
