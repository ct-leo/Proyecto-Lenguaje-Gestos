import React, { useCallback, useEffect, useState } from 'react';
import Particles from 'react-tsparticles';
import type { Container, Engine } from 'tsparticles-engine';
import { loadSlim } from 'tsparticles-slim';
import { motion } from 'framer-motion';

const NeoAmbient: React.FC = () => {
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const particlesLoaded = useCallback(async (_container: Container | undefined) => {
    // no-op
  }, []);

  // presentation mode (tab hidden => slower & dimmer)
  const [active, setActive] = useState<boolean>(true);
  useEffect(() => {
    const handler = () => setActive(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
  const speed = active ? 1 : 0.35;
  const dim = active ? 1 : 0.6;

  // parallax
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      setMouse({ x: e.clientX / w, y: e.clientY / h });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);
  const parallax = useCallback((fx: number, fy?: number) => {
    const px = (mouse.x - 0.5) * (fx);
    const py = (mouse.y - 0.5) * (fy ?? fx);
    return { transform: `translate3d(${px}px, ${py}px, 0)` } as React.CSSProperties;
  }, [mouse]);

  // delayed mount (no loading overlay; spawn after 1s)
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 1000); return () => clearTimeout(t); }, []);

  // drag to move planets
  type PlanetKey = 'jup' | 'sat' | 'mar' | 'nep' | 'ura' | 'ven' | 'mer';
  const STORAGE = 'neo_planet_pos_v1';
  const defaults: Record<PlanetKey, {x:number;y:number}> = {
    jup:{x:0,y:0}, sat:{x:0,y:0}, mar:{x:0,y:0}, nep:{x:0,y:0}, ura:{x:0,y:0}, ven:{x:0,y:0}, mer:{x:0,y:0}
  };
  const [edit, setEdit] = useState(false);
  const [pos, setPos] = useState<Record<PlanetKey, {x:number; y:number}>>(() => {
    try {
      const s = localStorage.getItem(STORAGE);
      if (s) {
        const parsed = JSON.parse(s);
        return { ...defaults, ...(parsed || {}) };
      }
    } catch {}
    return { ...defaults };
  });
  const savePos = (next: typeof pos) => { setPos(next); try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch {} };

  const combine = (base: React.CSSProperties, dx: number, dy: number): React.CSSProperties => {
    const b = (base.transform as string) || '';
    return { ...base, transform: `${b} translate3d(${dx}px, ${dy}px, 0)` };
  };

  return (
    <div aria-hidden className="neo-ambient" style={{ position: 'fixed', inset: 0, pointerEvents: edit ? 'auto' : 'none', zIndex: 0, overflow: 'hidden', opacity: dim }}>
      {/* Toggle mover planetas */}
      <button onClick={() => setEdit(v=>!v)}
        style={{ position:'absolute', top: 10, left: 10, zIndex: 5, pointerEvents: 'auto', padding:'6px 10px', borderRadius: 10, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)'}}>
        {edit ? 'Bloquear planetas' : 'Mover planetas'}
      </button>
      {show && (
      <Particles className="neo-ambient-particles" id="neo-ambient-bg" init={particlesInit} loaded={particlesLoaded}
        options={{
          background: { color: { value: 'transparent' } },
          fullScreen: { enable: false },
          fpsLimit: active ? 60 : 30,
          particles: {
            number: { value: 50, density: { enable: true, area: 1000 } },
            color: { value: ['#00f5ff', '#8b5cf6'] },
            opacity: { value: { min: 0.08, max: 0.25 } },
            size: { value: { min: 1, max: 3 } },
            move: { enable: true, speed: active ? 0.5 : 0.25, outModes: { default: 'out' } },
            links: { enable: true, color: '#6ee7f9', opacity: 0.12, distance: 140 }
          },
          interactivity: { events: { onHover: { enable: true, mode: 'repulse' } }, modes: { repulse: { distance: 90 } } }
        }}
      />)}
      {/* Jupiter (banded gas giant) - bottom left */}
      {show && (<motion.div aria-hidden initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: -360, opacity: 0.8 }} transition={{ repeat: Infinity, ease: 'linear', duration: 220 / speed }}
        drag={edit} dragMomentum={false}
        onDragEnd={(_, info) => savePos({ ...pos, jup:{ x: (pos.jup?.x ?? 0) + info.offset.x, y: (pos.jup?.y ?? 0) + info.offset.y } })}
        style={combine({ position: 'absolute', left: '-10%', bottom: '-18%', width: '520px', height: '520px', filter: 'drop-shadow(0 0 40px rgba(255,255,255,.08))', ...(parallax(-10,-6)), cursor: edit ? 'grab' : 'default', pointerEvents: edit ? 'auto' : 'none' }, (pos.jup?.x ?? 0), (pos.jup?.y ?? 0))}>
        <svg width="100%" height="100%" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="jupCore" cx="50%" cy="50%" r="62%">
              <stop offset="0%" stop-color="#cfa27d"/>
              <stop offset="60%" stop-color="#a9795f"/>
              <stop offset="100%" stop-color="#6f5347"/>
            </radialGradient>
            <linearGradient id="jupBand" x1="0%" x2="100%">
              <stop offset="0%" stop-color="#e7c6a8"/>
              <stop offset="50%" stop-color="#b4896e"/>
              <stop offset="100%" stop-color="#8a6b5a"/>
            </linearGradient>
          </defs>
          <circle cx="300" cy="300" r="290" fill="url(#jupCore)"/>
          {Array.from({length:8}).map((_,i)=>{
            const ry = 16 + i*14; const opacity = 0.4 + (i%2)*0.25; const cy = 180 + i*35; return (
              <ellipse key={i} cx="300" cy={cy} rx="290" ry={ry} fill="url(#jupBand)" opacity={opacity}/>
            );
          })}
          {/* Great Red Spot hint */}
          <ellipse cx="410" cy="340" rx="46" ry="28" fill="#c96a4b" opacity="0.55"/>
        </svg>
      </motion.div>)}
      {/* Uranus - cyan with slight tilt - left mid */}
      {show && (<motion.div aria-hidden initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: 360, opacity: 0.8 }} transition={{ repeat: Infinity, ease: 'linear', duration: 230 / speed }}
        drag={edit} dragMomentum={false}
        onDragEnd={(_, info) => savePos({ ...pos, ura:{ x: (pos.ura?.x ?? 0) + info.offset.x, y: (pos.ura?.y ?? 0) + info.offset.y } })}
        style={combine({ position: 'absolute', left: '6%', top: '38%', width: '200px', height: '200px', filter: 'drop-shadow(0 0 28px rgba(0,245,255,.18))', ...(parallax(-6,8)), cursor: edit ? 'grab' : 'default', pointerEvents: edit ? 'auto' : 'none' }, (pos.ura?.x ?? 0), (pos.ura?.y ?? 0))}>
        <svg width="100%" height="100%" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="uraBody" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stop-color="#b0f7ff"/>
              <stop offset="60%" stop-color="#67d8e6"/>
              <stop offset="100%" stop-color="#217f8f"/>
            </radialGradient>
          </defs>
          <circle cx="110" cy="110" r="100" fill="url(#uraBody)"/>
        </svg>
      </motion.div>)}

      {/* Venus - creamy/yellowish - top center */}
      {show && (<motion.div aria-hidden initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: -360, opacity: 0.85 }} transition={{ repeat: Infinity, ease: 'linear', duration: 210 / speed }}
        drag={edit} dragMomentum={false}
        onDragEnd={(_, info) => savePos({ ...pos, ven:{ x: (pos.ven?.x ?? 0) + info.offset.x, y: (pos.ven?.y ?? 0) + info.offset.y } })}
        style={combine({ position: 'absolute', left: '45%', top: '-10%', width: '180px', height: '180px', filter: 'drop-shadow(0 0 24px rgba(255,255,200,.15))', ...(parallax(4,6)), cursor: edit ? 'grab' : 'default', pointerEvents: edit ? 'auto' : 'none' }, (pos.ven?.x ?? 0), (pos.ven?.y ?? 0))}>
        <svg width="100%" height="100%" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="venBody" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stop-color="#fff0c2"/>
              <stop offset="60%" stop-color="#e3c88e"/>
              <stop offset="100%" stop-color="#b39462"/>
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="92" fill="url(#venBody)"/>
        </svg>
      </motion.div>)}

      {/* Mercury - small gray - bottom center */}
      {show && (<motion.div aria-hidden initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: 360, opacity: 0.8 }} transition={{ repeat: Infinity, ease: 'linear', duration: 190 / speed }}
        drag={edit} dragMomentum={false}
        onDragEnd={(_, info) => savePos({ ...pos, mer:{ x: (pos.mer?.x ?? 0) + info.offset.x, y: (pos.mer?.y ?? 0) + info.offset.y } })}
        style={combine({ position: 'absolute', left: '48%', bottom: '-6%', width: '120px', height: '120px', filter: 'drop-shadow(0 0 18px rgba(200,200,200,.12))', ...(parallax(-3,4)), cursor: edit ? 'grab' : 'default', pointerEvents: edit ? 'auto' : 'none' }, (pos.mer?.x ?? 0), (pos.mer?.y ?? 0))}>
        <svg width="100%" height="100%" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="merBody" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stop-color="#e7e7e7"/>
              <stop offset="60%" stop-color="#a7a7a7"/>
              <stop offset="100%" stop-color="#6d6d6d"/>
            </radialGradient>
          </defs>
          <circle cx="70" cy="70" r="64" fill="url(#merBody)"/>
        </svg>
      </motion.div>)}

      {/* Saturn with rings - top right */}
      {show && (<motion.div aria-hidden initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: 360, opacity: 0.9 }} transition={{ repeat: Infinity, ease: 'linear', duration: 260 / speed }}
        drag={edit} dragMomentum={false}
        onDragEnd={(_, info) => savePos({ ...pos, sat:{ x: (pos.sat?.x ?? 0) + info.offset.x, y: (pos.sat?.y ?? 0) + info.offset.y } })}
        style={combine({ position: 'absolute', right: '-12%', top: '-8%', width: '620px', height: '620px', filter: 'drop-shadow(0 0 60px rgba(139,92,246,.15))', ...(parallax(12,8)), cursor: edit ? 'grab' : 'default', pointerEvents: edit ? 'auto' : 'none' }, (pos.sat?.x ?? 0), (pos.sat?.y ?? 0))}>
        <svg width="100%" height="100%" viewBox="0 0 700 700" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="satBody" cx="50%" cy="45%" r="62%">
              <stop offset="0%" stop-color="#f1d5a8"/>
              <stop offset="60%" stop-color="#caa977"/>
              <stop offset="100%" stop-color="#8f7a57"/>
            </radialGradient>
            <linearGradient id="satRing" x1="0%" x2="100%">
              <stop offset="0%" stop-color="rgba(255,255,255,0.75)"/>
              <stop offset="50%" stop-color="rgba(200,200,255,0.35)"/>
              <stop offset="100%" stop-color="rgba(255,255,255,0.75)"/>
            </linearGradient>
          </defs>
          <g>
            <ellipse cx="350" cy="350" rx="340" ry="110" fill="url(#satRing)" opacity="0.75" transform="rotate(-18 350 350)"/>
            <ellipse cx="350" cy="350" rx="300" ry="90" fill="url(#satRing)" opacity="0.55" transform="rotate(-18 350 350)"/>
            <circle cx="350" cy="350" r="220" fill="url(#satBody)"/>
          </g>
        </svg>
      </motion.div>)}

      {/* Mars - small, reddish - mid right */}
      {show && (<motion.div aria-hidden initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: 360, opacity: 0.85 }} transition={{ repeat: Infinity, ease: 'linear', duration: 180 / speed }}
        drag={edit} dragMomentum={false}
        onDragEnd={(_, info) => savePos({ ...pos, mar:{ x: (pos.mar?.x ?? 0) + info.offset.x, y: (pos.mar?.y ?? 0) + info.offset.y } })}
        style={combine({ position: 'absolute', right: '18%', bottom: '12%', width: '220px', height: '220px', filter: 'drop-shadow(0 0 30px rgba(255,107,53,.18))', ...(parallax(6,10)), cursor: edit ? 'grab' : 'default', pointerEvents: edit ? 'auto' : 'none' }, (pos.mar?.x ?? 0), (pos.mar?.y ?? 0))}>
        <svg width="100%" height="100%" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="marsBody" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stop-color="#ff9f6e"/>
              <stop offset="60%" stop-color="#e0744b"/>
              <stop offset="100%" stop-color="#8a3f2d"/>
            </radialGradient>
          </defs>
          <circle cx="120" cy="120" r="112" fill="url(#marsBody)"/>
          <circle cx="86" cy="88" r="18" fill="#8a3f2d" opacity="0.55"/>
          <circle cx="150" cy="140" r="12" fill="#8a3f2d" opacity="0.45"/>
        </svg>
      </motion.div>)}

      {/* Neptune - deep blue - upper mid left */}
      {show && (<motion.div aria-hidden initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: -360, opacity: 0.85 }} transition={{ repeat: Infinity, ease: 'linear', duration: 240 / speed }}
        drag={edit} dragMomentum={false}
        onDragEnd={(_, info) => savePos({ ...pos, nep:{ x: (pos.nep?.x ?? 0) + info.offset.x, y: (pos.nep?.y ?? 0) + info.offset.y } })}
        style={combine({ position: 'absolute', left: '24%', top: '-6%', width: '280px', height: '280px', filter: 'drop-shadow(0 0 36px rgba(0,245,255,.22))', ...(parallax(-8,4)), cursor: edit ? 'grab' : 'default', pointerEvents: edit ? 'auto' : 'none' }, (pos.nep?.x ?? 0), (pos.nep?.y ?? 0))}>
        <svg width="100%" height="100%" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="nepBody" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stop-color="#55c1ff"/>
              <stop offset="60%" stop-color="#3d7de1"/>
              <stop offset="100%" stop-color="#1b2f69"/>
            </radialGradient>
            <linearGradient id="nepBand" x1="0%" x2="100%">
              <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/>
              <stop offset="100%" stop-color="rgba(255,255,255,0.12)"/>
            </linearGradient>
          </defs>
          <circle cx="150" cy="150" r="140" fill="url(#nepBody)"/>
          <ellipse cx="150" cy="130" rx="135" ry="18" fill="url(#nepBand)" opacity="0.55"/>
        </svg>
      </motion.div>)}
      {/* Iconos flotantes holográficos */}
      <motion.div style={{ position: 'absolute', top: '12%', left: '8%' }}
        initial={{ y: -10, opacity: 0 }} animate={{ y: [ -6, 6, -6 ], opacity: 0.9 }} transition={{ duration: 6, repeat: Infinity }}>
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="21" cy="21" r="18" stroke="#00f5ff" strokeOpacity="0.7" strokeWidth="2" />
          <circle cx="21" cy="21" r="10" stroke="#8b5cf6" strokeOpacity="0.7" strokeWidth="2" />
        </svg>
      </motion.div>
      <motion.div style={{ position: 'absolute', bottom: '16%', right: '10%' }}
        initial={{ y: 10, opacity: 0 }} animate={{ y: [ 8, -8, 8 ], opacity: 0.85 }} transition={{ duration: 7, repeat: Infinity }}>
        <svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="23,6 30,20 45,20 33,29 38,44 23,35 8,44 13,29 1,20 16,20" stroke="#8b5cf6" strokeOpacity="0.8" strokeWidth="1.5" fill="transparent" />
        </svg>
      </motion.div>
      <motion.div style={{ position: 'absolute', top: '24%', right: '22%' }}
        initial={{ x: -8, opacity: 0 }} animate={{ x: [ -6, 6, -6 ], opacity: 0.8 }} transition={{ duration: 8, repeat: Infinity }}>
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="6" width="26" height="26" rx="6" stroke="#39ff14" strokeOpacity="0.8" />
        </svg>
      </motion.div>
    </div>
  );
};

export default NeoAmbient;
