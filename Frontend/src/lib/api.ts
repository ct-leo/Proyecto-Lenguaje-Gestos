export const API_BASE = import.meta.env.VITE_API_BASE ?? '/vista02/api'

export type Landmark = { x: number; y: number; z: number }

export type PredictResponse = {
  status: 'ok' | 'error'
  letter: string | null
  distance?: number
  threshold?: number
  shape_ok?: boolean
  candidate?: string
  candidate_distance?: number
  accepted_dynamic?: boolean
}

async function getModel() {
  const r = await fetch(`${API_BASE}/model`)
  return r.json()
}

async function progress() {
  const r = await fetch(`${API_BASE}/progress`)
  return r.json()
}

async function lastDetected() {
  const r = await fetch(`${API_BASE}/last-detected`)
  return r.json()
}

async function samplesBatch(letter: string, samples: any[]) {
  const r = await fetch(`${API_BASE}/samples/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ letter, samples }),
  })
  return r.json()
}

async function train() {
  const r = await fetch(`${API_BASE}/train`, { method: 'POST' })
  return r.json()
}

async function predict(
  landmarksOrPayload: Landmark[] | any,
  opts?: { dynamic?: boolean },
  signal?: AbortSignal,
) {
  const body = Array.isArray(landmarksOrPayload) && landmarksOrPayload.length === 21
    ? (() => {
        const fv = extractFeatureVector(landmarksOrPayload as Landmark[])
        if (!fv) return null
        const payload: any = { landmarks: landmarksOrPayload, feature: fv }
        if (opts?.dynamic) payload.dynamic = true
        return payload
      })()
    : (() => {
        const payload: any = landmarksOrPayload
        if (opts?.dynamic) payload.dynamic = true
        return payload
      })()
  if (!body) return { status: 'error' } as PredictResponse
  const r = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  return (await r.json()) as PredictResponse
}

async function reset() {
  const r = await fetch(`${API_BASE}/reset`, { method: 'POST' })
  return r.json()
}

export const api = { getModel, progress, lastDetected, samplesBatch, train, predict, reset }
export default api

// ===== Feature extraction (same as ejemplo2_frontend.html) =====
function dist(a: number[], b: number[]) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2]
  return Math.sqrt(dx*dx + dy*dy + dz*dz)
}
export function extractFeatureVector(landmarks: Landmark[] | null) {
  if (!Array.isArray(landmarks) || landmarks.length !== 21) return null
  const pts = landmarks.map(p => [p.x, p.y, p.z])
  const wrist = pts[0]
  const rel = pts.map(p => [p[0]-wrist[0], p[1]-wrist[1], p[2]-wrist[2]])

  const middle_mcp = rel[9]
  const base = dist([0,0,0], middle_mcp)
  const mcps = [rel[5], rel[9], rel[13], rel[17]]
  const spread = (dist(mcps[0], mcps[1]) + dist(mcps[1], mcps[2]) + dist(mcps[2], mcps[3])) / 3
  const scale = Math.max(1e-6, base + spread)
  const n = rel.map(p => [p[0]/scale, p[1]/scale, p[2]/scale])

  const fingers: Record<string, number[]> = {
    thumb: [2,3,4],
    index: [5,6,8],
    middle: [9,10,12],
    ring: [13,14,16],
    pinky: [17,18,20],
  }
  const feat: number[] = []
  for (const key of Object.keys(fingers)) {
    const [mcp, pip, tip] = fingers[key]
    feat.push(dist(n[tip], n[pip]))
    feat.push(dist(n[pip], n[mcp]))
  }
  const tips = [8,12,16,20]
  for (let i=0;i<tips.length-1;i++) feat.push(dist(n[tips[i]], n[tips[i+1]]))

  const zs = n.map(p => p[2])
  const meanZ = zs.reduce((a,b)=>a+b,0)/zs.length
  const varZ = zs.reduce((a,z)=>a+(z-meanZ)*(z-meanZ),0)/zs.length
  feat.push(varZ)
  return feat
}
