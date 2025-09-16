import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HandCapture from '../components/HandCapture';
import { api, type Landmark } from '../lib/api';
import Card from '../components/ui/Card';
import Stack from '../components/ui/Stack';
// import Select from '../components/ui/Select';
import SelectMenu from '../components/ui/SelectMenu';
import Button from '../components/ui/Button';
// SectionHeader removido para una cabecera más limpia

import '../styles/vista2.css';
import { getTheme, type ThemeName } from '../lib/theme';

const Vista2: React.FC = () => {
  const letters = useMemo(() => {
    const base = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A..Z
    // Insertar Ñ entre N y O (después de 'N')
    const out: string[] = [];
    for (const L of base) {
      out.push(L);
      if (L === 'N') out.push('Ñ');
    }
    return out;
  }, []);
  const [letter, setLetter] = useState<string>('A');
  const [delLetter, setDelLetter] = useState<string>('A');
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
  const [dynamicMode, setDynamicMode] = useState<boolean>(false);
  const [modelLoading, setModelLoading] = useState<boolean>(false);
  const [modelInfo, setModelInfo] = useState<any>(null);
  // Ref para leer el valor actual dentro de callbacks sin depender de closures
  const dynamicRef = useRef<boolean>(false);
  useEffect(() => { dynamicRef.current = dynamicMode; }, [dynamicMode]);
  // Voz: habilitar/deshabilitar narración de la letra detectada
  const [speakEnabled, setSpeakEnabled] = useState<boolean>(true);
  const lastSpokenRef = useRef<string | null>(null);
  const lastSpokenAtRef = useRef<number>(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  // Algunos navegadores no exponen voiceURI estable; usamos clave name::lang
  const [voiceKey, setVoiceKey] = useState<string>('');
  const [speakVolume, setSpeakVolume] = useState<number>(1);
  // Refs para evitar closures obsoletos en predictOnce
  const speakEnabledRef = useRef<boolean>(true);
  const voiceKeyRef = useRef<string>('');
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speakVolumeRef = useRef<number>(1);
  const [dynDebug, setDynDebug] = useState<string>('');
  // Helper para hablar textos de UI reutilizando la configuración actual
  const speakText = useCallback((text: string) => {
    try {
      if (!speakEnabledRef.current) return;
      if (!text || !text.trim()) return;
      const utter = new SpeechSynthesisUtterance(text);
      const k = voiceKeyRef.current;
      const vs = voicesRef.current || [];
      if (k) {
        const v = vs.find((vv) => `${vv.name}::${vv.lang}` === k);
        if (v) { utter.voice = v; utter.lang = v.lang || 'es-ES'; } else { utter.lang = 'es-ES'; }
      } else { utter.lang = 'es-ES'; }
      utter.rate = 0.98;
      utter.pitch = 1.0;
      utter.volume = Math.max(0, Math.min(1, speakVolumeRef.current));
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch {}
  }, []);
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
  const SMOOTH_SIZE = 2;      // respuesta aún más rápida (vigilar parpadeo)
  const PREDICT_COOLDOWN_MS = 75; // menor carga y más estable
  const lastPredictAtRef = useRef<number>(0);
  const predictLoopRef = useRef<number | null>(null);
  const predictInFlightRef = useRef<boolean>(false);

  // Hysteresis/lock like ejemplo2_frontend.html
  const HOLD_MS = 280;              // mantener menos tiempo
  const RELAX_RATIO = 1.12;         // relajar un poco para no perder la letra
  const LOCK_CONF_THRESHOLD = 0.40; // fija un poco antes para mayor fluidez
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
  // Historial para modo dinámico
  const confHistRef = useRef<number[]>([]);
  const shapeHistRef = useRef<boolean[]>([]);
  // Hold corto para dinámicos (J/Ñ): mantiene confianza mientras se sostiene el gesto en movimiento
  const lastDynAtRef = useRef<number>(0);
  const lastDynLetterRef = useRef<string | null>(null);
  const DYN_WINDOW = 18;
  const DYN_MIN_AVG_CONF = 0.45;     // más permisivo
  const DYN_MIN_SHAPE_OK_FRAC = 0.20; // más permisivo
  // Heurística de movimiento para diferenciar J (dinámica) de I (estática)
  const l8yHistRef = useRef<number[]>([]); // historial de Y del tip del índice (landmark 8)
  const l8xHistRef = useRef<number[]>([]); // historial de X del tip del índice (landmark 8)
  const J_MIN_Y_AMPL = 0.008;   // más permisivo
  const J_MIN_ENERGY_Y = 0.035; // más permisivo
  const J_MIN_X_AMPL = 0.008;   // más permisivo
  const J_MIN_ENERGY_X = 0.035; // más permisivo

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
  }, [dynamicMode]);

  // Cargar voces del sistema para SpeechSynthesis
  useEffect(() => {
    let tries = 0;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (!v || v.length === 0) {
        if (tries < 10) { tries++; setTimeout(loadVoices, 200); }
        return;
      }
      setVoices(v);
      if (!voiceKey && v.length) {
        const pref = v.find((vv) => (vv.lang || '').toLowerCase().startsWith('es')) || v[0];
        if (pref) setVoiceKey(`${pref.name}::${pref.lang}`);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { (window.speechSynthesis as any).onvoiceschanged = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronizar refs de voz/volumen con estado actual
  useEffect(() => { speakEnabledRef.current = speakEnabled; }, [speakEnabled]);
  useEffect(() => { voiceKeyRef.current = voiceKey; }, [voiceKey]);
  useEffect(() => { voicesRef.current = voices; }, [voices]);
  useEffect(() => { speakVolumeRef.current = speakVolume; }, [speakVolume]);

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
      // limpiar historiales dinámicos
      confHistRef.current = [];
      shapeHistRef.current = [];
      l8yHistRef.current = [];
      l8xHistRef.current = [];
      // Decaimiento suave de confianza hacia 0
      lastConfRef.current = Math.max(0, lastConfRef.current * 0.85 - 0.02);
      setConfidence(lastConfRef.current);
      setPrediction((p) => ({ ...p, letter: null }));
    }
    // Registrar trayectoria vertical del tip del índice siempre que haya mano (para modo dinámico)
    if (have) {
      const lms0 = hands[0];
      if (Array.isArray(lms0) && lms0.length === 21) {
        const y8 = typeof lms0[8]?.y === 'number' ? Number(lms0[8].y) : null;
        const x8 = typeof lms0[8]?.x === 'number' ? Number(lms0[8].x) : null;
        if (y8 != null && isFinite(y8)) { l8yHistRef.current.push(y8); if (l8yHistRef.current.length > DYN_WINDOW) l8yHistRef.current.shift(); }
        if (x8 != null && isFinite(x8)) { l8xHistRef.current.push(x8); if (l8xHistRef.current.length > DYN_WINDOW) l8xHistRef.current.shift(); }
      }
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

  const refreshProgress = useCallback(async (clearSessionForCurrent: boolean = false, announce: boolean = false) => {
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
      if (announce) {
        // voz para confirmación solo cuando el usuario hace clic en el botón
        speakText('Refrescado exitoso');
      }
    }
  }, [letter]);

  const refreshModel = useCallback(async (announce: boolean = false) => {
    setModelLoading(true);
    try {
      const data = await api.getModel();
      if (data && data.status === 'ok') {
        setModelInfo({
          id: data.model_id,
          letters: data.letters,
          when: data.created_at,
        });
        setStatusMsg('Modelo cargado en memoria');
        if (announce) speakText('Carga exitosa');
      } else {
        setModelInfo(null);
        setStatusMsg('No hay modelo entrenado');
      }
    } catch {
      setModelInfo(null);
      setStatusMsg('No se pudo cargar el modelo');
    } finally {
      setTimeout(() => setModelLoading(false), 250);
    }
  }, [dynamicMode]);

  // const refreshLast = useCallback(async () => {
  //   try {
  //     await api.lastDetected();
  //   } catch {
  //     // noop
  //   }
  // }, [dynamicMode]);

  // captureOnce no longer needed; batching occurs in onLandmarks

  const toggleCapture = useCallback(async () => {
    if (isCapturing) {
      setIsCapturing(false);
      setStatusMsg('Captura detenida.');
      speakText('Deteniendo muestras');
      return;
    }
    // start capture
    insertedCountRef.current = 0;
    lastFlushAtRef.current = performance.now();
    batchRef.current.samples = [];
    setIsCapturing(true);
    setStatusMsg('Capturando muestras...');
    speakText('Capturando muestras');
  }, [isCapturing]);

  const train = useCallback(async () => {
    const resp = await api.train();
    if ((resp as any).status === 'ok') {
      await refreshModel();
      await refreshProgress();
      setStatusMsg('Modelo entrenado y cargado');
      speakText('Entrenamiento exitoso');
    } else {
      setStatusMsg('Error al entrenar');
    }
  }, [refreshModel, refreshProgress]);

  const lastHandIdxRef = useRef<number>(0);
  const predictOnce = useCallback(async () => {
    if (predictInFlightRef.current) return;
    const handsArr = Array.isArray(lastHandsRef.current) ? lastHandsRef.current : [];
    if (!handsArr.length || !Array.isArray(handsArr[0]) || handsArr[0].length !== 21) {
      // No hay landmarks válidos: decaimiento y limpiar letra
      holdLetterRef.current = null; holdThrRef.current = 0; holdAtRef.current = 0;
      lockLetterRef.current = null; lockThrRef.current = 0; mismatchCountRef.current = 0;
      smoothLettersRef.current.push(null);
      if (smoothLettersRef.current.length > SMOOTH_SIZE) smoothLettersRef.current.shift();
      confHistRef.current = [];
      shapeHistRef.current = [];
      lastConfRef.current = Math.max(0, lastConfRef.current * 0.85 - 0.02);
      setPrediction((p) => ({ ...p, letter: null }));
      setConfidence(lastConfRef.current);
      return;
    }
    predictInFlightRef.current = true;
    const dynFlag = !!dynamicRef.current;
    // Selección ligera: elegir 1 mano por frame por área de bbox con "stickiness" para evitar saltos
    const evalHands = handsArr.slice(0, 2);
    const areas = evalHands.map((h) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of h as any) { const x = p.x, y = p.y; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      const w = Math.max(1e-6, maxX - minX), hgt = Math.max(1e-6, maxY - minY); return w * hgt;
    });
    let pick = 0;
    if (evalHands.length === 2) {
      // preferir la mano previamente elegida si su área no es notablemente menor (histeresis 15%)
      const prev = Math.min(lastHandIdxRef.current, evalHands.length - 1);
      const other = prev === 0 ? 1 : 0;
      if (areas[prev] >= areas[other] * 0.85) pick = prev; else pick = other;
    }
    lastHandIdxRef.current = pick;
    const lms = evalHands[pick];
    const resp = await api.predict(lms, { dynamic: dynFlag });
    if ((resp as any).status === 'ok') {
      let L: string | null = (resp as any).letter ?? null;
      const dist: number = (resp as any).distance ?? Infinity;
      const thr: number = (resp as any).threshold ?? 0;
      const shapeOK_resp: boolean = !!(resp as any).shape_ok;
      const cand: string | null = (resp as any).candidate ?? null;
      const candDist: number | null = (resp as any).candidate_distance ?? null;
      const acceptedDyn: boolean = !!(resp as any).accepted_dynamic;
      // Registrar Y/X del tip (8) de la mano elegida
      const y8pred = typeof lms[8]?.y === 'number' ? Number(lms[8].y) : null;
      const x8pred = typeof lms[8]?.x === 'number' ? Number(lms[8].x) : null;
      if (y8pred != null && isFinite(y8pred)) { l8yHistRef.current.push(y8pred); if (l8yHistRef.current.length > DYN_WINDOW) l8yHistRef.current.shift(); }
      if (x8pred != null && isFinite(x8pred)) { l8xHistRef.current.push(x8pred); if (l8xHistRef.current.length > DYN_WINDOW) l8xHistRef.current.shift(); }
      // Debug básico siempre (estado backend)
      setDynDebug(`dyn=${dynFlag} accDyn=${acceptedDyn} | cand=${cand ?? '–'} cDist=${isFinite(candDist as number)?Number(candDist).toFixed(3):'–'} dist=${isFinite(dist)?dist.toFixed(3):'∞'} thr=${thr?thr.toFixed(3):'–'} L=${L ?? '∅'}`);

      const nowH = performance.now();
      // Flag para decidir si al final aplicamos un piso de confianza dinámico
      let dynShouldFloor = false;
      const within = (dist <= thr && thr > 0);
      // Evitar mantener/recuperar lock temprano si aún no hay letra en evaluación
      const skipEarlyLock = false;
      if (!skipEarlyLock) {
        if (within && L) {
          holdLetterRef.current = L; holdThrRef.current = thr; holdAtRef.current = nowH;
        } else if (!L && holdLetterRef.current && holdThrRef.current > 0) {
          if (dist <= holdThrRef.current * RELAX_RATIO && (nowH - holdAtRef.current) <= 1000) {
            L = holdLetterRef.current;
          } else if ((nowH - holdAtRef.current) > HOLD_MS) {
            holdLetterRef.current = null; holdThrRef.current = 0;
          }
        }
      }

      let conf = 0;
      if (thr > 0 && isFinite(dist)) {
        const baseThr = holdLetterRef.current ? (holdThrRef.current || thr) : thr;
        const ratio = Math.max(0, Math.min(1.25, dist / baseThr));
        // Curva un poco más agresiva para subir antes la confianza
        const gamma = 1.8;
        conf = Math.max(0, Math.min(1, 1 - Math.pow(ratio, gamma)));
        if (dist <= thr) conf = Math.max(conf, 0.9);
        if (L && holdLetterRef.current === L) conf = Math.max(conf, 0.85);
        // Mejora de fluidez para estáticos cerca del umbral: si estás muy cerca, da un empujón
        if (!dynamicRef.current && dist <= baseThr * 1.05) {
          conf = Math.max(conf, 0.85);
        }
      }
      // Si backend aceptó dinámico (p. ej., gesto en movimiento), no anulamos L por shape_ok
      let shapeOK = shapeOK_resp;
      if (acceptedDyn) {
        // Aceptación dinámica del backend: el incremento real de confianza se aplica más adelante
        const isZ = (cand === 'Z') || (L === 'Z');
        shapeOK = false; // dinámico no requiere forma estricta
        if (!isZ && dynamicRef.current) {
          // Sin efectos aquí; el manejo de promoción ocurre en la sección de movimiento
        }
      } else if (!shapeOK) {
        // Sin forma válida y sin aceptación dinámica: no incrementamos confianza para evitar falsos positivos.
        L = null; conf = 0;
      }

      // Aceleración para estáticos (modo dinámico OFF): si estamos muy cerca del umbral,
      // promueve la letra candidata para reducir la espera visible. Permitimos promoción
      // aunque shape_ok sea falso, siempre que la candidata no sea dinámica (evita conflicto con gestos dinámicos).
      if (!dynamicRef.current && !L && thr > 0 && isFinite(dist)) {
        const nearStatic = dist <= thr * 1.10; // un poco más permisivo para fluidez
        const DYN_LETTERS = new Set(['J','Ñ','Z']);
        if (nearStatic && cand && !DYN_LETTERS.has(cand)) {
          L = cand;
          conf = Math.max(conf, 0.88);
        }
      }

      if (L && conf >= LOCK_CONF_THRESHOLD) {
        // Regla de bloqueo estándar (persistencia) como en ejemplo2_frontend.html
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
      // guardar histórico para modo dinámico
      confHistRef.current.push(conf);
      shapeHistRef.current.push(shapeOK);
      if (confHistRef.current.length > DYN_WINDOW) confHistRef.current.shift();
      if (shapeHistRef.current.length > DYN_WINDOW) shapeHistRef.current.shift();
      let final = majority(smoothLettersRef.current);
      if (dynFlag) {
        // Cálculos de ventana
        const avgConf = confHistRef.current.length ? (confHistRef.current.reduce((a, b) => a + b, 0) / confHistRef.current.length) : 0;
        const shapeFrac = shapeHistRef.current.length ? (shapeHistRef.current.filter(Boolean).length / shapeHistRef.current.length) : 0;
        // Movimiento vertical del tip del índice
        let amplY = 0, energyY = 0, amplX = 0, energyX = 0;
        if (l8yHistRef.current.length >= Math.min(6, DYN_WINDOW)) {
          const ys = l8yHistRef.current.slice(-DYN_WINDOW);
          let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
          for (let i = 0; i < ys.length; i++) {
            const y = ys[i];
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (i > 0) energyY += Math.abs(ys[i] - ys[i - 1]);
          }
          amplY = maxY - minY;
        }
        if (l8xHistRef.current.length >= Math.min(6, DYN_WINDOW)) {
          const xs = l8xHistRef.current.slice(-DYN_WINDOW);
          let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
          for (let i = 0; i < xs.length; i++) {
            const x = xs[i];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (i > 0) energyX += Math.abs(xs[i] - xs[i - 1]);
          }
          amplX = maxX - minX;
        }
        // Requiere amplitud Y energía en al menos un eje (evita falsos positivos con mano abierta)
        const strongMoveY = (amplY >= J_MIN_Y_AMPL) && (energyY >= J_MIN_ENERGY_Y);
        const strongMoveX = (amplX >= J_MIN_X_AMPL) && (energyX >= J_MIN_ENERGY_X);
        const strongMove = strongMoveY || strongMoveX;
        setDynDebug(prev => `${prev}\nwin: avgC=${avgConf.toFixed(2)} shape%=${(shapeFrac*100).toFixed(0)} | dY=${amplY.toFixed(3)} Ey=${energyY.toFixed(3)} dX=${amplX.toFixed(3)} Ex=${energyX.toFixed(3)} move=${strongMove}`);

        // Dinámicos (J/Ñ/Z) SOLO con movimiento: no permitir visualización sin movimiento fuerte
        {
          const DYN_LETTERS = new Set(['J','Ñ','Z']);
          const dynInvolved = (cand && DYN_LETTERS.has(cand)) || (L && DYN_LETTERS.has(L)) || (final && DYN_LETTERS.has(final));
          if (dynInvolved && !strongMove) {
            if (final && DYN_LETTERS.has(final)) final = null;
            if (L && DYN_LETTERS.has(L)) L = null;
            conf = Math.min(conf, 0.15);
          }
        }

        // Regla 1: si hay suficiente evidencia de forma y confianza, usar mayoría/bloqueo (ligeramente más permisivo)
        if (avgConf >= DYN_MIN_AVG_CONF && shapeFrac >= Math.max(0.02, DYN_MIN_SHAPE_OK_FRAC * 0.8)) {
          if (!final) final = lockLetterRef.current;
        }

        // Regla 2: letra dinámica (J/Ñ, etc.) solo si el backend la apoya como candidata y la distancia está cerca del umbral
        const nearThr = (thr > 0) && ((isFinite(dist) && dist <= thr * 2.0) || (candDist != null && isFinite(candDist) && candDist <= thr * 2.0));
        const DYN_LETTERS = new Set(['J','Ñ','Z']);
        const backendHintsDyn = ((cand && DYN_LETTERS.has(cand)) || (L && DYN_LETTERS.has(L)) || (resp as any).accepted_dynamic === true);
        if (backendHintsDyn && nearThr && (shapeFrac >= 0.02)) {
          const dynCand = (cand && DYN_LETTERS.has(cand)) ? cand : ((L && DYN_LETTERS.has(L)) ? L : null);
          if (dynCand) final = dynCand as any;
          // Garantizar confianza visual alta cuando aceptamos J dinámica
          const targetConf = strongMove ? ((resp as any).accepted_dynamic ? 0.95 : 0.92) : 0.85;
          conf = Math.max(conf, targetConf);
          lastConfRef.current = Math.max(lastConfRef.current, targetConf);
          setConfidence(conf);
          setStatusMsg(`Movimiento detectado: ${final ?? ''} (ΔY=${amplY.toFixed(3)}, E_y=${energyY.toFixed(3)}, ΔX=${amplX.toFixed(3)}, E_x=${energyX.toFixed(3)})`);
          // Registrar dinámica reforzada
          lastDynLetterRef.current = final || null;
          lastDynAtRef.current = performance.now();
          // Solo con evidencia de movimiento activamos el piso dinámico al final
          if (final && DYN_LETTERS.has(final)) dynShouldFloor = strongMove;
        } else {
          // En dinámico, sin movimiento fuerte: anular dinámicos
          const DYN_LETTERS2 = new Set(['J','Ñ','Z']);
          if (strongMove === false && ((final && DYN_LETTERS2.has(final)) || (L && DYN_LETTERS2.has(L)) || (cand && DYN_LETTERS2.has(cand)))) {
            conf = Math.min(conf, 0.15);
            if (final && DYN_LETTERS2.has(final)) final = null;
            if (L && DYN_LETTERS2.has(L)) L = null;
            // liberar bloqueo si era dinámico
            if (lockLetterRef.current && DYN_LETTERS2.has(lockLetterRef.current)) {
              lockLetterRef.current = null; lockThrRef.current = 0; mismatchCountRef.current = 0;
            }
            lastDynLetterRef.current = null;
          }
        }
        // Si hace menos de 300 ms que hubo evidencia dinámica, mantener estable la última letra dinámica reforzada
        const nowTs = performance.now();
        const sinceDyn = nowTs - lastDynAtRef.current;
        if (sinceDyn >= 0 && sinceDyn <= 600 && lastDynLetterRef.current) {
          final = lastDynLetterRef.current;
          conf = Math.max(conf, strongMove ? 0.92 : 0.85);
          dynShouldFloor = true;
        }
        // Si no hay movimiento ni cercanía dinámica por >350ms, bajar confianza y soltar la última dinámica
        if ((sinceDyn > 350) && !(strongMove && backendHintsDyn && nearThr)) {
          const DYN_LETTERS = new Set(['J','Ñ','Z']);
          const isDynLocked = lockLetterRef.current && DYN_LETTERS.has(lockLetterRef.current);
          if (final && DYN_LETTERS.has(final)) final = null;
          if (isDynLocked) { lockLetterRef.current = null; lockThrRef.current = 0; }
          lastDynLetterRef.current = null;
          conf = Math.min(conf, 0.2);
        }
        // Bloqueo/Desbloqueo específico para dinámicos: solo bloquear si hay evidencia fuerte y desbloquear rápido cuando se pierde.
        if (final && conf >= LOCK_CONF_THRESHOLD) {
          if (new Set(['J','Ñ','Z']).has(final)) {
            if (strongMove && backendHintsDyn && nearThr) {
              lockLetterRef.current = final as string;
              lockThrRef.current = thr * 0.9;
              lockUpdatedAtRef.current = nowH;
              mismatchCountRef.current = 0;
            } else {
              // No bloquear dinámicos si ya no hay evidencia fuerte
            }
          } else {
            // bloqueo normal para otras letras
            lockLetterRef.current = final;
            lockThrRef.current = (thr * 0.9) || holdThrRef.current || lockThrRef.current;
            lockUpdatedAtRef.current = nowH;
            mismatchCountRef.current = 0;
          }
        }
        // Desbloqueo rápido cuando se pierde evidencia dinámica
        if (lockLetterRef.current && (new Set(['J','Ñ','Z']).has(lockLetterRef.current)) && !(strongMove && backendHintsDyn && nearThr)) {
          mismatchCountRef.current++;
          if (mismatchCountRef.current >= 1) { // soltar casi inmediato al perder movimiento/señal
            lockLetterRef.current = null; lockThrRef.current = 0; mismatchCountRef.current = 0;
          }
        }
      }
      lastConfRef.current = (lastConfRef.current * 0.7) + (conf * 0.3);
      // En dinámico, solo aplicamos piso de confianza si hubo evidencia de movimiento para la letra dinámica
      if (dynFlag && dynShouldFloor) {
        const floor = 0.9;
        lastConfRef.current = Math.max(lastConfRef.current, Math.max(conf, floor));
      }

      // Update UI: store last distance/threshold and confidence like the HTML demo
      setPrediction({ letter: final ?? null, distance: dist, threshold: thr });
      if (dynFlag && dynShouldFloor) {
        // Asegura que la barra refleje aceptación/promoción dinámica
        const floor = 0.9;
        setConfidence(Math.max(lastConfRef.current, floor));
      } else {
        setConfidence(lastConfRef.current);
      }
      // Narrar la letra detectada cuando hay confianza suficiente y cambio de letra
      try {
        const letterToSpeak = final;
        const confNow = lastConfRef.current;
        const now = performance.now();
        const COOLDOWN_MS = 900;
        if (speakEnabledRef.current && letterToSpeak && confNow >= 0.8) {
          const changed = (lastSpokenRef.current !== letterToSpeak);
          const cooled = (now - lastSpokenAtRef.current) >= COOLDOWN_MS;
          if (changed || cooled) {
            const utter = new SpeechSynthesisUtterance(letterToSpeak);
            const k = voiceKeyRef.current;
            const vs = voicesRef.current || [];
            if (k) {
              const v = vs.find((vv) => `${vv.name}::${vv.lang}` === k);
              if (v) { utter.voice = v; utter.lang = v.lang || 'es-ES'; } else { utter.lang = 'es-ES'; }
            } else { utter.lang = 'es-ES'; }
            utter.rate = 0.95;
            utter.pitch = 1.0;
            utter.volume = Math.max(0, Math.min(1, speakVolumeRef.current));
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utter);
            lastSpokenRef.current = letterToSpeak;
            lastSpokenAtRef.current = now;
          }
        }
      } catch {}
      const out = lastConfRef.current;
      predictInFlightRef.current = false;
      return out;
    } else {
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
    }
    predictInFlightRef.current = false;
  }, [dynamicMode]);

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

  const resetOneLetter = useCallback(async () => {
    const L = delLetter;
    if (!L) return;
    if (L === 'ALL') {
      if (!confirm('Esto eliminará TODAS las letras (A–Z/Ñ) y los modelos entrenados. ¿Continuar?')) return;
      try {
        const resp = await api.reset();
        if ((resp as any).status === 'ok') {
          // Reiniciar contadores de sesión para todas las letras
          setSessionCounts((prev) => {
            const copy = { ...prev } as Record<string, number>;
            for (const k of letters) copy[k] = 0;
            return copy;
          });
          await refreshProgress(false, false);
          await refreshModel(false);
          setPrediction({ letter: null, distance: null, threshold: null });
          setStatusMsg('Todas las letras eliminadas. Reentrena el modelo.');
          speakText('Todas las letras eliminadas');
        } else {
          setStatusMsg('No se pudo eliminar A–Z');
        }
      } catch {
        setStatusMsg('Error eliminando A–Z');
      }
      return;
    }
    if (!confirm(`Esto eliminará todas las muestras de la letra ${L} y borrará los modelos entrenados. ¿Continuar?`)) return;
    try {
      const resp = await api.resetLetter(L);
      if ((resp as any).status === 'ok') {
        // Si la letra eliminada es la actualmente seleccionada para sesión, limpiar su contador de sesión
        setSessionCounts((prev) => ({ ...prev, [L]: 0 }));
        await refreshProgress(false, false);
        await refreshModel(false);
        setStatusMsg(`Letra ${L} eliminada. Reentrena el modelo para continuar.`);
        speakText(`Letra ${L} eliminada`);
      } else {
        setStatusMsg(`No se pudo eliminar la letra ${L}`);
      }
    } catch {
      setStatusMsg(`Error eliminando la letra ${L}`);
    }
  }, [delLetter, refreshModel, refreshProgress, speakText]);

  // Ocultar scroll mientras esta vista está activa
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div style={{ overflow: 'hidden' }}>
      <div className="v2-stage" style={{ marginTop: 0 }}>
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
            <div
              className={[
                theme === 'neo' ? 'neo-frame' : '',
                theme === 'neo' && hasHands ? 'neo-detect' : '',
                theme === 'neo' && errorShake ? 'neo-error' : '',
              ].filter(Boolean).join(' ')}
            >
              <HandCapture onLandmarks={onLandmarks} cameraOn={cameraOn} mirror={mirror} />
            </div>
          </div>
        {/* Controls under video */}
        <div className="v2-controls" style={{ display: 'grid', gap: 10 }}>
          <div className="letter-selector">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Letra:
              <SelectMenu value={letter} onChange={(v) => setLetter(v)} options={letters.map((L) => ({ label: L, value: L }))} width={90} />
            </label>
          </div>

          <div className="camera-controls" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {!cameraOn ? (
              <Button onClick={() => { setCameraOn(true); setStatusMsg('Cámara iniciada'); speakText('Iniciando cámara'); }}>Iniciar cámara</Button>
            ) : (
              <Button variant="danger" onClick={() => { setIsCapturing(false); setCameraOn(false); setStatusMsg('Cámara detenida'); speakText('Deteniendo cámara'); }}>Detener cámara</Button>
            )}
            <Button variant="ghost" onClick={() => refreshProgress(true, true)}>Refrescar progreso</Button>
          </div>

          <div className="batch-controls" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <Button onClick={toggleCapture}>{isCapturing ? 'Detener' : 'Entrenar (capturar muestras)'}</Button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.currentTarget.checked)} /> Espejar overlay
            </label>
          </div>

          <div className="model-controls" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <Button onClick={train}>Entrenar Modelo</Button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <input
                type="checkbox"
                checked={dynamicMode}
                onChange={(e) => {
                  const on = e.currentTarget.checked;
                  setDynamicMode(on);
                  speakText(on ? 'Activando Modo dinámico' : 'Desactivando modo dinámico');
                }}
              /> Modo dinámico
            </label>
          </div>

          <div className="delete-letter-controls" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Eliminar:
              <SelectMenu
                value={delLetter}
                onChange={(v) => setDelLetter(v)}
                options={[{ label: 'Todas (A–Z)', value: 'ALL' }, ...letters.map((L) => ({ label: L, value: L }))]}
                width={140}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="danger" onClick={resetOneLetter}>
                {delLetter === 'ALL' ? 'Eliminar A–Z y modelos' : 'Eliminar letra y modelos'}
              </Button>
            </div>
          </div>

          <div className="voice-controls" style={{ display: 'grid', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={speakEnabled} onChange={(e) => setSpeakEnabled(e.currentTarget.checked)} /> Voz (leer letra)
            </label>
            {speakEnabled && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Voz:
                  <SelectMenu
                    value={voiceKey}
                    onChange={(v) => setVoiceKey(v)}
                    options={voices.map((vv) => ({ label: `${vv.name} (${vv.lang})`, value: `${vv.name}::${vv.lang}` }))}
                    width={260}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Volumen:
                  <input type="range" min={0} max={1} step={0.1} value={speakVolume}
                    onChange={(e) => setSpeakVolume(Number(e.currentTarget.value))}
                    style={{ width: 140 }}
                  />
                  <span style={{ width: 28, textAlign: 'right' }}>{Math.round(speakVolume * 100)}%</span>
                </label>
              </>
            )}
          </div>
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

      <Card className="v2-right prediction-display">
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
                {dynamicMode && (
                  <div className="mono muted" style={{ fontSize: 11, marginTop: 6, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
                    {dynDebug || '—'}
                  </div>
                )}
              </>
            );
          })()}
        </div>
        <Stack gap={8}>
          <Button variant="ghost" onClick={() => refreshModel(true)} disabled={modelLoading}
            style={{ position: 'relative', overflow: 'hidden' }}>
            {modelLoading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="spin" style={{ width: 14, height: 14, border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'v2spin 0.8s linear infinite' }} />
                Cargando...
              </span>
            ) : 'Cargar modelo'}
          </Button>
          <Button variant="danger" onClick={resetAll}>Limpiar BD</Button>
        </Stack>
        {modelInfo && (
          <div className="mono muted" style={{ fontSize: 12, marginTop: 6 }}>
            Modelo #{modelInfo.id} · Letras: {Array.isArray(modelInfo.letters) ? modelInfo.letters.join(', ') : '–'} · {modelInfo.when ? new Date(modelInfo.when).toLocaleString() : ''}
          </div>
        )}
      </Card>
      </div>
    </div>
  );
};

export default Vista2;  