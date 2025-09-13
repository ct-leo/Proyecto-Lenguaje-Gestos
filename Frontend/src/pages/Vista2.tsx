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
  const [confidence, setConfidence] = useState<number>(0);
  const [cameraOn, setCameraOn] = useState<boolean>(true);
  const [mirror, setMirror] = useState<boolean>(true);
  const theme: ThemeName = getTheme();
  const [hasHands, setHasHands] = useState<boolean>(false);
  const [errorShake, setErrorShake] = useState<boolean>(false);
  // UI state for parity with example
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  // Batch capture like HTML demo (más ágil)
  const BATCH_SIZE = 3;           // antes 10
  const AUTO_FLUSH_MS = 400;      // antes 1200
  const SAMPLE_COOLDOWN_MS = 90;  // evita duplicados muy seguidos
  const batchRef = useRef<{ samples: { landmarks: Landmark[] }[] }>({ samples: [] });
  const lastFlushAtRef = useRef<number>(0);
  const insertedCountRef = useRef<number>(0);
  const lastSampleAtRef = useRef<number>(0);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>((): Record<string, number> => {
    const init: Record<string, number> = {};
    for (const L of letters) init[L] = 0;
    return init;
  });
  // smoothing prediction confidence
  const smoothWindow = useRef<number[]>([]);
  const SMOOTH_SIZE = 4;      // antes 7, respuesta más rápida
  const PREDICT_COOLDOWN_MS = 110; // antes 150, más cercano al HTML
  const lastPredictAtRef = useRef<number>(0);
  const predictLoopRef = useRef<number | null>(null);
  const predictInFlightRef = useRef<boolean>(false);

  // Hysteresis/lock like ejemplo2_frontend.html
  const HOLD_MS = 280;              // mantener menos tiempo
  const RELAX_RATIO = 1.12;         // relajar un poco para no perder la letra
  const LOCK_CONF_THRESHOLD = 0.45; // requiere un poco menos para fijar
  const UNLOCK_RELAX_RATIO = 1.18;  // desbloqueo más ágil
  const UNLOCK_GRACE_MS = 550;      // ventana de gracia más corta
  const CHANGE_CONFIRM_FRAMES = 2;  // cambia de letra más rápido

  const holdLetterRef = useRef<string | null>(null);
  const holdThrRef = useRef<number>(0);
  const holdAtRef = useRef<number>(0);

  const lockLetterRef = useRef<string | null>(null);
  const lockThrRef = useRef<number>(0);
  const lockUpdatedAtRef = useRef<number>(0);
  const mismatchCountRef = useRef<number>(0);
  const lastConfRef = useRef<number>(0);
  const smoothLettersRef = useRef<(string | null)[]>([]);

  function majority(arr: (string | null)[]) {
    const counts: Record<string, number> = {};
    for (const v of arr) { if (!v) continue; counts[v] = (counts[v] || 0) + 1; }
    let best: string | null = null; let bestC = 0;
    for (const k in counts) { if (counts[k] > bestC) { best = k; bestC = counts[k]; } }
    return best;
  }

  // Cargar modelo y progreso al montar (equivalente al HTML original)
  useEffect(() => {
    (async () => {
      try { await refreshModel(); } catch {}
      try { await refreshProgress(); } catch {}
      setStatusMsg('Listo');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLandmarks = useCallback((hands: Landmark[][]) => {
    lastHandsRef.current = hands;
    const have = !!hands && hands.length > 0;
    setHasHands(have);
    if (!have) {
      // Sin manos: limpiar estados y hacer decaer la confianza
      holdLetterRef.current = null; holdThrRef.current = 0; holdAtRef.current = 0;
      lockLetterRef.current = null; lockThrRef.current = 0; mismatchCountRef.current = 0;
      smoothLettersRef.current.push(null);
      if (smoothLettersRef.current.length > SMOOTH_SIZE) smoothLettersRef.current.shift();
      // Decaimiento suave de confianza hacia 0
      lastConfRef.current = Math.max(0, lastConfRef.current * 0.85 - 0.02);
      setConfidence(lastConfRef.current);
      setPrediction((p) => ({ ...p, letter: null }));
    }
    // While capturing, push first hand landmarks and auto-flush
    if (isCapturing && have) {
      const lms = hands[0];
      if (Array.isArray(lms) && lms.length === 21) {
        const now = performance.now();
        // cooldown para no saturar con frames idénticos
        if (now - lastSampleAtRef.current < SAMPLE_COOLDOWN_MS) return;
        lastSampleAtRef.current = now;
        batchRef.current.samples.push({ landmarks: JSON.parse(JSON.stringify(lms)) });
        const shouldFlush = batchRef.current.samples.length >= BATCH_SIZE || (now - lastFlushAtRef.current) >= AUTO_FLUSH_MS;
        if (shouldFlush) {
          const payload = { letter, samples: batchRef.current.samples.splice(0, batchRef.current.samples.length) };
          lastFlushAtRef.current = now;
          // Fire-and-forget
          api.samplesBatch(letter, payload.samples as any)
            .then((resp: any) => {
              if (resp && resp.status === 'ok') {
                const inc = Number(resp.inserted || payload.samples.length || 0) || 0;
                insertedCountRef.current += inc;
                setSessionCounts((prev) => ({ ...prev, [letter]: (prev[letter] || 0) + inc }));
                setStatusMsg(`Insertadas ${insertedCountRef.current} muestras para ${letter}.`);
                // Refresh DB totals non-blocking without capturing closure deps
                api.progress().then((data) => setProgress(data)).catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
    }
  }, [isCapturing, letter]);

  const refreshProgress = useCallback(async (clearSessionForCurrent: boolean = false) => {
    try {
      const data = await api.progress();
      setProgress(data);
    } catch {
      setProgress(null);
    } finally {
      if (clearSessionForCurrent) {
        // limpiar la barra de SESIÓN para la letra actual
        setSessionCounts((prev) => ({ ...prev, [letter]: 0 }));
        setStatusMsg(`Progreso refrescado. Barra de sesión limpiada para ${letter}.`);
      }
    }
  }, [letter]);

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

  // captureOnce no longer needed; batching occurs in onLandmarks

  const toggleCapture = useCallback(async () => {
    if (isCapturing) {
      setIsCapturing(false);
      setStatusMsg('Captura detenida.');
      return;
    }
    // start capture
    insertedCountRef.current = 0;
    lastFlushAtRef.current = performance.now();
    batchRef.current.samples = [];
    setIsCapturing(true);
    setStatusMsg('Capturando muestras...');
  }, [isCapturing]);

  const train = useCallback(async () => {
    const resp = await api.train();
    if ((resp as any).status === 'ok') {
      await refreshModel();
      await refreshProgress();
      setStatusMsg('Modelo entrenado y cargado');
      alert('Modelo entrenado');
    } else {
      alert('Error al entrenar');
    }
  }, [refreshModel, refreshProgress]);

  const predictOnce = useCallback(async () => {
    if (predictInFlightRef.current) return;
    const lms = lastHandsRef.current?.[0];
    if (!lms || lms.length !== 21) {
      // No hay landmarks válidos: decaimiento y limpiar letra
      holdLetterRef.current = null; holdThrRef.current = 0; holdAtRef.current = 0;
      lockLetterRef.current = null; lockThrRef.current = 0; mismatchCountRef.current = 0;
      smoothLettersRef.current.push(null);
      if (smoothLettersRef.current.length > SMOOTH_SIZE) smoothLettersRef.current.shift();
      lastConfRef.current = Math.max(0, lastConfRef.current * 0.85 - 0.02);
      setPrediction((p) => ({ ...p, letter: null }));
      setConfidence(lastConfRef.current);
      return;
    }
    predictInFlightRef.current = true;
    const resp = await api.predict(lms);
    if ((resp as any).status === 'ok') {
      let L: string | null = (resp as any).letter ?? null;
      const dist: number = (resp as any).distance ?? Infinity;
      const thr: number = (resp as any).threshold ?? 0;
      const shapeOK: boolean = !!(resp as any).shape_ok;

      const nowH = performance.now();
      const within = (dist <= thr && thr > 0);
      if (within && L) {
        holdLetterRef.current = L; holdThrRef.current = thr; holdAtRef.current = nowH;
      } else if (!L && holdLetterRef.current && holdThrRef.current > 0) {
        if (dist <= holdThrRef.current * RELAX_RATIO && (nowH - holdAtRef.current) <= 1000) {
          L = holdLetterRef.current;
        } else if ((nowH - holdAtRef.current) > HOLD_MS) {
          holdLetterRef.current = null; holdThrRef.current = 0;
        }
      }

      let conf = 0;
      if (thr > 0 && isFinite(dist)) {
        const baseThr = holdLetterRef.current ? (holdThrRef.current || thr) : thr;
        const ratio = Math.max(0, Math.min(1.25, dist / baseThr));
        const gamma = 2.2;
        conf = Math.max(0, Math.min(1, 1 - Math.pow(ratio, gamma)));
        if (dist <= thr) conf = Math.max(conf, 0.9);
        if (L && holdLetterRef.current === L) conf = Math.max(conf, 0.85);
      }
      if (!shapeOK) { L = null; conf = 0; }

      if (L && conf >= LOCK_CONF_THRESHOLD) {
        lockLetterRef.current = L;
        lockThrRef.current = (thr * 0.9) || holdThrRef.current || lockThrRef.current;
        lockUpdatedAtRef.current = nowH;
        mismatchCountRef.current = 0;
      } else if (lockLetterRef.current) {
        const nearLocked = isFinite(dist) && lockThrRef.current > 0 && (dist <= lockThrRef.current * UNLOCK_RELAX_RATIO);
        if (nearLocked || (nowH - lockUpdatedAtRef.current) <= UNLOCK_GRACE_MS) {
          L = lockLetterRef.current;
          conf = Math.max(conf, 0.88);
          mismatchCountRef.current = 0;
        } else {
          mismatchCountRef.current++;
          if (mismatchCountRef.current >= CHANGE_CONFIRM_FRAMES) {
            lockLetterRef.current = null; lockThrRef.current = 0; mismatchCountRef.current = 0;
          } else {
            L = lockLetterRef.current; conf = Math.max(conf, 0.8);
          }
        }
      }

      smoothLettersRef.current.push(L);
      if (smoothLettersRef.current.length > SMOOTH_SIZE) smoothLettersRef.current.shift();
      const final = majority(smoothLettersRef.current);
      lastConfRef.current = (lastConfRef.current * 0.7) + (conf * 0.3);

      // Update UI: store last distance/threshold and confidence like the HTML demo
      setPrediction({ letter: final ?? null, distance: dist, threshold: thr });
      setConfidence(lastConfRef.current);
      const out = lastConfRef.current;
      predictInFlightRef.current = false;
      return out;
    } else {
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
    }
    predictInFlightRef.current = false;
  }, []);

  // auto prediction loop with cooldown
  useEffect(() => {
    if (!cameraOn) return;
    const loop = async () => {
      const now = performance.now();
      if (now - lastPredictAtRef.current >= PREDICT_COOLDOWN_MS) {
        lastPredictAtRef.current = now;
        try { await predictOnce(); } catch { } finally { predictInFlightRef.current = false; }
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
              <Button variant="danger" onClick={() => { setIsCapturing(false); setCameraOn(false); setStatusMsg('Cámara detenida'); }}>Detener cámara</Button>
            )}
            <Button onClick={toggleCapture}>{isCapturing ? 'Detener' : 'Entrenar (capturar muestras)'}</Button>
            <Button onClick={train}>Entrenar Modelo</Button>
            <Button variant="ghost" onClick={() => refreshProgress(true)}>Refrescar progreso</Button>
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
            const success = theme === 'neo' && (prediction.distance != null && prediction.threshold && (1 - (prediction.distance as number) / (prediction.threshold as number)) >= 0.85 && !!prediction.letter);
            const cls = ['v2-detected', success ? 'neo-success' : ''].filter(Boolean).join(' ');
            return (
              <motion.div key={prediction.letter ?? 'none'} className={cls}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 18, stiffness: 220 }}
              >
                {prediction.letter ?? 'Procesando...'}
              </motion.div>
            );
          })()}
          <div className="v2-confidence">
            {(() => {
              const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
              return (
                <>
                  <div className="v2-progress-bar">
                    <span className="v2-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mono muted" style={{ textAlign: 'center', marginTop: 6 }}>Confianza: {pct}%</div>
                </>
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