import { memo, useEffect, useRef } from 'react';

/**
 * AuroraBackground
 * High-performance, parametric multi-line vector wave ribbon background.
 * Matches the elegant, flowing cyan/teal soundwave and silk-ribbon aesthetic
 * with smooth intertwining ribbons, crisp parallel guilloche lines, and
 * delicate fanned waves.
 * 
 * - Rendered on HTML5 Canvas 2D with sub-pixel DPR scaling
 * - Multi-frequency 3D ribbon twists and parabolic line curvature
 * - Rich cyan / teal / turquoise gradient styling
 * - Smooth continuous breathing animation with subtle mouse parallax
 * - Full support for Dark Mode, reduced-motion, and tab visibility pause
 */

interface ControlPoint {
  u: number;
  val: number;
  amp?: number;
  speed?: number;
  phase?: number;
}

/**
 * Evaluates Catmull-Rom spline interpolation through control points.
 * Ensures C1 continuous, buttery-smooth curves without oscillation or abrupt kinks.
 */
function evaluateSpline(pts: ControlPoint[], u: number, t: number = 0): number {
  if (pts.length === 0) return 0;
  if (pts.length === 1) return pts[0].val;

  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].u < u) {
    i++;
  }

  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[Math.min(pts.length - 1, i + 1)];
  const p3 = pts[Math.min(pts.length - 1, i + 2)];

  const val0 = p0.val + (p0.amp ? p0.amp * Math.sin(t * (p0.speed ?? 1) + (p0.phase ?? 0)) : 0);
  const val1 = p1.val + (p1.amp ? p1.amp * Math.sin(t * (p1.speed ?? 1) + (p1.phase ?? 0)) : 0);
  const val2 = p2.val + (p2.amp ? p2.amp * Math.sin(t * (p2.speed ?? 1) + (p2.phase ?? 0)) : 0);
  const val3 = p3.val + (p3.amp ? p3.amp * Math.sin(t * (p3.speed ?? 1) + (p3.phase ?? 0)) : 0);

  const span = Math.max(0.0001, p2.u - p1.u);
  const s = Math.max(0, Math.min(1, (u - p1.u) / span));
  const s2 = s * s;
  const s3 = s2 * s;

  return 0.5 * (
    (2 * val1) +
    (-val0 + val2) * s +
    (2 * val0 - 5 * val1 + 4 * val2 - val3) * s2 +
    (-val0 + 3 * val1 - 3 * val2 + val3) * s3
  );
}

// ---------------------------------------------------------------------------
// Wave Ribbon Geometric Configurations
// ---------------------------------------------------------------------------

// Primary undulating wave ribbon (Main center-right arch and twist)
const RIBBON_1_SPINE: ControlPoint[] = [
  { u: -0.15, val: 0.58, amp: 0.02, speed: 0.4, phase: 0.2 },
  { u: 0.00,  val: 0.60, amp: 0.025, speed: 0.45, phase: 0.6 },
  { u: 0.18,  val: 0.68, amp: 0.03, speed: 0.55, phase: 1.3 }, // gentle dip
  { u: 0.36,  val: 0.54, amp: 0.035, speed: 0.5, phase: 2.2 }, // rising slope
  { u: 0.54,  val: 0.44, amp: 0.04, speed: 0.65, phase: 3.1 }, // high crest
  { u: 0.77,  val: 0.64, amp: 0.035, speed: 0.55, phase: 4.2 }, // trough
  { u: 0.92,  val: 0.52, amp: 0.03, speed: 0.45, phase: 5.3 }, // sweep up
  { u: 1.05,  val: 0.44, amp: 0.025, speed: 0.4, phase: 0.9 }, // right margin
  { u: 1.18,  val: 0.38, amp: 0.02, speed: 0.4, phase: 1.6 }
];

const RIBBON_1_TWIST: ControlPoint[] = [
  { u: -0.15, val: 0.1 },
  { u: 0.00,  val: 0.25 },
  { u: 0.22,  val: 0.75 },
  { u: 0.43,  val: Math.PI / 2, amp: 0.15, speed: 0.35, phase: 1.0 }, // twist 1 (pinch)
  { u: 0.65,  val: Math.PI,     amp: 0.12, speed: 0.3, phase: 2.5 },  // inverted
  { u: 0.88,  val: (3 * Math.PI) / 2, amp: 0.15, speed: 0.4, phase: 4.0 }, // twist 2 (pinch)
  { u: 1.05,  val: 2 * Math.PI - 0.2 },
  { u: 1.18,  val: 2 * Math.PI }
];

