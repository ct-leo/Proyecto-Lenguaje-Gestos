import { useEffect, useRef, useState } from 'react'
import type { Landmark } from '../lib/api'

type Props = {
  onLandmarks?: (hands: Landmark[][]) => void
  cameraOn?: boolean
  mirror?: boolean
}

export default function HandCapture({ onLandmarks, cameraOn = true, mirror = true }: Props) {
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
          const isRight = label === 'right';
          // Colores por mano: derecha azul, izquierda roja
          const connColor = isRight ? '#2563eb' : '#dc2626';
          const ptColor = isRight ? '#3b82f6' : '#ef4444';
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
          const mapped: Landmark[][] = all.map((l: any) => l.map((p: any) => ({ x: p.x, y: p.y, z: p.z })))
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
