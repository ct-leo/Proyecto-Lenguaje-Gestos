import React, { useEffect, useRef, useState } from 'react'
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
        maxNumHands: 1,            // reducir carga
        modelComplexity: 0,        // modo rápido
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3,
      })
      hands.onResults((res: any) => {
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
        const drawConnectors = (window as any).drawConnectors
        const drawLandmarks = (window as any).drawLandmarks
        // Dibuja puntos intermedios a lo largo de cada conexión para mayor detalle visual
        // Micro puntos removidos para mejorar rendimiento
        for (const lms of all) {
          if (drawConnectors && drawLandmarks) {
            drawConnectors(ctx, lms, CONN, { color: '#22d3ee', lineWidth: 1.5 })
            drawLandmarks(ctx, lms, { color: '#f97316', lineWidth: 1, radius: 1.8 })
          } else {
            // basic draw
            ctx.strokeStyle = '#22d3ee'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            for (const [a,b] of CONN as any) {
              const ax = lms[a].x * w, ay = lms[a].y * h
              const bx = lms[b].x * w, by = lms[b].y * h
              ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
            }
            ctx.stroke()
            ctx.fillStyle = '#f97316'
            for (const p of lms) { ctx.beginPath(); ctx.arc(p.x*w, p.y*h, 1.8, 0, Math.PI*2); ctx.fill() }
          }
        }
        if (onLandmarks) {
          const mapped: Landmark[][] = all.map((l: any) => l.map((p: any) => ({ x: p.x, y: p.y, z: p.z })))
          onLandmarks(mapped)
        }
      })

      handsRef.current = hands

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360, facingMode: 'user', frameRate: { ideal: 30, max: 30 } }, audio: false })
      video.srcObject = stream
      await video.play()
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

      const Camera = (window as any).Camera
      cameraRef.current = new Camera(video, {
        onFrame: async () => { await hands.send({ image: video }) },
        width: 480,
        height: 360,
      })
      cameraRef.current.start()
    }

    const stop = async () => {
      stopped = true
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
  }, [cameraOn, mirror, onLandmarks, mpReady])

  return (
    <div className="video-wrap">
      <video ref={videoRef} playsInline muted autoPlay />
      <canvas ref={canvasRef} width={640} height={480} />
    </div>
  )
}