const RIBBON_1_WIDTH: ControlPoint[] = [
  { u: -0.15, val: 0.8 },
  { u: 0.00,  val: 0.85 },
  { u: 0.20,  val: 0.72 },
  { u: 0.43,  val: 0.25 }, // pinch waist at twist
  { u: 0.60,  val: 1.18 }, // wide open crest
  { u: 0.77,  val: 0.92 },
  { u: 0.88,  val: 0.28 }, // pinch waist at twist
  { u: 1.05,  val: 1.25 }, // fan out on right
  { u: 1.18,  val: 1.35 }
];

// Secondary intertwined wave ribbon (Loops underneath on left and crosses)
const RIBBON_2_SPINE: ControlPoint[] = [
  { u: -0.15, val: 0.66, amp: 0.02, speed: 0.4, phase: 1.1 },
  { u: 0.00,  val: 0.69, amp: 0.025, speed: 0.45, phase: 1.7 },
  { u: 0.22,  val: 0.77, amp: 0.035, speed: 0.6, phase: 2.7 }, // lower loop
  { u: 0.40,  val: 0.63, amp: 0.03, speed: 0.5, phase: 3.7 }, // crossing rise
  { u: 0.62,  val: 0.73, amp: 0.035, speed: 0.65, phase: 4.9 }, // dip
  { u: 0.82,  val: 0.67, amp: 0.03, speed: 0.5, phase: 0.5 }, // rise
  { u: 1.00,  val: 0.73, amp: 0.025, speed: 0.4, phase: 1.9 },
  { u: 1.18,  val: 0.76, amp: 0.02, speed: 0.4, phase: 2.3 }
];

const RIBBON_2_TWIST: ControlPoint[] = [
  { u: -0.15, val: 0.3 },
  { u: 0.00,  val: 0.45 },
  { u: 0.25,  val: Math.PI / 2, amp: 0.15, speed: 0.38, phase: 1.5 },
  { u: 0.52,  val: Math.PI,     amp: 0.12, speed: 0.32, phase: 3.0 },
  { u: 0.76,  val: (3 * Math.PI) / 2, amp: 0.15, speed: 0.42, phase: 4.8 },
  { u: 1.05,  val: 2 * Math.PI },
  { u: 1.18,  val: 2 * Math.PI + 0.3 }
];

const RIBBON_2_WIDTH: ControlPoint[] = [
  { u: -0.15, val: 0.75 },
  { u: 0.00,  val: 0.8 },
  { u: 0.25,  val: 0.3 }, // pinch in lower loop
  { u: 0.45,  val: 1.05 },
  { u: 0.65,  val: 0.85 },
  { u: 0.76,  val: 0.32 }, // pinch
  { u: 1.00,  val: 0.95 },
  { u: 1.18,  val: 1.05 }
];

// Tertiary delicate fanning wave ribbon (Upper expansive fan visible in image)
const RIBBON_3_SPINE: ControlPoint[] = [
  { u: -0.15, val: 0.53, amp: 0.02, speed: 0.3, phase: 0.5 },
  { u: 0.00,  val: 0.55, amp: 0.02, speed: 0.35, phase: 1.0 },
  { u: 0.25,  val: 0.60, amp: 0.025, speed: 0.45, phase: 2.1 },
  { u: 0.50,  val: 0.49, amp: 0.03, speed: 0.4, phase: 3.3 },
  { u: 0.75,  val: 0.39, amp: 0.035, speed: 0.55, phase: 4.6 },
  { u: 1.00,  val: 0.28, amp: 0.035, speed: 0.5, phase: 5.6 }, // fanning up on right
  { u: 1.18,  val: 0.20, amp: 0.025, speed: 0.4, phase: 0.3 }
];

const RIBBON_3_TWIST: ControlPoint[] = [
  { u: -0.15, val: 0.1 },
  { u: 0.00,  val: 0.2 },
  { u: 0.35,  val: 0.8 },
  { u: 0.70,  val: 1.6, amp: 0.1, speed: 0.3, phase: 2.0 },
  { u: 1.00,  val: 2.5, amp: 0.15, speed: 0.35, phase: 3.5 },
  { u: 1.18,  val: 3.0 }
];

const RIBBON_3_WIDTH: ControlPoint[] = [
  { u: -0.15, val: 0.6 },
  { u: 0.00,  val: 0.65 },
  { u: 0.30,  val: 0.75 },
  { u: 0.60,  val: 1.1 },
  { u: 0.85,  val: 1.8 }, // expansive fan
  { u: 1.00,  val: 2.4 }, // large fan-out
  { u: 1.18,  val: 2.8 }
];

