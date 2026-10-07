import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLedger } from "@/store/ledger";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Lock, Pause, Play, Quote } from "lucide-react";
import { RANKS, rankForScore } from "./WorldMap";

const QUOTES = [
  { text: "I never dreamed about success. I worked for it.", author: "Estée Lauder" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
];

function makeNebulaTexture(): THREE.CanvasTexture {
  const s = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  // Deep space base.
  ctx.fillStyle = "#04060e";
  ctx.fillRect(0, 0, s, s);
  // Nebula blobs in brand colors.
  const blobs: Array<[number, number, number, string]> = [
    [300, 300, 260, "rgba(139,92,246,0.20)"],
    [750, 650, 300, "rgba(34,211,238,0.14)"],
    [550, 800, 220, "rgba(232,121,249,0.16)"],
    [150, 750, 180, "rgba(99,102,241,0.18)"],
    [850, 200, 200, "rgba(34,211,238,0.10)"],
  ];
  for (const [x, y, r, c] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
  // Stars.
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = Math.random() * 1.6 + 0.4;
    const tw = 0.35 + Math.random() * 0.65;
    ctx.fillStyle = `rgba(220,230,255,${tw})`;
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

function makePlaqueTexture(accent: string): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // Glassmorphic deep-space plaque.
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "rgba(11,17,50,0.96)");
  grad.addColorStop(1, "rgba(4,6,14,0.96)");
  // Rounded rect.
  const r = 48;
  ctx.beginPath();
  ctx.roundRect(8, 8, w - 16, h - 16, r);
  ctx.fillStyle = grad;
  ctx.fill();
  // Brand gradient border (cyan -> violet -> magenta).
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#22d3ee");
  bg.addColorStop(0.55, "#818cf8");
  bg.addColorStop(1, "#e879f9");
  ctx.strokeStyle = bg;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(14, 14, w - 28, h - 28, r - 6);
  ctx.stroke();
  // Big decorative quote mark in accent.
  ctx.font = "bold 190px Georgia";
  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.95;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 30;
  ctx.fillText("\u201C", w / 2, 235);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  // Small orbit ring accent at the bottom.
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(w / 2, h - 110, 120, 34, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLabelTexture(text: string, sub: string, accent: string): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.font = "bold 72px system-ui";
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 24;
  ctx.fillText(text, w / 2, 110);
  ctx.shadowBlur = 0;
  ctx.font = "40px system-ui";
  ctx.fillStyle = "#cdd2ff";
  ctx.fillText(sub, w / 2, 180);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type TourStop = { pos: THREE.Vector3; look: THREE.Vector3; quote: number };

export function WisdomRoom3D({ score }: { score: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const setScreen = useLedger((s) => s.setScreen);
  const { rank } = rankForScore(score);
  const rankIndex = RANKS.indexOf(rank);
  const unlocked = score >= 50;
  const [paused, setPaused] = useState(false);
  const [activeQuote, setActiveQuote] = useState(0);
  const pausedRef = useRef(false);
  const setActiveQuoteRef = useRef(setActiveQuote);
  setActiveQuoteRef.current = setActiveQuote;

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!unlocked || !mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth;
    const H = Math.min(window.innerHeight * 0.62, 560);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060e);
    scene.fog = new THREE.Fog(0x0b1132, 20, 48);

    const camera = new THREE.PerspectiveCamera(68, W / H, 0.1, 120);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // ---- Lights (brand trio: cyan / violet / magenta) ----
    scene.add(new THREE.AmbientLight(0x8a9bff, 0.5));
    const centerLight = new THREE.PointLight(0x8b5cf6, 90, 36);
    centerLight.position.set(0, 5.4, 0);
    scene.add(centerLight);
    const cyanLight = new THREE.PointLight(0x22d3ee, 55, 30);
    cyanLight.position.set(-7, 3.4, 5);
    scene.add(cyanLight);
    const magentaLight = new THREE.PointLight(0xe879f9, 55, 30);
    magentaLight.position.set(7, 3.4, -5);
    scene.add(magentaLight);

    // ---- Room ----
    const ROOM = 18;
    const HROOM = 7;
    const nebulaTex = makeNebulaTexture();
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: nebulaTex,
      roughness: 0.92,
      metalness: 0.08,
    });
    const floorNeb = makeNebulaTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xbfd0ff,
      map: floorNeb,
      roughness: 0.32,
      metalness: 0.72,
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Reflective-feel center circle.
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 4.4, 48),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    scene.add(disc);
    const disc2 = new THREE.Mesh(
      new THREE.RingGeometry(4.7, 4.85, 48),
      new THREE.MeshBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
    );
    disc2.rotation.x = -Math.PI / 2;
    disc2.position.y = 0.02;
    scene.add(disc2);

    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM, ROOM),
      new THREE.MeshStandardMaterial({ color: 0x090920, roughness: 0.95 }),
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = HROOM;
    scene.add(ceil);

    const mkWall = () => new THREE.Mesh(new THREE.PlaneGeometry(ROOM, HROOM), wallMat);
    const wallN = mkWall(); wallN.position.set(0, HROOM / 2, -ROOM / 2); scene.add(wallN);
    const wallS = mkWall(); wallS.position.set(0, HROOM / 2, ROOM / 2); wallS.rotation.y = Math.PI; scene.add(wallS);
    const wallE = mkWall(); wallE.position.set(ROOM / 2, HROOM / 2, 0); wallE.rotation.y = -Math.PI / 2; scene.add(wallE);
    const wallW = mkWall(); wallW.position.set(-ROOM / 2, HROOM / 2, 0); wallW.rotation.y = Math.PI / 2; scene.add(wallW);

    // Neon trim.
    const trimMatA = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const trimMatB = new THREE.MeshBasicMaterial({ color: 0xe879f9 });
    const mkTrim = (len: number, mat: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), mat);
    for (const [z, mat] of [[-ROOM / 2 + 0.06, trimMatA], [ROOM / 2 - 0.06, trimMatB]] as const) {
      for (const y of [0.5, HROOM - 0.5]) {
        const t = mkTrim(ROOM, mat);
        t.position.set(0, y, z);
        scene.add(t);
      }
    }
    const mkTrimV = (len: number, mat: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, len), mat);
    for (const [x, mat] of [[-ROOM / 2 + 0.06, trimMatA], [ROOM / 2 - 0.06, trimMatB]] as const) {
      for (const y of [0.5, HROOM - 0.5]) {
        const t = mkTrimV(ROOM, mat);
        t.position.set(x, y, 0);
        scene.add(t);
      }
    }

    // ---- Quote plaques (big, glowing, easy to spot) ----
    const accents = ["#22d3ee", "#e879f9", "#a78bfa", "#fbbf24", "#4ade80", "#f472b6"];
    const plaquePositions: Array<[number, number, number, number]> = [
      [-4.5, 3.2, -ROOM / 2 + 0.08, 0],
      [4.5, 3.2, -ROOM / 2 + 0.08, 0],
      [-4.5, 3.2, ROOM / 2 - 0.08, Math.PI],
      [4.5, 3.2, ROOM / 2 - 0.08, Math.PI],
      [-ROOM / 2 + 0.08, 3.2, 0, Math.PI / 2],
      [ROOM / 2 - 0.08, 3.2, 0, -Math.PI / 2],
    ];
    const plaqueMeshes: THREE.Mesh[] = [];
    QUOTES.forEach((_, i) => {
      const tex = makePlaqueTexture(accents[i % accents.length]);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 2.6),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
      );
      const [x, y, z, ry] = plaquePositions[i];
      m.position.set(x, y, z);
      m.rotation.y = ry;
      scene.add(m);
      plaqueMeshes.push(m);
      // Pedestal glow under each plaque.
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 0.5),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(accents[i % accents.length]), transparent: true, opacity: 0.35 }),
      );
      glow.rotation.x = -Math.PI / 2;
      // Project wall position onto floor.
      const fx = Math.abs(x) > ROOM / 2 - 1 ? Math.sign(x) * (ROOM / 2 - 1.2) : x;
      const fz = Math.abs(z) > ROOM / 2 - 1 ? Math.sign(z) * (ROOM / 2 - 1.2) : z;
      glow.position.set(fx, 0.03, fz);
      scene.add(glow);
    });

    // ---- Rank pillars ----
    const billboards: THREE.Mesh[] = [];
    const rankColors = ["#4ade80", "#22d3ee", "#a78bfa", "#e879f9", "#fbbf24"];
    const pillarMeshes: THREE.MeshStandardMaterial[] = [];
    RANKS.forEach((r, i) => {
      const isCurrent = i === rankIndex;
      const hgt = isCurrent ? 3.6 : 2.4 + i * 0.15;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x181844,
        emissive: new THREE.Color(rankColors[i]),
        emissiveIntensity: isCurrent ? 1.0 : 0.3,
        roughness: 0.25,
        metalness: 0.75,
      });
      pillarMeshes.push(mat);
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, hgt, 1.2), mat);
      const angle = (i / RANKS.length) * Math.PI * 2 + Math.PI / 5;
      const px = Math.cos(angle) * 5.6;
      const pz = Math.sin(angle) * 5.6;
      pillar.position.set(px, hgt / 2, pz);
      scene.add(pillar);

      const labelTex = makeLabelTexture(r.name.toUpperCase(), isCurrent ? "★ YOU ★" : `${i + 1} of 5`, rankColors[i]);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 1.2),
        new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false }),
      );
      label.position.set(px, hgt + 1.0, pz);
      scene.add(label);
      billboards.push(label);
    });

    // ---- Central Pillar of Becoming (echoes the PillarMark: pillar + orbit rings) ----
    const centralMat = new THREE.MeshStandardMaterial({
      color: 0x2a2f66,
      emissive: 0x818cf8,
      emissiveIntensity: 0.85,
      roughness: 0.22,
      metalness: 0.85,
    });
    const central = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 5.2, 16), centralMat);
    central.position.set(0, 2.6, 0);
    scene.add(central);
    // Capital + base slabs.
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x1c2150, emissive: 0x22d3ee, emissiveIntensity: 0.35,
      roughness: 0.3, metalness: 0.8,
    });
    for (const y of [0.25, 5.05]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.32, 2.0), slabMat);
      slab.position.set(0, y, 0);
      scene.add(slab);
    }
    // Orbit rings (cyan + magenta, tilted like the logo).
    const ringMatA = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 });
    const ringMatB = new THREE.MeshBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.85 });
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.045, 12, 72), ringMatA);
    ringA.position.set(0, 3.4, 0);
    ringA.rotation.x = Math.PI / 2 - 0.42;
    scene.add(ringA);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.045, 12, 72), ringMatB);
    ringB.position.set(0, 3.1, 0);
    ringB.rotation.x = Math.PI / 2 + 0.35;
    ringB.rotation.y = 0.5;
    scene.add(ringB);
    // Glowing orb atop the pillar.
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    orb.position.set(0, 5.75, 0);
    scene.add(orb);
    const orbLight = new THREE.PointLight(0xcc99ff, 60, 18);
    orbLight.position.set(0, 5.75, 0);
    scene.add(orbLight);

    // ---- Floating wisdom orbs ----
    const orbs: THREE.Mesh[] = [];
    const orbGeo = new THREE.SphereGeometry(0.12, 12, 12);
    for (let i = 0; i < 26; i++) {
      const c = accents[i % accents.length];
      const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: 0.85 }));
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 5;
      m.position.set(Math.cos(a) * r, 1 + Math.random() * 4.5, Math.sin(a) * r);
      m.userData = { a, r, speed: 0.15 + Math.random() * 0.25, y0: m.position.y, ph: Math.random() * Math.PI * 2 };
      scene.add(m);
      orbs.push(m);
    }

    // ---- Tour path ----
    const stops: TourStop[] = plaquePositions.map(([x, y, z], i) => {
      // Stand back from the wall, look at the plaque.
      const inward = new THREE.Vector3(-x, 0, -z).normalize();
      const pos = new THREE.Vector3(x, 2.1, z).add(inward.multiplyScalar(4.2));
      pos.y = 2.1;
      return { pos, look: new THREE.Vector3(x, y, z), quote: i };
    });
    // Start with a wide view of the ranks.
    stops.unshift({
      pos: new THREE.Vector3(0, 2.6, 8.2),
      look: new THREE.Vector3(0, 2.4, 0),
      quote: -1,
    });

    let stopIdx = 0;
    let stopTime = 0;
    const STOP_DURATION = 7; // seconds per stop
    const TRANSITION = 2.2;
    let transT = 0;
    let fromPos = stops[0].pos.clone();
    let fromLook = stops[0].look.clone();
    const tmpPos = new THREE.Vector3();
    const tmpLook = new THREE.Vector3();

    // Manual look (drag) offsets the tour.
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
      pitch = Math.max(-0.5, Math.min(0.5, pitch));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => { dragging = false; };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    let raf = 0;
    const clock = new THREE.Clock();
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;

      // Ambient animation.
      central.rotation.y = t * 0.25;
      centralMat.emissiveIntensity = 0.75 + Math.sin(t * 1.8) * 0.25;
      ringA.rotation.z = t * 0.22;
      ringB.rotation.z = -t * 0.16;
      orb.position.y = 5.75 + Math.sin(t * 1.4) * 0.16;
      orbLight.intensity = 55 + Math.sin(t * 1.8) * 12;
      disc.rotation.z = t * 0.05;
      for (const o of orbs) {
        const u = o.userData;
        u.a += dt * u.speed * 0.4;
        o.position.x = Math.cos(u.a) * u.r;
        o.position.z = Math.sin(u.a) * u.r;
        o.position.y = u.y0 + Math.sin(t * 0.9 + u.ph) * 0.35;
      }
      plaqueMeshes.forEach((p, i) => {
        const s = 1 + Math.sin(t * 1.6 + i) * 0.02;
        p.scale.set(s, s, 1);
      });
      pillarMeshes.forEach((m, i) => {
        if (i === rankIndex) m.emissiveIntensity = 0.9 + Math.sin(t * 2.4) * 0.3;
      });
      for (const b of billboards) b.quaternion.copy(camera.quaternion);

      // Tour logic.
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
          // Gentle sway while dwelling.
          tmpPos.x += Math.sin(t * 0.5) * 0.15;
          if (stopTime >= STOP_DURATION) {
            stopTime = 0;
            transT = 0;
            fromPos.copy(stop.pos);
            fromLook.copy(stop.look);
            stopIdx = (stopIdx + 1) % stops.length;
            const nq = stops[stopIdx].quote;
            setActiveQuoteRef.current(nq);
          }
        }
      } else {
        tmpPos.copy(stops[stopIdx].pos);
        tmpLook.copy(stops[stopIdx].look);
      }

      camera.position.copy(tmpPos);
      const lookDir = tmpLook.clone().sub(tmpPos).normalize();
      // Apply manual yaw/pitch offset.
      const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      lookDir.applyQuaternion(yawQ);
      lookDir.y += pitch;
      lookDir.normalize();
      camera.lookAt(tmpPos.clone().add(lookDir));

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = Math.min(window.innerHeight * 0.62, 560);
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
        if (Array.isArray(mat)) mat.forEach((m) => { const mm = m as THREE.MeshBasicMaterial; if (mm.map) mm.map.dispose(); m.dispose(); });
        else if (mat) { const mm = mat as THREE.MeshBasicMaterial; if (mm.map) mm.map.dispose(); mat.dispose(); }
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
          This sacred hall opens to those who reach the{" "}
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

  const q = activeQuote >= 0 ? QUOTES[activeQuote] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setScreen("home")} className="gap-1">
          <ArrowLeft className="size-4" /> World
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)} className="gap-1">
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          {paused ? "Resume tour" : "Pause"}
        </Button>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          A sacred hall of the Society
        </p>
        <h1 className="font-display text-3xl font-bold">The Hall of Becoming</h1>
      </div>

      <div ref={mountRef} className="overflow-hidden rounded-2xl border border-accent/20" style={{ minHeight: 380 }} />

      {/* Big readable quote card */}
      <div className="min-h-28">
        {q ? (
          <Card key={activeQuote} className="screen-enter border-accent/30 p-5 text-center">
            <Quote className="mx-auto mb-2 size-5 text-accent" />
            <p className="font-display text-lg leading-relaxed">"{q.text}"</p>
            <p className="mt-2 text-sm text-muted">— {q.author}</p>
          </Card>
        ) : (
          <Card className="p-5 text-center">
            <p className="font-display text-lg">The Ranks of the Society</p>
            <p className="mt-1 text-sm text-muted">
              You are <span className="font-semibold text-ink">{rank.name}</span> — {rank.tagline}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              {RANKS.map((r, i) => (
                <span
                  key={r.name}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${i === rankIndex ? "bg-accent text-white" : i < rankIndex ? "bg-accent-soft text-accent" : "bg-surface text-muted"}`}
                >
                  {r.name}
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>

      <p className="text-center text-xs text-muted">
        Sit back — the hall guides you. Drag to peek around, tap pause anytime.
      </p>
    </div>
  );
}
