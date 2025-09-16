import { useEffect, useRef, useState } from 'react'
import type { Landmark } from '../lib/api'

// ---- Math helpers for hand-local normalization ----
type V3 = { x: number; y: number; z: number }
const vsub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const vdot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z
const vlen = (a: V3): number => Math.hypot(a.x, a.y, a.z)
const vnorm = (a: V3): V3 => {
  const L = vlen(a) || 1e-6
  return { x: a.x / L, y: a.y / L, z: a.z / L }
}
const vcross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

// Build a hand-local orthonormal basis using wrist (0), index MCP (5), pinky MCP (17)
function buildHandBasis(lms: V3[]) {
  const wrist = lms[0];
  const indexMcp = lms[5];
  const pinkyMcp = lms[17];
  const v1 = vsub(indexMcp, wrist); // roughly +X
  const v2 = vsub(pinkyMcp, wrist); // roughly -X for left hand
  let xAxis = vnorm(v1)
  const palmNormal = vnorm(vcross(v1, v2)) // roughly +Z pointing out of palm
  let yAxis = vnorm(vcross(palmNormal, xAxis)) // complete right-handed basis
  // Re-orthogonalize X against Y just in case
  xAxis = vnorm(vcross(yAxis, palmNormal))
  const zAxis = palmNormal
  return { origin: wrist, xAxis, yAxis, zAxis }
}

// Transform world landmark to hand-local coordinates, then scale by a reference length
function worldToHandLocal(lms: V3[], handedLabel: string) {
  const { origin, xAxis, yAxis, zAxis } = buildHandBasis(lms)
  // Reference scale: distance wrist->middle MCP
  const ref = vlen(vsub(lms[9], origin)) || 1e-3
  const invRef = 1 / ref
  const res = lms.map(p => {
    const r = vsub(p, origin)
    // rows of R^T are basis vectors -> coordinates are dots
    let hx = vdot(r, xAxis)
    let hy = vdot(r, yAxis)
    let hz = vdot(r, zAxis)
    // Mirror X for left hand to align both hands to the same canonical frame
    if (handedLabel === 'left') hx = -hx
    return { x: hx * invRef, y: hy * invRef, z: hz * invRef }
  })
  return res
}

// Exponential moving average smoothing per hand and per landmark
function smoothLandmarks(prev: V3[] | null, curr: V3[], alpha = 0.4): V3[] {
  if (!prev || prev.length !== curr.length) return curr
  const beta = 1 - alpha
  return curr.map((c, i) => ({
    x: alpha * c.x + beta * prev[i].x,
    y: alpha * c.y + beta * prev[i].y,
    z: alpha * c.z + beta * prev[i].z,
  }))
}

type Props = {
  onLandmarks?: (hands: Landmark[][]) => void
  cameraOn?: boolean
  mirror?: boolean
  // If true, the callback receives stabilized, hand-local landmarks (orientation/escala invariantes)
  stabilizeForRecognition?: boolean
}

