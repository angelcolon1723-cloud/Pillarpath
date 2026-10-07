import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLedger } from "@/store/ledger";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Lock, Pause, Play, Quote, Shirt } from "lucide-react";
import { RANKS, rankForScore } from "./WorldMap";

/* ------------------------------------------------------------------ */
/* Rank stories + quotes — one per alcove.                              */
/* ------------------------------------------------------------------ */
const ALCOVES = [
  {
    rank: "Seedling",
    color: "#4ade80",
    candles: 1,
    story:
      "Every pillar starts as a seed. You took the first step — you showed up. That matters more than you know.",
    quote: "The expert in anything was once a beginner.",
    quoteBy: "Helen Hayes",
    shirt: "/designs/ranks/rank-seedling.png",
  },
  {
    rank: "Sprout",
    color: "#22d3ee",
    candles: 3,
    story:
      "Look at you growing. Every chore done, every Unit saved — you're stronger than yesterday. Keep going.",
    quote: "Don't watch the clock; do what it does. Keep going.",
    quoteBy: "Sam Levenson",
    shirt: "/designs/ranks/rank-sprout.png",
  },
  {
    rank: "Trailblazer",
    color: "#a78bfa",
    candles: 5,
    story:
      "You're not following the path anymore — you're making one. Trailblazers try new things and aren't afraid to fail.",
    quote: "Whether you think you can or you think you can't, you're right.",
    quoteBy: "Henry Ford",
    shirt: "/designs/ranks/rank-trailblazer.png",
  },
  {
    rank: "Luminary",
    color: "#e879f9",
    candles: 8,
    story:
      "Your glow guides others now. Younger kids look at you and think: I want to be like that. Shine on.",
    quote: "The future belongs to those who believe in the beauty of their dreams.",
    quoteBy: "Eleanor Roosevelt",
    shirt: "/designs/ranks/rank-luminary.png",
  },
  {
    rank: "Pillar",
    color: "#fbbf24",
    candles: 12,
    story:
      "A pillar others can lean on. You didn't just become better — you became someone who lifts others. This is what the Society is for.",
    quote: "I never dreamed about success. I worked for it.",
    quoteBy: "Estée Lauder",
    shirt: "/designs/ranks/rank-pillar.png",
  },
];

