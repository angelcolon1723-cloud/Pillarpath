import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useLedger } from "@/store/ledger";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock } from "lucide-react";
import { RANKS, rankForScore } from "./WorldMap";

const QUOTES = [
  { text: "I never dreamed about success. I worked for it.", author: "Estée Lauder" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
];

function makeTextTexture(
  lines: string[],
  opts: { w?: number; h?: number; titleSize?: number; bodySize?: number; accent?: string } = {},
): THREE.CanvasTexture {
  const w = opts.w ?? 1024;
  const h = opts.h ?? 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // Dark plaque background with subtle gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0d0d2b");
  grad.addColorStop(1, "#1a0d2b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Neon border.
  ctx.strokeStyle = opts.accent ?? "#22d3ee";
  ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, w - 32, h - 32);
  ctx.textAlign = "center";
  let y = 120;
  for (const line of lines) {
    const isTitle = line.startsWith("##");
    const text = isTitle ? line.slice(2) : line;
    ctx.font = isTitle
      ? `bold ${opts.titleSize ?? 72}px system-ui`
      : `${opts.bodySize ?? 44}px system-ui`;
    ctx.fillStyle = isTitle ? (opts.accent ?? "#22d3ee") : "#e8e8ff";
    // Word wrap.
    const words = text.split(" ");
    let row = "";
    const maxW = w - 120;
    for (const word of words) {
      const test = row ? `${row} ${word}` : word;
      if (ctx.measureText(test).width > maxW && row) {
        ctx.fillText(row, w / 2, y);
        y += (isTitle ? opts.titleSize ?? 72 : opts.bodySize ?? 44) + 16;
        row = word;
      } else {
        row = test;
      }
    }
    if (row) {
      ctx.fillText(row, w / 2, y);
      y += (isTitle ? opts.titleSize ?? 72 : opts.bodySize ?? 44) + 32;
    }
  }
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

  useEffect(() => {
    if (!unlocked || !mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth;
    const H = Math.min(window.innerHeight * 0.7, 600);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050518);
    scene.fog = new THREE.Fog(0x050518, 18, 40);

    const camera = new THREE.PerspectiveCamera(70, W / H, 0.1, 100);
    camera.position.set(0, 2.2, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Lights.
    scene.add(new THREE.AmbientLight(0x8899ff, 0.5));
    const center = new THREE.PointLight(0xaa66ff, 60, 30);
    center.position.set(0, 4.5, 0);
    scene.add(center);
    const cyan = new THREE.PointLight(0x22d3ee, 30, 20);
    cyan.position.set(-6, 3, -6);
    scene.add(cyan);
    const magenta = new THREE.PointLight(0xf0f, 30, 20);
    magenta.position.set(6, 3, -6);
    scene.add(magenta);

    // Room: 16 x 6 x 16.
    const ROOM = 16;
    const HROOM = 6;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x111133,
      roughness: 0.85,
      metalness: 0.15,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a24,
      roughness: 0.4,
      metalness: 0.6,
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM, ROOM),
      new THREE.MeshStandardMaterial({ color: 0x08081c, roughness: 0.9 }),
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = HROOM;
    scene.add(ceil);

    const mkWall = (w: number, h: number) =>
      new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    const wallN = mkWall(ROOM, HROOM);
    wallN.position.set(0, HROOM / 2, -ROOM / 2);
    scene.add(wallN);
    const wallS = mkWall(ROOM, HROOM);
    wallS.position.set(0, HROOM / 2, ROOM / 2);
    wallS.rotation.y = Math.PI;
    scene.add(wallS);
    const wallE = mkWall(ROOM, HROOM);
    wallE.position.set(ROOM / 2, HROOM / 2, 0);
    wallE.rotation.y = -Math.PI / 2;
    scene.add(wallE);
    const wallW = mkWall(ROOM, HROOM);
    wallW.position.set(-ROOM / 2, HROOM / 2, 0);
    wallW.rotation.y = Math.PI / 2;
    scene.add(wallW);

    // Glowing trim lines along walls.
    const trimMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const trimGeo = new THREE.BoxGeometry(ROOM, 0.06, 0.06);
    for (const z of [-ROOM / 2 + 0.05, ROOM / 2 - 0.05]) {
      const t = new THREE.Mesh(trimGeo, trimMat);
      t.position.set(0, 0.4, z);
      scene.add(t);
      const t2 = new THREE.Mesh(trimGeo, trimMat);
      t2.position.set(0, HROOM - 0.4, z);
      scene.add(t2);
    }
    const trimGeoV = new THREE.BoxGeometry(0.06, 0.06, ROOM);
    for (const x of [-ROOM / 2 + 0.05, ROOM / 2 - 0.05]) {
      const t = new THREE.Mesh(trimGeoV, trimMat);
      t.position.set(x, 0.4, 0);
      scene.add(t);
      const t2 = new THREE.Mesh(trimGeoV, trimMat);
      t2.position.set(x, HROOM - 0.4, 0);
      scene.add(t2);
    }

    // Quote plaques around the walls.
    const plaqueGeo = new THREE.PlaneGeometry(4.4, 2.2);
    const placePlaque = (
      tex: THREE.CanvasTexture,
      x: number,
      y: number,
      z: number,
      ry: number,
    ) => {
      const m = new THREE.Mesh(
        plaqueGeo,
        new THREE.MeshBasicMaterial({ map: tex }),
      );
      m.position.set(x, y, z);
      m.rotation.y = ry;
      scene.add(m);
    };
    QUOTES.forEach((q, i) => {
      const tex = makeTextTexture([`"${q.text}"`, `##— ${q.author}`], {
        titleSize: 52,
        bodySize: 40,
        accent: i % 2 ? "#e879f9" : "#22d3ee",
      });
      // Distribute: 2 on north, 2 on south, 1 each on east/west.
      if (i < 2) {
        placePlaque(tex, -3.5 + i * 7, 3, -ROOM / 2 + 0.06, 0);
      } else if (i < 4) {
        placePlaque(tex, -3.5 + (i - 2) * 7, 3, ROOM / 2 - 0.06, Math.PI);
      } else if (i === 4) {
        placePlaque(tex, -ROOM / 2 + 0.06, 3, 0, Math.PI / 2);
      } else {
        placePlaque(tex, ROOM / 2 - 0.06, 3, 0, -Math.PI / 2);
      }
    });

    // Rank pillars in the center — 5 glowing monoliths.
    const billboards: THREE.Mesh[] = [];
    const rankColors = [0x4ade80, 0x22d3ee, 0xa78bfa, 0xe879f9, 0xfbbf24];
    RANKS.forEach((r, i) => {
      const isCurrent = i === rankIndex;
      const geo = new THREE.BoxGeometry(1.1, isCurrent ? 3.4 : 2.6, 1.1);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x151540,
        emissive: rankColors[i],
        emissiveIntensity: isCurrent ? 0.9 : 0.25,
        roughness: 0.3,
        metalness: 0.7,
      });
      const pillar = new THREE.Mesh(geo, mat);
      const angle = (i / RANKS.length) * Math.PI * 2 - Math.PI / 2;
      pillar.position.set(Math.cos(angle) * 3.2, (isCurrent ? 3.4 : 2.6) / 2, Math.sin(angle) * 3.2);
      scene.add(pillar);

      // Floating label.
      const labelTex = makeTextTexture(
        [`##${r.name}`, `${i + 1} / 5${isCurrent ? " — YOU" : ""}`],
        { w: 512, h: 256, titleSize: 64, bodySize: 40, accent: "#ffffff" },
      );
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 0.9),
        new THREE.MeshBasicMaterial({ map: labelTex, transparent: true }),
      );
      label.position.set(
        Math.cos(angle) * 3.2,
        (isCurrent ? 3.4 : 2.6) + 0.9,
        Math.sin(angle) * 3.2,
      );
      scene.add(label);
      // Store for billboarding.
      billboards.push(label);
    });

    // Central Pillar of Becoming — tall glowing column.
    const centralGeo = new THREE.CylinderGeometry(0.5, 0.7, 5, 12);
    const centralMat = new THREE.MeshStandardMaterial({
      color: 0x222266,
      emissive: 0x8866ff,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.8,
    });
    const central = new THREE.Mesh(centralGeo, centralMat);
    central.position.set(0, 2.5, 0);
    scene.add(central);

    // Starfield particles.
    const starGeo = new THREE.BufferGeometry();
    const starCount = 400;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xaaccff, size: 0.06 }),
    );
    scene.add(stars);

    // Drag-to-look controls.
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let yaw = 0;
    let pitch = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw -= (e.clientX - lastX) * 0.005;
      pitch -= (e.clientY - lastY) * 0.003;
      pitch = Math.max(-0.6, Math.min(0.6, pitch));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => (dragging = false);
    const el = renderer.domElement;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      // Gentle idle sway + pulsing glow.
      central.rotation.y = t * 0.3;
      (central.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.6 + Math.sin(t * 2) * 0.2;
      stars.rotation.y = t * 0.01;
      // Camera look direction from yaw/pitch, positioned at room center-ish.
      camera.position.set(0, 2.2, 5.5);
      const dir = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch),
      );
      camera.lookAt(camera.position.clone().add(dir));
      // Billboard the rank labels.
      for (const b of billboards) b.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = Math.min(window.innerHeight * 0.7, 600);
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
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [unlocked]);

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8 text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setScreen("home")}
          className="gap-1"
        >
          <ArrowLeft className="size-4" /> Back to the World
        </Button>
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-accent-soft text-accent">
          <Lock className="size-10" />
        </div>
        <h1 className="font-display text-2xl font-bold">The Hall of Becoming</h1>
        <p className="text-muted">
          This sacred hall opens to those who reach the{" "}
          <span className="font-semibold text-ink">Sprout</span> rank. Keep
          doing chores, saving, and creating — you're on your way.
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

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setScreen("home")}
        className="gap-1"
      >
        <ArrowLeft className="size-4" /> Back to the World
      </Button>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          A sacred hall of the Society
        </p>
        <h1 className="font-display text-3xl font-bold">The Hall of Becoming</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Drag to look around. The greats watch over your becoming.
        </p>
      </div>
      <div
        ref={mountRef}
        className="overflow-hidden rounded-2xl border border-accent/20"
        style={{ minHeight: 400 }}
      />
      <p className="text-center text-xs text-muted">
        Your rank: <span className="font-semibold text-ink">{rank.name}</span> —{" "}
        {rank.tagline}
      </p>
    </div>
  );
}