export default function HandCapture({ onLandmarks, cameraOn = true, mirror = true, stabilizeForRecognition = true }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const handsRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  // Track the latest live instance so old frames don't call into disposed Hands
  const genRef = useRef<number>(0)
  // Keep a stable ref to onLandmarks so changing parent callback doesn't restart camera
  const onLandmarksRef = useRef<Props['onLandmarks'] | undefined>(undefined)
  onLandmarksRef.current = onLandmarks

  // Keep smoothed landmarks per hand index (0/1). We cannot rely on persistent IDs, so we map by index per frame.
  const smoothRef = useRef<{ [k: string]: V3[] | null }>({})

  const [mpReady, setMpReady] = useState(false)
  // Ensure CDN scripts are present (drawing_utils, camera_utils, hands)
  useEffect(() => {
    const urls = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
    ]
    let mounted = true
    const load = async () => {
      for (const src of urls) {
        if (![...document.scripts].some(s => s.src === src)) {
          await new Promise<void>((resolve, reject) => {
            const el = document.createElement('script')
            el.src = src
            el.crossOrigin = 'anonymous'
            el.onload = () => resolve()
            el.onerror = () => reject(new Error('Failed to load ' + src))
            document.head.appendChild(el)
          })
        }
      }
      if (!mounted) return
      setMpReady(true)
    }
    load().catch(() => {})
    return () => { mounted = false }
  }, [])

  // Init canvas ctx
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    ctxRef.current = c.getContext('2d')
  }, [])

  // Start/Stop camera
  useEffect(() => {
    let stopped = false
    const start = async () => {
      // Bump generation to invalidate any previous onFrame callbacks
      const myGen = ++genRef.current
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      // Create hands
      const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/'
      const Hands: any = (window as any).Hands
      if (!Hands) return
      const hands = new Hands({ locateFile: (file: string) => base + file })
      hands.setOptions({
        selfieMode: true,
        maxNumHands: 2,            // permitir ambas manos
        modelComplexity: 0,        // modo rápido
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3,
      })
      hands.onResults((res: any) => {
        if (stopped || myGen !== genRef.current) return
        const ctx = ctxRef.current
        if (!ctx || stopped) return
        const w = canvas.width, h = canvas.height
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, w, h)
        if (mirror) {
          ctx.setTransform(-1, 0, 0, 1, w, 0)
        }
        const all = (res && res.multiHandLandmarks) ? res.multiHandLandmarks : []
        const CONN = [
          [0,1],[1,2],[2,3],[3,4],
          [0,5],[5,6],[6,7],[7,8],
          [0,9],[9,10],[10,11],[11,12],
          [0,13],[13,14],[14,15],[15,16],
          [0,17],[17,18],[18,19],[19,20]
        ]
        // handedness info para colorear por mano (Right azul, Left rojo)
        const handed = (res && (res.multiHandedness || res.multiHandednesses)) ? (res.multiHandedness || res.multiHandednesses) : []
        // Dibuja puntos intermedios a lo largo de cada conexión para mayor detalle visual
        // Micro puntos removidos para mejorar rendimiento
        // Precompute adjacency for adaptive radius
        const adj: Record<number, number[]> = (() => {
          const m: Record<number, number[]> = {}; for (const [a,b] of CONN as any) { (m[a]=m[a]||[]).push(b); (m[b]=m[b]||[]).push(a);} return m;
        })();
        for (let idx = 0; idx < all.length; idx++) {
          const lms = all[idx]
          const label = String(handed?.[idx]?.label || '').toLowerCase();
          const isRightLabel = label === 'right';
          // Cuando espejamos el canvas, la derecha/izquierda en pantalla se invierte respecto a la etiqueta del modelo
          const isRightVisual = mirror ? !isRightLabel : isRightLabel;
          // Colores por mano en pantalla: derecha (visual) azul, izquierda (visual) roja
          const connColor = isRightVisual ? '#2563eb' : '#dc2626';
          const ptColor = isRightVisual ? '#3b82f6' : '#ef4444';
          // Depth-aware order: draw farther first, nearer last
          const connSorted = (CONN as any).slice().sort((c1: any, c2: any) => {
            const z1 = ((lms[c1[0]].z ?? 0) + (lms[c1[1]].z ?? 0)) / 2;
            const z2 = ((lms[c2[0]].z ?? 0) + (lms[c2[1]].z ?? 0)) / 2;
            return z2 - z1; // mayor z primero (más lejos), menor z al final (más cerca)
          });
          // Draw connectors manually to control order
          ctx.strokeStyle = connColor;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (const [a,b] of connSorted) {
            const ax = lms[a].x * w, ay = lms[a].y * h
            const bx = lms[b].x * w, by = lms[b].y * h
            ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
          }
          ctx.stroke();
          // Points: sort by z so nearer points draw last
          const order = lms.map((p: any, i: number) => ({ i, z: p.z ?? 0 })).sort((A: any, B: any) => B.z - A.z);
          ctx.fillStyle = ptColor;
          for (const { i } of order) {
            const p = lms[i]; const px = p.x * w, py = p.y * h;
            // Adaptive radius: shrink when very close to neighbors
            let r = 1.8;
            const ns = adj[i] || [];
            let minD = Infinity;
            for (const j of ns) {
              const q = lms[j]; const qx = q.x * w, qy = q.y * h;
              const dx = px - qx, dy = py - qy; const d = Math.hypot(dx, dy);
              if (d < minD) minD = d;
            }
            if (isFinite(minD)) {
              if (minD < 8) r = 1.0; else if (minD < 12) r = 1.4;
            }
            ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
          }
        }
        if (onLandmarksRef.current) {
          let mapped: Landmark[][]
          if (stabilizeForRecognition) {
            // Produce normalized & smoothed landmarks in a hand-local frame
            mapped = all.map((l: any, i: number) => {
              const raw: V3[] = l.map((p: any) => ({ x: p.x, y: p.y, z: p.z }))
              const lbl = String(handed?.[i]?.label || '').toLowerCase()
              const local = worldToHandLocal(raw, lbl)
              const key = `hand_${i}`
              const smoothed = smoothLandmarks(smoothRef.current[key] || null, local, 0.45)
              smoothRef.current[key] = smoothed
              return smoothed
            }) as unknown as Landmark[][]
          } else {
            mapped = all.map((l: any) => l.map((p: any) => ({ x: p.x, y: p.y, z: p.z })))
          }
          try { onLandmarksRef.current(mapped) } catch {}
        }
      })

      handsRef.current = hands

      // Request camera stream (handle HTTPS/permission/autoplay issues)
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 360, facingMode: 'user', frameRate: { ideal: 24, max: 24 } },
          audio: false,
        })
      } catch (err) {
        console.error('getUserMedia failed:', err)
        return // abort start; without camera we cannot proceed
      }
      if (!stream) return
      video.srcObject = stream
      try {
        await video.play()
      } catch (err) {
        console.warn('video.play() failed (autoplay?)', err)
        // If autoplay is blocked, wait for a user gesture (click) to play
        const onInteract = async () => {
          try { await video.play() } catch {}
          window.removeEventListener('pointerdown', onInteract)
        }
        window.addEventListener('pointerdown', onInteract, { once: true })
      }
      // sync canvas size
      const sync = () => {
        const w = video.videoWidth || 480
        const h = video.videoHeight || 360
        canvas.width = w; canvas.height = h
        // Ensure both video and canvas are exactly the same CSS size
        const wp = w + 'px', hp = h + 'px'
        canvas.style.width = wp
        canvas.style.height = hp
        ;(video as HTMLVideoElement).style.width = wp
        ;(video as HTMLVideoElement).style.height = hp
      }
      if (video.readyState >= 1) sync(); else video.addEventListener('loadedmetadata', sync, { once: true })

      // Wait until video has non-zero dimensions to avoid MediaPipe ROI assertion
      const waitForDims = async () => {
        let tries = 0
        while (!stopped && tries < 50) { // ~5s max
          const vw = video.videoWidth
          const vh = video.videoHeight
          if (vw > 0 && vh > 0) return true
          await new Promise(r => setTimeout(r, 100))
          tries++
        }
        return false
      }
      const okDims = await waitForDims()
      if (!okDims) {
        console.warn('Video dimensions remained 0; aborting camera start')
        return
      }

      const Camera = (window as any).Camera
      cameraRef.current = new Camera(video, {
        onFrame: async () => {
          if (stopped || myGen !== genRef.current) return
          // Safety guard: skip when video has zero size (can happen briefly on page/tab visibility changes)
          const vw = (video as HTMLVideoElement).videoWidth
          const vh = (video as HTMLVideoElement).videoHeight
          if (!vw || !vh) return
          try {
            // Ensure we're still the active hands instance
            if (handsRef.current !== hands) return
            await hands.send({ image: video })
          } catch (err: any) {
            const msg = String(err && (err.message || err))
            // Ignore Emscripten binding error that happens if an old instance receives a late frame
            if (msg.includes('deleted object') || msg.includes('SolutionWasm')) return
            // Surface other errors to the console for visibility
            console.warn('hands.send error:', err)
          }
        },
        width: 480,
        height: 360,
      })
      cameraRef.current.start()
    }

    const stop = async () => {
      stopped = true
      // Invalidate any in-flight onFrame callbacks from previous instance
      genRef.current++
      try { cameraRef.current && cameraRef.current.stop && await cameraRef.current.stop() } catch {}
      cameraRef.current = null
      try { handsRef.current && handsRef.current.close && await handsRef.current.close() } catch {}
      handsRef.current = null
      const video = videoRef.current as HTMLVideoElement | null
      if (video && video.srcObject) {
        for (const t of (video.srcObject as MediaStream).getTracks()) t.stop()
        video.srcObject = null
      }
      const ctx = ctxRef.current, c = canvasRef.current
      if (ctx && c) { ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,c.width,c.height) }
    }

    if (cameraOn && mpReady) start(); else stop()
    return () => { stop() }
  }, [cameraOn, mirror, mpReady])

  return (
    <div className="video-wrap">
      <video ref={videoRef} playsInline muted autoPlay />
      <canvas ref={canvasRef} width={640} height={480} />
    </div>
  )
}
