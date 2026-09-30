import type * as maplibregl from "maplibre-gl";

// VS-12 T12: weather motion on the map, CSS-free and dependency-free.
//  - fadeInUsdm: the Drought Monitor layer fades in by category, D0 first to
//    D4 last, 120 ms apart.
//  - startWeatherMotion: falling rain inside rain-signal counties and a heat
//    shimmer inside heat-signal counties, on a 2D canvas clipped to each
//    county outline. At most 60 fps, paused while the map is off screen or the
//    tab is hidden, and dropped entirely if drawing costs over ~20 ms a frame.
// Both do nothing under prefers-reduced-motion.

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function fadeInUsdm(map: maplibregl.Map, target = 0.35): void {
  if (reducedMotion() || !map.getLayer("usdm-fill")) return;
  const t0 = performance.now();
  const total = 4 * 120 + 400;
  map.setPaintProperty("usdm-fill", "fill-opacity", 0);
  const step = (now: number) => {
    if (!map.getLayer("usdm-fill")) return;
    const o = [0, 1, 2, 3, 4].map((i) => Math.max(0, Math.min(1, (now - t0 - i * 120) / 400)) * target);
    if (now - t0 >= total) {
      map.setPaintProperty("usdm-fill", "fill-opacity", target);
      return;
    }
    map.setPaintProperty("usdm-fill", "fill-opacity", ["match", ["get", "DM"], 0, o[0], 1, o[1], 2, o[2], 3, o[3], 4, o[4], target] as never);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export type MotionArea = { kind: "rain" | "heat"; rings: [number, number][][] };

export type MotionController = { stop: () => void; setEnabled: (on: boolean) => void; stats: () => { avgMs: number; dropped: boolean } };

type Drop = { u: number; v: number; speed: number };

export function startWeatherMotion(map: maplibregl.Map, areas: MotionArea[]): MotionController | null {
  if (reducedMotion() || areas.length === 0) return null;
  const host = map.getCanvasContainer();
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;";
  host.insertBefore(canvas, map.getCanvas().nextSibling);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return null;
  }

  const drops: Drop[][] = areas.map((a) =>
    a.kind === "rain" ? Array.from({ length: 42 }, () => ({ u: Math.random(), v: Math.random(), speed: 0.00045 + Math.random() * 0.00035 })) : [],
  );

  let raf = 0;
  let last = 0;
  let enabled = true;
  let onScreen = true;
  let dropped = false;
  let slow = 0;
  let costSum = 0;
  let costN = 0;

  const size = () => {
    const w = map.getCanvas().clientWidth;
    const h = map.getCanvas().clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  };

  const observer = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
  observer.observe(host);

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!enabled || !onScreen || document.hidden || dropped) return;
    if (now - last < 16) return; // at most ~60 fps
    last = now;
    const start = performance.now();
    const { w, h } = size();
    ctx.clearRect(0, 0, w, h);

    areas.forEach((a, i) => {
      const path = new Path2D();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const ring of a.rings) {
        ring.forEach(([lng, lat], k) => {
          const p = map.project([lng, lat]);
          if (k === 0) path.moveTo(p.x, p.y);
          else path.lineTo(p.x, p.y);
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        path.closePath();
      }
      if (maxX < 0 || maxY < 0 || minX > w || minY > h) return; // off the visible map
      const bw = maxX - minX;
      const bh = maxY - minY;
      ctx.save();
      ctx.clip(path);
      if (a.kind === "rain") {
        ctx.strokeStyle = "rgba(42, 111, 181, 0.55)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (const d of drops[i]) {
          const x = minX + d.u * bw;
          const y = minY + ((d.v + now * d.speed) % 1) * (bh + 12) - 6;
          ctx.moveTo(x, y);
          ctx.lineTo(x - 2, y + 8);
        }
        ctx.stroke();
      } else {
        // Heat shimmer: faint wavy bands rising through the county.
        ctx.fillStyle = "rgba(245, 90, 0, 0.05)";
        ctx.fillRect(minX, minY, bw, bh);
        ctx.strokeStyle = "rgba(245, 90, 0, 0.2)";
        ctx.lineWidth = 2.5;
        const bands = 5;
        for (let b = 0; b < bands; b++) {
          const y0 = maxY - (((b / bands) + now * 0.00007) % 1) * bh;
          ctx.beginPath();
          for (let x = minX; x <= maxX; x += 6) {
            const y = y0 + Math.sin(x / 14 + now / 420 + b) * 2.2;
            if (x === minX) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    const cost = performance.now() - start;
    costSum += cost;
    costN++;
    slow = cost > 20 ? slow + 1 : 0;
    if (slow >= 10) {
      // Too slow on this machine: drop the particles, keep everything else.
      dropped = true;
      ctx.clearRect(0, 0, w, h);
    }
  };
  raf = requestAnimationFrame(frame);

  return {
    stop: () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.remove();
    },
    setEnabled: (on: boolean) => {
      enabled = on;
      if (!on) ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    stats: () => ({ avgMs: costN ? costSum / costN : 0, dropped }),
  };
}
