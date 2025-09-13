import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SectionHeader from '../components/ui/SectionHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Stack from '../components/ui/Stack';
import RegisterModal from '../components/RegisterModal';
import ConfirmModal from '../components/ConfirmModal';
import TrainingChart from '../components/TrainingChart';
import HandCapture from '../components/HandCapture';
import type { Landmark } from '../lib/api';

// ========= Utilidades de modelo local (extraídas del HTML) =========
const LS_KEY = 'localStorageVista01';

type Dataset = {
  samples: Record<'A'|'E'|'I'|'O'|'U', number[][]>;
  centroids: Record<string, number[]>;
  thresholds: Record<string, number>;
};

function _dist(a: number[], b: number[]) {
  const dx = a[0]-b[0], dy = a[1]-b[1], dz = a[2]-b[2];
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

function extractFeatureVector(landmarks: Landmark[]): number[] {
  const pts = landmarks.map((p) => [Number(p.x||0), Number(p.y||0), Number(p.z||0)]);
  if (pts.length !== 21) throw new Error('expected 21 landmarks');
  const wrist = pts[0];
  const pts_rel = pts.map((p) => [p[0]-wrist[0], p[1]-wrist[1], p[2]-wrist[2]]);
  const middle_mcp = pts_rel[9];
  const base = _dist([0,0,0], middle_mcp);
  const mcp_points = [pts_rel[5], pts_rel[9], pts_rel[13], pts_rel[17]];
  const spread = (_dist(mcp_points[0], mcp_points[1]) + _dist(mcp_points[1], mcp_points[2]) + _dist(mcp_points[2], mcp_points[3])) / 3.0;
  const scale = Math.max(1e-6, base + spread);
  const pts_n = pts_rel.map((p) => [p[0]/scale, p[1]/scale, p[2]/scale]);
  const fingers = { thumb:[2,3,4], index:[5,6,8], middle:[9,10,12], ring:[13,14,16], pinky:[17,18,20] } as const;
  const feat: number[] = [];
  for (const [mcp_i, pip_i, tip_i] of Object.values(fingers)) {
    const tip = pts_n[tip_i], pip = pts_n[pip_i], mcp = pts_n[mcp_i];
    feat.push(_dist(tip, pip));
    feat.push(_dist(pip, mcp));
  }
  const tipIdx = [8,12,16,20];
  for (let i=0; i<tipIdx.length-1; i++) {
    feat.push(_dist(pts_n[tipIdx[i]], pts_n[tipIdx[i+1]]));
  }
  const zs = pts_n.map((p) => p[2]);
  const meanZ = zs.reduce((a,b)=>a+b,0)/zs.length;
  const varZ = zs.reduce((a,z)=>a+(z-meanZ)*(z-meanZ),0)/zs.length;
  feat.push(varZ);
  return feat;
}

function l2(a: number[], b: number[]) {
  const m = Math.min(a.length, b.length);
  let s = 0;
  for (let i=0; i<m; i++) { const d = (+a[i]) - (+b[i]); s += d*d; }
  return Math.sqrt(s);
}

function computeCentroids(byLetter: Record<string, number[][]>) {
  const centroids: Record<string, number[]> = {};
  for (const [L, vecs] of Object.entries(byLetter)) {
    if (!vecs || !vecs.length) continue;
    const m = vecs[0].length; const acc = new Array(m).fill(0);
    for (const v of vecs) { for (let i=0; i<m; i++) acc[i] += Number(v[i]||0); }
    centroids[L] = acc.map((x) => x / vecs.length);
  }
  return centroids;
}

function computeThresholds(byLetter: Record<string, number[][]>, centroids: Record<string, number[]>, k_std = 2.0) {
  const thresholds: Record<string, number> = {};
  const MIN_THRESH = 0.25;
  for (const [L, vecs] of Object.entries(byLetter)) {
    const c = centroids[L]; if (!c || !vecs || !vecs.length) continue;
    const ds = vecs.map((v) => l2(v, c)); if (!ds.length) continue;
    const mean = ds.reduce((a,b)=>a+b,0)/ds.length;
    const variance = ds.reduce((a,d)=>a+(d-mean)*(d-mean),0)/ds.length;
    const std = Math.sqrt(variance);
    thresholds[L] = Math.max(MIN_THRESH, mean + k_std*std);
  }
  return thresholds;
}

function predictWithThresholds(fv: number[], centroids: Record<string, number[]>, thresholds: Record<string, number>) {
  let best: string | null = null; let bestD = Infinity; let bestThr = 0;
  for (const [L, c] of Object.entries(centroids)) {
    const d = l2(fv, c); if (d < bestD) { bestD = d; best = L; bestThr = thresholds[L] || 0; }
  }
  if (best === null) return { letter: null as string | null, distance: Infinity, threshold: 0 };
  if (bestD <= bestThr && bestThr > 0) return { letter: best, distance: bestD, threshold: bestThr };
  return { letter: null as string | null, distance: bestD, threshold: bestThr };
}

function loadDataset(): Dataset {
  // Persistencia deshabilitada: siempre inicia vacío (no precarga)
  return { samples: { A: [], E: [], I: [], O: [], U: [] }, centroids: {}, thresholds: {} };
}

function saveDataset(_ds: Dataset) {
  // Persistencia deshabilitada: no guardar en localStorage
  try { localStorage.removeItem(LS_KEY); } catch {}
}

const Vista1: React.FC = () => {
  // Estado de cámara y landmarks (usando HandCapture)
  const [cameraOn, setCameraOn] = useState<boolean>(false);
  const lastHandsRef = useRef<Landmark[][]>([]);
  const [hasHands, setHasHands] = useState<boolean>(false);

  // Dataset local (vocales) y modelo
  const [dataset, setDataset] = useState<Dataset>(() => loadDataset());
  const [statusText, setStatusText] = useState<string>('Cargando...');
  const [statusClass, setStatusClass] = useState<'loading'|'ready'|'error'>('loading');
  const [resultMsg, setResultMsg] = useState<{ text: string; type: 'success'|'error'|'loading' } | null>(null);
  const [liveLetter, setLiveLetter] = useState<string | null>(null);
  const [liveMeta, setLiveMeta] = useState<string>('Sin datos entrenados');
  const [confPct, setConfPct] = useState<number>(0); // 0..100
  const [trained, setTrained] = useState<boolean>(false);
  const [recordingLetter, setRecordingLetter] = useState<'A'|'E'|'I'|'O'|'U'|null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<'A'|'E'|'I'|'O'|'U'|null>(null);
  const [registerOpen, setRegisterOpen] = useState<boolean>(false);
  const [chartOpen, setChartOpen] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [trainingProgress, setTrainingProgress] = useState<number>(0);
  const trainingTimerRef = useRef<number | null>(null);
  const [trainingSeries, setTrainingSeries] = useState<number[]>([]);

  const totalSamples = useMemo(() => (
    Object.values(dataset.samples).reduce((acc, arr) => acc + (arr?.length || 0), 0)
  ), [dataset.samples]);

  const selectedCount = useMemo(() => (
    selectedLetter ? (dataset.samples[selectedLetter]?.length || 0) : 0
  ), [dataset.samples, selectedLetter]);

  const progressPct = useMemo(() => {
    if (!totalSamples || totalSamples <= 0) return 0;
    return Math.min(100, Math.round((selectedCount / totalSamples) * 100));
  }, [selectedCount, totalSamples]);

  const vowels = useMemo(() => ['A','E','I','O','U'] as const, []);

  const onLandmarks = useCallback((hands: Landmark[][]) => {
    lastHandsRef.current = hands;
    setHasHands(!!hands && hands.length > 0);
  }, []);

  // Simula initializeMediapipe del HTML (con HandCapture siempre que se renderiza)
  useEffect(() => {
    // Asegurar que no haya datos previos en localStorage
    try { localStorage.removeItem(LS_KEY); } catch {}
  }, []);
  useEffect(() => {
    setStatusText('Mediapipe listo');
    setStatusClass('ready');
  }, []);

  // Función de reconstrucción previa eliminada: ahora se entrena solo bajo demanda con trainModel()

  const showResult = useCallback((message: string, type: 'success'|'error'|'loading') => {
    setResultMsg({ text: message, type });
  }, []);

  const startCamera = useCallback(() => {
    setCameraOn(true);
    showResult('Cámara iniciada correctamente', 'success');
  }, [showResult]);

  const stopCamera = useCallback(() => {
    setCameraOn(false);
    showResult('Cámara detenida', 'success');
  }, [showResult]);

  // Registro manual removido en favor de registro automático con toggle por vocal

  const stopRecording = useCallback(() => {
    if (recordingLetter) {
      // eslint-disable-next-line no-console
      console.log('[Vista01] Deteniendo registro automático de', recordingLetter);
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecordingLetter(null);
    setStatusText('Registro detenido');
  }, [recordingLetter]);

  const startRecording = useCallback((letter: 'A'|'E'|'I'|'O'|'U') => {
    if (!cameraOn) { showResult('Enciende la cámara antes de registrar.', 'error'); return; }
    if (!hasHands) { showResult('Coloca la mano en cámara para empezar a registrar.', 'error'); return; }
    setRecordingLetter(letter);
    setTrained(false);
    setStatusText(`Registrando muestras de "${letter}"...`);
    // Captura periódica: 4 muestras/seg (cada 250ms)
    recordTimerRef.current = window.setInterval(() => {
      const lms = lastHandsRef.current?.[0];
      if (!lms || lms.length !== 21) return;
      try {
        const fv = extractFeatureVector(lms);
        setDataset((prev) => {
          const ds: Dataset = { ...prev, samples: { ...prev.samples } };
          ds.samples[letter] = [...(ds.samples[letter] || []), fv];
          // Guardar solo en memoria (persistencia deshabilitada)
          saveDataset(ds);
          return ds;
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Vista01] Error al registrar muestra automática:', e);
      }
    }, 250);
  }, [cameraOn, hasHands, showResult]);

  const toggleRecord = useCallback((letter: 'A'|'E'|'I'|'O'|'U') => {
    setSelectedLetter(letter);
    if (recordingLetter === letter) {
      stopRecording();
    } else {
      // Si hay otro en curso, detenerlo primero
      if (recordingLetter) stopRecording();
      startRecording(letter);
    }
  }, [recordingLetter, startRecording, stopRecording]);

  const trainModel = useCallback(() => {
    // Simular progreso de entrenamiento y luego construir el modelo
    if (Object.values(dataset.samples).every(arr => (arr?.length || 0) === 0)) {
      showResult('No hay datos suficientes para entrenar. Agrega muestras primero.', 'error');
      return;
    }
    setTrainingProgress(0);
    setTrainingSeries([0]);
    if (trainingTimerRef.current) {
      clearInterval(trainingTimerRef.current);
      trainingTimerRef.current = null;
    }
    // Mostrar barra de progreso
    setChartOpen(true);
    trainingTimerRef.current = window.setInterval(() => {
      setTrainingProgress((p) => {
        const next = Math.min(100, p + Math.max(3, Math.round(8 * Math.random())));
        setTrainingSeries((s) => [...s, next]);
        if (next >= 100) {
          if (trainingTimerRef.current) {
            clearInterval(trainingTimerRef.current);
            trainingTimerRef.current = null;
          }
          // Entrenar a partir del dataset en memoria
          const centroids = computeCentroids(dataset.samples as unknown as Record<string, number[][]>);
          const thresholds = computeThresholds(dataset.samples as unknown as Record<string, number[][]>, centroids);
          const updated: Dataset = { ...dataset, centroids, thresholds };
          saveDataset(updated);
          setDataset(updated);
          const hasModel = Object.keys(centroids || {}).length > 0;
          setTrained(hasModel);
          if (hasModel) {
            setConfirmOpen(true);
            showResult('Modelo entrenado con éxito. Puedes ver la vocal detectada.', 'success');
          } else {
            showResult('Entrenamiento incompleto. Agrega más muestras.', 'error');
          }
        }
        return next;
      });
    }, 140);
  }, [dataset, showResult]);

  // Predicción en vivo local (si hay modelo)
  const updateLivePrediction = useCallback(() => {
    try {
      const lms = lastHandsRef.current?.[0];
      if (!lms) { setLiveLetter(null); setLiveMeta('Sin mano detectada'); setConfPct(0); return; }
      if (!trained) {
        setLiveLetter(null);
        setLiveMeta('Entrena el modelo para empezar');
        setConfPct(0);
        return;
      }
      if (!dataset.centroids || Object.keys(dataset.centroids).length === 0) {
        setLiveLetter(null);
        setLiveMeta('Sin datos entrenados');
        setConfPct(0);
        return;
      }
      const fv = extractFeatureVector(lms);
      const pred = predictWithThresholds(fv, dataset.centroids, dataset.thresholds);
      const thr = Number(pred.threshold || 0);
      const dist = Number(pred.distance || 0);
      const conf = (thr > 0 && isFinite(dist)) ? Math.max(0, Math.min(1, 1 - dist / thr)) : 0;
      setConfPct(Math.round(conf * 100));
      if (pred.letter && conf >= 0.5) {
        setLiveLetter(pred.letter);
        setLiveMeta(`dist=${dist.toFixed(3)} | thr=${thr.toFixed(3)} | conf=${Math.round(conf*100)}%`);
      } else {
        setLiveLetter(null);
        setLiveMeta(`No aceptado | dist=${dist.toFixed(3)} thr=${thr.toFixed(3)} | conf=${Math.round(conf*100)}%`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('updateLivePrediction error', err);
    }
  }, [dataset.centroids, dataset.thresholds, trained]);

  // Loop simple de predicción cuando la cámara está activa
  useEffect(() => {
    if (!cameraOn) return;
    let raf: number | null = null;
    const loop = () => {
      updateLivePrediction();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [cameraOn, updateLivePrediction]);

  // Detener grabación si se apaga la cámara
  useEffect(() => {
    if (!cameraOn && recordTimerRef.current) {
      stopRecording();
    }
  }, [cameraOn, stopRecording]);

  // Limpiar intervalo de grabación al desmontar
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (trainingTimerRef.current) {
        clearInterval(trainingTimerRef.current);
        trainingTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div>
      <SectionHeader title="Vista 1 — Detección de Vocales" subtitle="Pipeline local (A, E, I, O, U) con dataset en memoria y MediaPipe" />
      <div style={{ display: 'grid', justifyContent: 'center', gridTemplateColumns: chartOpen ? '1090px 600px' : '1200px', gap: 12 }}>
      <div style={{ width: 1090 }}>
      <Card className="shadow-hover fade-in">
        <div className={`status ${statusClass}`} style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 12 }}>{statusText}</div>

        {/* Main area */}
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'max-content 360px', gap: 50, alignItems: 'start' }}>
              {/* Left: camera */}
              <div style={{ justifySelf: 'start' }}>
                <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid #ddd' }}>
                    <HandCapture onLandmarks={onLandmarks} cameraOn={cameraOn} mirror={true} />
                  </div>
                </div>
              </div>
              {/* Right: live detection panel */}
              <div className="live-card shadow-hover fade-in" style={{ padding: 16, borderRadius: 10, background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', textAlign: 'center', minWidth: 360, width: 360, justifySelf: 'end', alignSelf: 'start' }}>
                <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 6, fontWeight: 700 }}>Vocal detectada</div>
                <div className="vowel" style={{ fontSize: 68, fontWeight: 800, letterSpacing: 4, margin: '0 0 10px', color: '#343a40' }}>{liveLetter ?? '-'}</div>
                <div className="meta" style={{ color: '#666', fontSize: 14, marginBottom: 10 }}>{liveMeta}</div>
                <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 6, fontWeight: 600 }}>Confianza</div>
                <div style={{ height: 10, background: '#e9ecef', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${confPct}%`, background: confPct >= 50 ? '#198754' : '#0d6efd', transition: 'width 120ms linear' }} />
                </div>
                <div style={{ fontSize: 12, color: '#6c757d', marginTop: 4 }}>{confPct}%</div>
                <div style={{ fontSize: 12, color: '#6c757d', marginTop: 4 }}>Umbral de aceptación: 50%</div>
                {/* Actions directly under vocal panel */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 12 }}>
                  {!cameraOn ? (
                    <Button className="soft-hover" fullWidth onClick={startCamera}>Activar cámara</Button>
                  ) : (
                    <Button className="soft-hover" fullWidth variant="danger" onClick={stopCamera}>Desactivar cámara</Button>
                  )}
                  <Button
                    className="soft-hover"
                    fullWidth
                    onClick={() => {
                      if (recordingLetter) {
                        stopRecording();
                      } else {
                        setRegisterOpen(true);
                      }
                    }}
                    disabled={!cameraOn}
                  >
                    {recordingLetter ? 'Detener registro' : 'Registrar'}
                  </Button>
                  <Button
                    className="soft-hover"
                    fullWidth
                    variant="primary"
                    onClick={trainModel}
                    disabled={Object.values(dataset.samples).every(arr => (arr?.length || 0) === 0)}
                  >
                    Entrenar modelo
                  </Button>
                  <Button className="soft-hover" fullWidth variant="ghost" onClick={() => setChartOpen((v) => !v)}>
                    {chartOpen ? 'Ocultar estadísticas' : 'Ver estadísticas'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Counters compact */}
            <div style={{ marginTop: 12, background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 6, padding: 12 }}>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontWeight: 600 }}>
                <span>Vocal seleccionada: {selectedLetter ?? '-'}</span>
                <span>Total muestras (todas letras): {totalSamples}</span>
                <span>Muestras de la letra: {selectedLetter ? selectedCount : 0}</span>
                <span>Vocal detectada: {liveLetter ?? '–'}</span>
              </div>
            </div>
        </div>

        {resultMsg && (
          <div className={`result ${resultMsg.type}`} style={{ margin: '10px 0', padding: 12, borderRadius: 6, textAlign: 'center', fontWeight: 600 }}>
            {resultMsg.text}
          </div>
        )}
      </Card>
      </div>

      {chartOpen && (
        <div style={{ width: 600 }}>
        <Card className="slide-in-right shadow-hover">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Estadísticas de entrenamiento</div>
          <div style={{ height: 10, background: '#e9ecef', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${trainingProgress}%`, background: '#0d6efd', transition: 'width 150ms linear' }} />
          </div>
          <div style={{ fontSize: 12, color: '#6c757d', marginTop: 4 }}>{trainingProgress}%</div>
          <div style={{ marginTop: 12 }}>
            <TrainingChart series={trainingSeries} height={220} />
          </div>
        </Card>
        </div>
      )}
      </div>

      {/* Modals */}
      <RegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onConfirm={(L) => {
          setRegisterOpen(false);
          setSelectedLetter(L);
          // comienza el registro automático para la letra elegida
          if (recordTimerRef.current) stopRecording();
          startRecording(L);
        }}
      />
      <ConfirmModal
        open={confirmOpen}
        title="Modelo entrenado"
        message="El modelo se entrenó con éxito. Ahora puedes ver la vocal detectada en vivo."
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default Vista1;