function makeNebulaTexture(): THREE.CanvasTexture {
  const s = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#04060e";
  ctx.fillRect(0, 0, s, s);
  const blobs: Array<[number, number, number, string]> = [
    [300, 300, 280, "rgba(139,92,246,0.22)"],
    [750, 650, 320, "rgba(34,211,238,0.15)"],
    [550, 800, 240, "rgba(232,121,249,0.17)"],
    [150, 750, 200, "rgba(99,102,241,0.19)"],
  ];
  for (const [x, y, r, c] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = Math.random() * 1.7 + 0.4;
    ctx.fillStyle = `rgba(220,230,255,${0.3 + Math.random() * 0.7})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeRankNameTexture(name: string, color: string): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.font = "bold 120px system-ui";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 40;
  ctx.fillText(name.toUpperCase(), w / 2, 165);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function WisdomRoom3D({ score }: { score: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const setScreen = useLedger((s) => s.setScreen);
  const { rank } = rankForScore(score);
  const rankIndex = RANKS.indexOf(rank);
  const unlocked = score >= 50;
  const [paused, setPaused] = useState(false);
  const [activeAlcove, setActiveAlcove] = useState(0);
  const pausedRef = useRef(false);
  const setAlcoveRef = useRef(setActiveAlcove);
  setAlcoveRef.current = setActiveAlcove;

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!unlocked || !mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth;
    const H = Math.min(window.innerHeight * 0.58, 520);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060e);
    scene.fog = new THREE.Fog(0x0b1132, 24, 60);

    const camera = new THREE.PerspectiveCamera(66, W / H, 0.1, 140);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // ---- Lights ----
    scene.add(new THREE.AmbientLight(0x8a9bff, 0.45));

    // ---- Hallway: long corridor along Z. 5 alcoves. ----
    const HALL_W = 10;
    const HALL_H = 6;
    const SECTION = 14; // length per alcove
    const TOTAL = SECTION * ALCOVES.length; // 70
    const nebulaTex = makeNebulaTexture();

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: nebulaTex, roughness: 0.92, metalness: 0.08,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xbfd0ff, map: makeNebulaTexture(), roughness: 0.32, metalness: 0.72,
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, TOTAL + 20), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -TOTAL / 2;
    scene.add(floor);

    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(HALL_W, TOTAL + 20),
      new THREE.MeshStandardMaterial({ color: 0x070716, roughness: 0.95 }),
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, HALL_H, -TOTAL / 2);
    scene.add(ceil);

    const mkWall = (len: number) => new THREE.Mesh(new THREE.PlaneGeometry(len, HALL_H), wallMat);
    const wallL = mkWall(TOTAL + 20);
    wallL.position.set(-HALL_W / 2, HALL_H / 2, -TOTAL / 2);
    wallL.rotation.y = Math.PI / 2;
    scene.add(wallL);
    const wallR = mkWall(TOTAL + 20);
    wallR.position.set(HALL_W / 2, HALL_H / 2, -TOTAL / 2);
    wallR.rotation.y = -Math.PI / 2;
    scene.add(wallR);
    // End cap behind the last alcove.
    const wallEnd = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, HALL_H), wallMat);
    wallEnd.position.set(0, HALL_H / 2, -TOTAL - 6);
    scene.add(wallEnd);

    // Neon trim along the hallway.
    const trimMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const trimMat2 = new THREE.MeshBasicMaterial({ color: 0xe879f9 });
    for (const [x, mat] of [[-HALL_W / 2 + 0.08, trimMat], [HALL_W / 2 - 0.08, trimMat2]] as const) {
      for (const y of [0.4, HALL_H - 0.4]) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, TOTAL + 20), mat);
        t.position.set(x, y, -TOTAL / 2);
        scene.add(t);
      }
    }

    // ---- Alcoves ----
    const loader = new THREE.TextureLoader();
    const candleFlames: THREE.PointLight[] = [];
    const billboards: THREE.Mesh[] = [];
    const orbs: THREE.Mesh[] = [];
    // (declared above; kept here for clarity)

    ALCOVES.forEach((alcove, i) => {
      const zc = -(i * SECTION + SECTION / 2); // center of this section
      const color = new THREE.Color(alcove.color);

      // Alcove glow light.
      const glow = new THREE.PointLight(color, 42, 22);
      glow.position.set(0, 3.4, zc);
      scene.add(glow);

      // T-shirt on the wall (left side) — framed like gallery art.
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a3a, roughness: 0.4, metalness: 0.6,
      });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.4, 0.18), frameMat);
      frame.position.set(-HALL_W / 2 + 0.35, 3.1, zc);
      frame.rotation.y = Math.PI / 2;
      scene.add(frame);
      // Neon frame edge.
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 4.6, 0.1),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.55 }),
      );
      edge.position.set(-HALL_W / 2 + 0.28, 3.1, zc);
      edge.rotation.y = Math.PI / 2;
      scene.add(edge);

      loader.load(
        alcove.shirt,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          const art = new THREE.Mesh(
            new THREE.PlaneGeometry(3.2, 4.0),
            new THREE.MeshBasicMaterial({ map: tex }),
          );
          art.position.set(-HALL_W / 2 + 0.46, 3.1, zc);
          art.rotation.y = Math.PI / 2;
          scene.add(art);
        },
        undefined,
        () => {},
      );

      // Rank name in big neon (right side).
      const nameTex = makeRankNameTexture(alcove.rank, alcove.color);
      const namePlane = new THREE.Mesh(
        new THREE.PlaneGeometry(5.2, 1.3),
        new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, depthWrite: false }),
      );
      namePlane.position.set(HALL_W / 2 - 0.15, 4.1, zc);
      namePlane.rotation.y = -Math.PI / 2;
      scene.add(namePlane);
      billboards.push(namePlane);

      // "YOU ARE HERE" marker for current rank.
      if (i === rankIndex) {
        const hereTex = makeRankNameTexture("★ YOU ★", "#ffffff");
        const here = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6, 0.65),
          new THREE.MeshBasicMaterial({ map: hereTex, transparent: true, depthWrite: false }),
        );
        here.position.set(HALL_W / 2 - 0.15, 3.1, zc);
        here.rotation.y = -Math.PI / 2;
        scene.add(here);
        billboards.push(here);
      }

      // Candles — small glowing flames along the floor, more per rank.
      const candleGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.5, 8);
      const candleMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1a, roughness: 0.8 });
      const flameGeo = new THREE.SphereGeometry(0.09, 8, 8);
      for (let c = 0; c < alcove.candles; c++) {
        const side = c % 2 === 0 ? -1 : 1;
        const cx = side * (HALL_W / 2 - 1.1);
        const cz = zc - SECTION / 2 + 2 + (c * (SECTION - 4)) / Math.max(1, alcove.candles - 1);
        const candle = new THREE.Mesh(candleGeo, candleMat);
        candle.position.set(cx, 0.25, cz);
        scene.add(candle);
        const flame = new THREE.PointLight(0xffb347, 7, 7);
        flame.position.set(cx, 0.75, cz);
        flame.userData = { base: 7, ph: Math.random() * Math.PI * 2, cz };
        scene.add(flame);
        candleFlames.push(flame);
        const flameMesh = new THREE.Mesh(
          flameGeo,
          new THREE.MeshBasicMaterial({ color: 0xffd27a }),
        );
        flameMesh.position.set(cx, 0.62, cz);
        flameMesh.userData = { ph: flame.userData.ph };
        scene.add(flameMesh);
        (flame.userData as { mesh?: THREE.Mesh }).mesh = flameMesh;
      }

      // Richness: extra floating orbs for higher ranks.
      const orbCount = i * 4;
      const orbGeo = new THREE.SphereGeometry(0.08, 8, 8);
      for (let o = 0; o < orbCount; o++) {
        const m = new THREE.Mesh(
          orbGeo,
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }),
        );
        const a = Math.random() * Math.PI * 2;
        const r = 1.5 + Math.random() * 2.5;
        m.position.set(Math.cos(a) * r, 1.5 + Math.random() * 3.5, zc + (Math.random() - 0.5) * SECTION * 0.7);
        m.userData = { y0: m.position.y, ph: Math.random() * Math.PI * 2 };
        scene.add(m);
        orbs.push(m);
      }
    });


    // Grand finale: golden Pillar monument at the very end.
    const endZ = -TOTAL - 2;
    const monMat = new THREE.MeshStandardMaterial({
      color: 0x3a2f14, emissive: 0xfbbf24, emissiveIntensity: 0.55,
      roughness: 0.25, metalness: 0.85,
    });
    const monument = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 5.4, 14), monMat);
    monument.position.set(0, 2.7, endZ);
    scene.add(monument);
    const mRingA = new THREE.Mesh(
      new THREE.TorusGeometry(2.0, 0.05, 10, 64),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 }),
    );
    mRingA.position.set(0, 3.6, endZ);
    mRingA.rotation.x = Math.PI / 2 - 0.4;
    scene.add(mRingA);
    const mRingB = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.05, 10, 64),
      new THREE.MeshBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.9 }),
    );
    mRingB.position.set(0, 3.2, endZ);
    mRingB.rotation.x = Math.PI / 2 + 0.35;
    mRingB.rotation.y = 0.5;
    scene.add(mRingB);
    const endLight = new THREE.PointLight(0xfbbf24, 90, 30);
    endLight.position.set(0, 4.5, endZ + 2);
    scene.add(endLight);

    // ---- Camera tour: glide down the hallway, pause at each alcove ----
    type Stop = { pos: THREE.Vector3; look: THREE.Vector3; alcove: number };
    const stops: Stop[] = ALCOVES.map((_, i) => {
      const zc = -(i * SECTION + SECTION / 2);
      return {
        pos: new THREE.Vector3(1.6, 2.3, zc + 5.2),
        look: new THREE.Vector3(-1.2, 2.8, zc - 1),
        alcove: i,
      };
    });
    // Opening wide shot.
    stops.unshift({ pos: new THREE.Vector3(0, 2.8, 7), look: new THREE.Vector3(0, 2.6, -12), alcove: -1 });
    // Finale at the monument.
    stops.push({ pos: new THREE.Vector3(0, 2.6, endZ + 9), look: new THREE.Vector3(0, 3.2, endZ), alcove: 4 });

    let stopIdx = 0;
    let stopTime = 0;
    const STOP_DURATION = 8;
    const TRANSITION = 2.6;
    let transT = 1;
    const fromPos = stops[0].pos.clone();
    const fromLook = stops[0].look.clone();
    const tmpPos = new THREE.Vector3();
    const tmpLook = new THREE.Vector3();
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    let yaw = 0;
    let pitch = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const el = renderer.domElement;
    el.style.touchAction = "none";
    const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw -= (e.clientX - lastX) * 0.004;
      pitch -= (e.clientY - lastY) * 0.0025;
      pitch = Math.max(-0.45, Math.min(0.45, pitch));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => { dragging = false; };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;

      // Candle flicker.
      for (const f of candleFlames) {
        const u = f.userData as { base: number; ph: number; mesh?: THREE.Mesh };
        f.intensity = u.base + Math.sin(t * 11 + u.ph) * 1.6 + Math.sin(t * 23 + u.ph) * 0.8;
        if (u.mesh) {
          const s = 1 + Math.sin(t * 13 + u.ph) * 0.18;
          u.mesh.scale.set(s, 1 + Math.sin(t * 17 + u.ph) * 0.25, s);
        }
      }
      // Orbs drift.
      for (const o of orbs) {
        const u = o.userData as { y0: number; ph: number };
        o.position.y = u.y0 + Math.sin(t * 0.8 + u.ph) * 0.4;
      }
      // Monument rings rotate.
      mRingA.rotation.z = t * 0.25;
      mRingB.rotation.z = -t * 0.18;
      monMat.emissiveIntensity = 0.5 + Math.sin(t * 1.6) * 0.15;
      for (const b of billboards) b.quaternion.copy(camera.quaternion);

      // Tour.
      if (!pausedRef.current) {
        stopTime += dt;
        const stop = stops[stopIdx];
        if (transT < 1) {
          transT = Math.min(1, transT + dt / TRANSITION);
          const e = easeInOut(transT);
          tmpPos.lerpVectors(fromPos, stop.pos, e);
          tmpLook.lerpVectors(fromLook, stop.look, e);
        } else {
          tmpPos.copy(stop.pos);
          tmpLook.copy(stop.look);
          tmpPos.x += Math.sin(t * 0.45) * 0.12;
          if (stopTime >= STOP_DURATION) {
            stopTime = 0;
            transT = 0;
            fromPos.copy(stop.pos);
            fromLook.copy(stop.look);
            stopIdx = (stopIdx + 1) % stops.length;
            setAlcoveRef.current(stops[stopIdx].alcove);
          }
        }
      } else {
        tmpPos.copy(stops[stopIdx].pos);
        tmpLook.copy(stops[stopIdx].look);
      }

      camera.position.copy(tmpPos);
      const dir = tmpLook.clone().sub(tmpPos).normalize();
      const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      dir.applyQuaternion(yawQ);
      dir.y += pitch;
      dir.normalize();
      camera.lookAt(tmpPos.clone().add(dir));
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = Math.min(window.innerHeight * 0.58, 520);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[];
        const dispose = (m: THREE.Material) => {
          const mm = m as THREE.MeshBasicMaterial;
          if (mm.map) mm.map.dispose();
          m.dispose();
        };
        if (Array.isArray(mat)) mat.forEach(dispose);
        else if (mat) dispose(mat);
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8 text-center">
        <Button variant="ghost" size="sm" onClick={() => setScreen("home")} className="gap-1">
          <ArrowLeft className="size-4" /> Back to the World
        </Button>
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-accent-soft text-accent">
          <Lock className="size-10" />
        </div>
        <h1 className="font-display text-2xl font-bold">The Hall of Becoming</h1>
        <p className="text-muted">
          This sacred hallway opens to those who reach the{" "}
          <span className="font-semibold text-ink">Sprout</span> rank. Keep doing
          chores, saving, and creating — you're on your way.
        </p>
        <div className="mx-auto h-2 max-w-xs overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 transition-all"
            style={{ width: `${Math.min(100, Math.round((score / 50) * 100))}%` }}
          />
        </div>
        <p className="text-sm text-muted">{score} / 50 to unlock</p>
      </div>
    );
  }

  const alcove = activeAlcove >= 0 ? ALCOVES[activeAlcove] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setScreen("home")} className="gap-1">
          <ArrowLeft className="size-4" /> World
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)} className="gap-1">
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          {paused ? "Resume" : "Pause"}
        </Button>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          Walk the path of becoming
        </p>
        <h1 className="font-display text-3xl font-bold">The Hall of Becoming</h1>
      </div>

      <div ref={mountRef} className="overflow-hidden rounded-2xl border border-accent/20" style={{ minHeight: 360 }} />

      {/* Alcove story card */}
      <div className="min-h-44">
        {alcove ? (
          <Card key={activeAlcove} className="screen-enter space-y-3 border-accent/30 p-5">
            <div className="flex items-center gap-2">
              <span
                className="inline-block size-3 rounded-full"
                style={{ backgroundColor: alcove.color, boxShadow: `0 0 12px ${alcove.color}` }}
              />
              <p className="font-display text-xl font-bold" style={{ color: alcove.color }}>
                {alcove.rank}
              </p>
              {ALCOVES.indexOf(alcove) === rankIndex && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">
                  YOUR RANK
                </span>
              )}
            </div>
            <p className="text-[15px] leading-relaxed">{alcove.story}</p>
            <div className="rounded-xl bg-surface p-4">
              <Quote className="mb-1 size-4" style={{ color: alcove.color }} />
              <p className="font-display text-base italic">"{alcove.quote}"</p>
              <p className="mt-1 text-sm text-muted">— {alcove.quoteBy}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setScreen("market")}
            >
              <Shirt className="size-4" /> See the {alcove.rank} shirt
            </Button>
          </Card>
        ) : (
          <Card className="p-5 text-center">
            <p className="font-display text-lg">The Hall of Becoming</p>
            <p className="mt-1 text-sm text-muted">
              Five ranks. Five stories. One journey — yours.
            </p>
          </Card>
        )}
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {ALCOVES.map((a, i) => (
          <span
            key={a.rank}
            className="size-2.5 rounded-full transition-all"
            style={{
              backgroundColor: i === activeAlcove ? a.color : "var(--surface)",
              boxShadow: i === activeAlcove ? `0 0 10px ${a.color}` : "none",
              transform: i === activeAlcove ? "scale(1.35)" : "scale(1)",
            }}
          />
        ))}
      </div>

      <p className="text-center text-xs text-muted">
        Sit back — the hall guides you. Each alcove grows richer than the last.
      </p>
    </div>
  );
}
