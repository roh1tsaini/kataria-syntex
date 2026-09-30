/**
 * WebGL2 fluid gradient behind the pre-auth surfaces — the living layer of
 * the entry wash. Domain-warped fbm noise (iq-style) flows through the
 * periwinkle palette: light mode is a pale sky with a luminous core the
 * content sits in; dark mode is a deep indigo night with a dim glow. The
 * color ramps live as uniforms so the shader never forks per theme.
 *
 * Budget guards: renders into a low-resolution backing store scaled up by
 * CSS (fluid hides pixels), pauses on hidden tabs, runs zero frames under
 * prefers-reduced-motion (a single still frame is drawn once), and restores
 * transparently after context loss. Any failure — no WebGL2, shader compile,
 * lost context twice — dissolves the canvas and leaves the CSS sky beneath
 * untouched. Decorative.
 */
import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

const VERT = `#version 300 es
in vec2 p;
void main() {
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
// Light ramp: core -> mid sky -> deep edge
uniform vec3 uCore;
uniform vec3 uMid;
uniform vec3 uEdge;
out vec4 outColor;

// Value noise + fbm; cheaper than simplex and plenty for clouds
float hash(vec2 q) {
  vec3 p3 = fract(vec3(q.xyx) * 443.8975);
  p3 += dot(p3, p3.yzx + 19.19);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 q) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(q);
    q = rot * q * 2.03 + vec2(11.7, 5.3);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 sc = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);

  // Slow clock: the whole field breathes on one period
  float t = uTime * 0.055;

  // Domain warp: fbm field bends the sample coordinates, twice —
  // this is what makes it read as fluid instead of layered blobs
  vec2 w1 = vec2(fbm(sc * 1.6 + vec2(0.0, t)), fbm(sc * 1.6 + vec2(5.2, -t)));
  vec2 w2 = vec2(
    fbm(sc * 2.2 + 3.1 * w1 + vec2(1.7, 9.2) + 0.35 * t),
    fbm(sc * 2.2 + 3.1 * w1 + vec2(8.3, 2.8) - 0.28 * t)
  );
  float f = fbm(sc * 2.4 + 2.6 * w2);

  // Luminous core where content sits (matches the CSS sky's 50%/34%)
  vec2 cc = (vec2(0.5 * uRes.x, 0.34 * uRes.y) - 0.5 * uRes) / min(uRes.x, uRes.y);
  float core = exp(-3.4 * dot(sc - cc, sc - cc));

  // clouds: warped field raised into soft banks
  float clouds = smoothstep(0.32, 0.78, f);

  vec3 col = mix(uMid, uEdge, smoothstep(-0.15, 0.85, f + 0.35 * length(sc)));
  col = mix(col, uCore, core * (0.55 + 0.45 * clouds));
  // pale cloud veil over the mid tones, never over the core
  col = mix(col, mix(uCore, uMid, 0.35), clouds * (1.0 - core) * 0.45);
  // vignette kiss so the frame edges feel deep
  col = mix(col, uEdge, 0.22 * smoothstep(0.35, 1.15, length(sc)));

  outColor = vec4(col, 1.0);
}`;

/** oklch → gamma-corrected sRGB, standard Ottosson math — deterministic,
 * no dependence on getComputedStyle's serialization. */
function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const gam = (v: number) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return [
    gam(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
    gam(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
    gam(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S),
  ];
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function EntryFluid() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Sizing: low internal resolution, CSS scales it up. Fluid hides pixels.
    const scale = Math.min(0.5, 720 / Math.max(window.innerWidth, 1));
    const w = Math.max(2, Math.round(window.innerWidth * scale));
    const h = Math.max(2, Math.round(window.innerHeight * scale));

    let gl: WebGL2RenderingContext | null = null;
    const fail = (stage: string) => {
      canvas.dataset.fluidError = stage;
    };
    try {
      gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      });
    } catch {
      gl = null;
    }
    if (!gl) {
      fail("no-webgl2");
      return;
    }

    let raf = 0;
    let lost = false;
    const start = performance.now();

    // Uniform locations live outside init() because draw/applyTheme close
    // over them; a context restore invalidates them, so init() rebuilds
    // the whole set.
    let uTime: WebGLUniformLocation | null = null;
    let ramp: {
      core: WebGLUniformLocation | null;
      mid: WebGLUniformLocation | null;
      edge: WebGLUniformLocation | null;
    } | null = null;

    const draw = (now: number) => {
      if (!gl) return;
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    /** Ramp uniforms read fresh from the theme class so the canvas tracks
     * the CSS sky it sits behind. Light: core → mid sky → deep periwinkle
     * edge; dark: deep indigo night with a dim glow. */
    const applyTheme = () => {
      if (!gl || !ramp) return;
      const dark = document.documentElement.classList.contains("dark");
      const [core, mid, edge] = dark
        ? [
            oklchToRgb(0.45, 0.085, 288),
            oklchToRgb(0.27, 0.085, 284),
            oklchToRgb(0.17, 0.05, 280),
          ]
        : [
            oklchToRgb(0.99, 0.012, 290),
            oklchToRgb(0.87, 0.055, 286),
            oklchToRgb(0.72, 0.115, 282),
          ];
      gl.uniform3f(ramp.core, core[0], core[1], core[2]);
      gl.uniform3f(ramp.mid, mid[0], mid[1], mid[2]);
      gl.uniform3f(ramp.edge, edge[0], edge[1], edge[2]);
    };

    /** Builds/links the program + buffer and applies the static uniforms.
     * Returns false (fail() already called) on any failure. */
    const init = (): boolean => {
      if (!gl) return false;
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      if (!vs) {
        fail("vert-compile");
        return false;
      }
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!fs) {
        fail("frag-compile");
        return false;
      }
      const prog = gl.createProgram();
      if (!prog) {
        fail("program");
        return false;
      }
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        fail("link");
        return false;
      }
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      uTime = gl.getUniformLocation(prog, "uTime");
      ramp = {
        core: gl.getUniformLocation(prog, "uCore"),
        mid: gl.getUniformLocation(prog, "uMid"),
        edge: gl.getUniformLocation(prog, "uEdge"),
      };
      gl.uniform2f(gl.getUniformLocation(prog, "uRes"), w, h);
      applyTheme();

      canvas.width = w;
      canvas.height = h;
      // Resizing the canvas does NOT update the GL viewport — the default one
      // is the JSX 2×2 size and only that corner would ever rasterize.
      gl.viewport(0, 0, w, h);
      return true;
    };

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      cancelAnimationFrame(raf);
    };
    const onRestored = () => {
      lost = false;
      // The restored context ships no program, buffers or locations —
      // rebuild everything before drawing again.
      if (!init()) return;
      if (reduceMotion) draw(performance.now());
      else if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    // The ramp colors are uniforms, so a theme flip mid-mount re-applies
    // them (initTheme follows the system theme without a user toggle).
    // Reduced motion repaints its single still frame in the new palette.
    const themeObs = new MutationObserver(() => {
      if (lost) return;
      applyTheme();
      if (reduceMotion) draw(performance.now());
    });

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !lost && !reduceMotion) {
        raf = requestAnimationFrame(loop);
      }
    };

    if (!init()) return;

    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    document.addEventListener("visibilitychange", onVisibility);

    if (reduceMotion) {
      draw(performance.now());
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      themeObs.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      // No loseContext here: StrictMode remounts this effect on the SAME
      // canvas, and a lost context can never be re-gotten — the element
      // (and its GL resources) is reclaimed with the component instead.
    };
  }, [reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="entry-fluid"
      width={2}
      height={2}
      aria-hidden
    />
  );
}
