export interface Landmark { x: number; y: number; z: number }

const BACKEND: string = (import.meta.env.VITE_BACKEND_BASE as string) || 'http://127.0.0.1:8000/vista02';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`);
  if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`POST ${path} ${res.status}`);
  return res.json();
}

export const api = {
  progress: () => get<{ status: string; totals: Record<string, number>; total: number }>(`/api/progress`),
  getModel: () => get<unknown>(`/api/model`),
  lastDetected: () => get<{ status: string; letter: string | null }>(`/api/last-detected`),
  samplesBatch: (letter: string, samples: { landmarks: Landmark[]; feature?: number[] }[]) =>
    post<{ status: string; inserted?: number; message?: string; totals?: Record<string, number> }>(`/api/samples/batch`, { letter, samples }),
  train: () => post<{ status: string; model_id?: number; message?: string }>(`/api/train`, {}),
  predict: (landmarks: Landmark[], feature?: number[]) =>
    post<{ status: string; letter?: string | null; distance?: number | null; threshold?: number | null; message?: string }>(`/api/predict`, { landmarks, feature }),
  reset: () => post<{ status: string; message?: string }>(`/api/reset`, {}),
  baseUrl: BACKEND,
};