export const AuroraBackground = memo(function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number | null = null;
    let isComponentMounted = true;
    let startTime = performance.now();

    // Mouse tracking for subtle interactive inertia
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      mouse.targetX = (e.clientX / width) * 2 - 1;
      mouse.targetY = (e.clientY / height) * 2 - 1;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Handle canvas dimensions with Retina DPR
    let width = 0;
    let height = 0;

    const resizeCanvas = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(canvas);

    // Render a single ribbon composed of multiple fine parallel lines
    const drawRibbon = (
      spinePts: ControlPoint[],
      twistPts: ControlPoint[],
      widthPts: ControlPoint[],
      lineCount: number,
      baseWidth: number,
      baseAlpha: number,
      timeSec: number,
      isDark: boolean,
      horizontalTilt: number = 24,
      curlStrength: number = 0.55
    ) => {
      if (width <= 0 || height <= 0) return;

      const steps = Math.min(180, Math.max(100, Math.round(width / 8)));
      const stepU = 1.25 / steps;
      const startU = -0.12;

      // Mouse influence
      const mouseOffsetX = mouse.x * 24;
      const mouseOffsetY = mouse.y * 16;

      // Create rich horizontal gradient matching the reference image palette
      const gradient = ctx.createLinearGradient(0, 0, width, height * 0.35);

      if (isDark) {
        gradient.addColorStop(0.00, 'rgba(34, 211, 238, 1)'); // Electric Cyan
        gradient.addColorStop(0.25, 'rgba(56, 189, 248, 1)'); // Sky Blue
        gradient.addColorStop(0.55, 'rgba(45, 212, 191, 1)'); // Teal Mint
        gradient.addColorStop(0.80, 'rgba(20, 184, 166, 1)'); // Deep Teal
        gradient.addColorStop(1.00, 'rgba(0, 242, 254, 1)');  // Cyan Glow
      } else {
        // Light mode: exquisite deep teal to bright cyan gradient (exact reference match)
        gradient.addColorStop(0.00, 'rgba(0, 153, 168, 1)'); // Deep Cyan Teal
        gradient.addColorStop(0.18, 'rgba(0, 140, 158, 1)'); // Turquoise
        gradient.addColorStop(0.42, 'rgba(2, 132, 199, 1)');  // Ocean Azure
        gradient.addColorStop(0.66, 'rgba(10, 147, 150, 1)'); // Rich Teal
        gradient.addColorStop(0.86, 'rgba(0, 123, 138, 1)'); // Deep Teal Crease
        gradient.addColorStop(1.00, 'rgba(38, 198, 218, 1)'); // Luminous Aqua
      }

      ctx.strokeStyle = gradient;

      // Pre-evaluate spine, twist, and width across all horizontal samples for maximum speed
      const spineYs = new Float32Array(steps + 1);
      const twists = new Float32Array(steps + 1);
      const widths = new Float32Array(steps + 1);
      const uCoords = new Float32Array(steps + 1);

      for (let s = 0; s <= steps; s++) {
        const u = startU + s * stepU;
        uCoords[s] = u;
        spineYs[s] = evaluateSpline(spinePts, u, timeSec) * height;
        twists[s] = evaluateSpline(twistPts, u, timeSec);
        widths[s] = evaluateSpline(widthPts, u, timeSec) * baseWidth;
      }

      // Draw each parallel line in the ribbon
      for (let k = 0; k < lineCount; k++) {
        // Normalized offset across ribbon from -0.5 (top edge) to +0.5 (bottom edge)
        const v = (k / (lineCount - 1)) - 0.5;

        // Density alpha: lines closer to ribbon center have higher alpha,
        // while lines at edges fade softly into background
        const distFromCenter = Math.abs(v * 2);
        const lineAlpha = baseAlpha * (1 - 0.62 * Math.pow(distFromCenter, 1.45));

        ctx.globalAlpha = Math.max(0.04, Math.min(1, lineAlpha));
        ctx.lineWidth = 0.95;

        ctx.beginPath();

        for (let s = 0; s <= steps; s++) {
          const u = uCoords[s];
          const spineY = spineYs[s];
          const theta = twists[s];
          const w = widths[s];

          // 3D Ribbon Transformation:
          // 1. Vertical expansion based on cos(twist)
          const verticalSpread = v * w * Math.cos(theta);

          // 2. Parabolic cross-sectional curvature (depth cylinder effect) based on sin(twist)
          const curlSpread = (0.25 - v * v) * w * Math.sin(theta) * curlStrength;

          // 3. Subtle horizontal shear/tilt
          const horizontalSpread = v * horizontalTilt * Math.sin(theta);

          const px = u * width + horizontalSpread + mouseOffsetX * (1 - distFromCenter * 0.3);
          const py = spineY + verticalSpread + curlSpread + mouseOffsetY * (1 - distFromCenter * 0.3);

          if (s === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }

        ctx.stroke();
      }
    };

    // Render loop
    const render = (currentTime: number) => {
      if (!isComponentMounted) return;

      const elapsed = (currentTime - startTime) * 0.001; // elapsed in seconds
      const isDark = document.documentElement.classList.contains('dark');

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.045;
      mouse.y += (mouse.targetY - mouse.y) * 0.045;

      // Clear previous frame
      ctx.clearRect(0, 0, width, height);

      // Composite mode: screen in dark mode for bioluminescent glow, standard in light mode
      ctx.globalCompositeOperation = isDark ? 'screen' : 'source-over';

      // 1. Tertiary background fanning wave (ethereal airy lines)
      drawRibbon(
        RIBBON_3_SPINE,
        RIBBON_3_TWIST,
        RIBBON_3_WIDTH,
        32,       // lineCount
        85,       // baseWidth
        isDark ? 0.32 : 0.36, // baseAlpha
        elapsed * 0.45,
        isDark,
        28,       // horizontalTilt
        0.4
      );

      // 2. Secondary counter wave (intertwines below and crosses through)
      drawRibbon(
        RIBBON_2_SPINE,
        RIBBON_2_TWIST,
        RIBBON_2_WIDTH,
        40,       // lineCount
        105,      // baseWidth
        isDark ? 0.45 : 0.52, // baseAlpha
        elapsed * 0.55,
        isDark,
        22,
        0.55
      );

      // 3. Primary dominant wave (main arched ribbon with crisp twist crease)
      drawRibbon(
        RIBBON_1_SPINE,
        RIBBON_1_TWIST,
        RIBBON_1_WIDTH,
        48,       // lineCount
        125,      // baseWidth
        isDark ? 0.55 : 0.65, // baseAlpha
        elapsed * 0.5,
        isDark,
        26,
        0.65
      );

      animationFrameId = requestAnimationFrame(render);
    };

    // Accessibility: check reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      // Draw a single static frame without running continuous loop
      render(startTime);
    } else {
      animationFrameId = requestAnimationFrame(render);
    }

    // Visibility change: pause RAF when tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      } else {
        startTime = performance.now();
        if (!prefersReducedMotion && animationFrameId === null) {
          animationFrameId = requestAnimationFrame(render);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Watch for dark mode changes (MutationObserver on <html> class)
    const observer = new MutationObserver(() => {
      if (prefersReducedMotion) {
        render(performance.now());
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      isComponentMounted = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver.disconnect();
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* Base Gradient Canvas: Crisp Soft Cyan Vignette matching the reference style */}
      <div 
        className="absolute inset-0 transition-opacity duration-700 bg-gradient-to-b from-[#d6f5f6] via-[#ffffff] to-[#d2f3f4] dark:from-[#020b12] dark:via-[#051824] dark:to-[#020a10]" 
      />

      {/* Light Mode: Four-corner soft turquoise vignettes with luminous white center glow */}
      <div
        className="absolute inset-0 opacity-100 dark:opacity-0 transition-opacity duration-700"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 65% 55% at 5% 8%, rgba(175, 236, 240, 0.88) 0%, transparent 65%),
            radial-gradient(ellipse 60% 50% at 95% 12%, rgba(195, 242, 245, 0.82) 0%, transparent 60%),
            radial-gradient(ellipse 70% 60% at 0% 95%, rgba(170, 233, 238, 0.85) 0%, transparent 60%),
            radial-gradient(ellipse 65% 55% at 100% 92%, rgba(180, 238, 242, 0.82) 0%, transparent 60%),
            radial-gradient(ellipse 75% 65% at 50% 48%, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.88) 45%, transparent 80%)
          `
        }}
      />

      {/* Dark Mode: Deep bioluminescent ambient cyan-navy glows */}
      <div
        className="absolute inset-0 opacity-0 dark:opacity-100 transition-opacity duration-700"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 65% 50% at 15% 25%, rgba(6, 182, 212, 0.16) 0%, transparent 60%),
            radial-gradient(ellipse 65% 55% at 85% 75%, rgba(20, 184, 166, 0.14) 0%, transparent 60%),
            radial-gradient(ellipse 75% 60% at 50% 50%, rgba(2, 132, 199, 0.12) 0%, transparent 70%)
          `
        }}
      />

      {/* Flowing Parametric Multi-Line Vector Wave Ribbons Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
      />

      {/* Subtle atmospheric vignette for seamless screen edge blending */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 95% 90% at 50% 50%, transparent 65%, rgba(255, 255, 255, 0.12) 100%)'
        }}
      />
    </div>
  );
});

export default AuroraBackground;
