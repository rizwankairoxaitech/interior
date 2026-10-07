import { useEffect, useEffectEvent, useRef } from 'react';
import { createFrameLoader } from '../utils/frameLoader.js';

const MAX_PIXEL_RATIO = 2;
const BAND_FADE = 0.14; // share of the band height blended into the background
const BLEND_STEPS = 32; // in-between images per frame step when cross-fading

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Where to draw a frame inside a cssWidth × cssHeight viewport, in CSS px.
 *
 * Landscape and mildly portrait viewports get a plain "cover" fit (crop, never
 * stretch). On tall portrait screens a cover fit would show only a sliver of the
 * room, so zoom is capped to keep at least `minVisibleWidth` of the frame width
 * on screen. The frame then sits in a horizontal band at `bandAnchor` and the
 * rest of the viewport shows the section background.
 */
export function computeFrameRect(
  cssWidth,
  cssHeight,
  frameWidth,
  frameHeight,
  { minVisibleWidth = 0.45, focusX = 0.5, focusY = 0.5, bandAnchor = 0.4 } = {},
) {
  const cover = Math.max(cssWidth / frameWidth, cssHeight / frameHeight);
  const contain = Math.min(cssWidth / frameWidth, cssHeight / frameHeight);
  const scale = Math.max(contain, Math.min(cover, cssWidth / (frameWidth * minVisibleWidth)));
  const w = frameWidth * scale;
  const h = frameHeight * scale;

  const x = clamp(cssWidth / 2 - w * focusX, cssWidth - w, 0);
  const banded = h < cssHeight - 1;
  const y = banded
    ? clamp(cssHeight * bandAnchor - h / 2, 0, cssHeight - h)
    : clamp(cssHeight / 2 - h * focusY, cssHeight - h, 0);

  return { x, y, w, h, scale, banded };
}

const transparentOf = (color) =>
  color.replace(/rgba?\(([^)]+)\)/, (_, inner) => `rgba(${inner.split(',').slice(0, 3).join(',')}, 0)`);

/**
 * Scroll-driven image-sequence renderer.
 *
 * page scroll → eased scroll position → [intro phase] → frame position → canvas
 *
 * With `introFraction` > 0, the first part of the section's scroll drives an
 * intro (reported through onIntroProgress) while frame 1 holds; the frames
 * play over the rest. Both are derived from one eased value, so they never drift.
 *
 * Everything that runs per frame lives in closures and refs: no React state is
 * touched during scrolling. The callbacks run inside requestAnimationFrame, so
 * use them for direct DOM writes (class toggles, CSS variables), not setState.
 *
 * @returns {{ sectionRef, viewportRef, canvasRef }} attach to the tall section,
 *          its sticky viewport and the canvas inside it.
 */
export function useScrollFrameSequence({
  urls,
  frameWidth = 1920,
  frameHeight = 1080,
  mode = 'scroll', // 'scroll' | 'static' (static = reduced motion: one frame, no scrubbing)
  staticFrame = urls.length - 1,
  smoothing = 0.12, // seconds; time constant of the easing toward the scroll position
  crossfade = true, // blend neighbouring frames by the fractional position: no visible frame steps
  minVisibleWidth,
  focusX,
  focusY,
  bandAnchor,
  introFraction = 0, // share of the section's height scrolled through before frames start
  onProgress, // (progress 0..1, frameIndex) — fired when scroll progress changes
  onIntroProgress, // (progress 0..1) — eased; fired when it changes (only with introFraction)
  onLoadProgress, // (ratio 0..1) — readiness of the initial frame set
  onLayout, // ({ banded, imageTop, imageBottom, imageLeft, imageWidth, imageHeight, width, height }) — fired on resize
}) {
  const sectionRef = useRef(null);
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);

  const reportProgress = useEffectEvent((progress, frame) => onProgress?.(progress, frame));
  const reportLoad = useEffectEvent((ratio) => onLoadProgress?.(ratio));
  const reportLayout = useEffectEvent((layout) => onLayout?.(layout));
  const reportIntro = useEffectEvent((progress) => onIntroProgress?.(progress));

  useEffect(() => {
    const section = sectionRef.current;
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!section || !viewport || !canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: false });
    const count = urls.length;
    const isStatic = mode === 'static';
    const fitOptions = { minVisibleWidth, focusX, focusY, bandAnchor };

    let rect = null; // where the frame is drawn, CSS px
    let pixelRatio = 1;
    let sizeKey = '';
    let background = 'rgb(0, 0, 0)';
    let fadeTop = null;
    let fadeBottom = null;

    let target = isStatic ? staticFrame : 0; // frame position from scroll (fractional)
    let current = isStatic ? staticFrame : -1; // eased frame position actually shown
    let scrollTarget = 0; // px scrolled into the section
    let scrollCurrent = -1; // eased px, drives both the intro and the frames
    let lastIntro = -1;
    let direction = 1;
    let drawnSource = -1;
    let drawnKey = '';
    let dirty = true;
    let rafId = 0;
    let lastTime = 0;
    let wasVisible = false;
    let lastProgress = -1;

    const loader = createFrameLoader({
      urls,
      only: isStatic ? [staticFrame] : undefined,
      onLoad(index, ok) {
        reportLoad(loader.readyProgress());
        if (!ok) return;
        // Redraw if the new frame is a blend partner or closer to the playhead than what's shown.
        const position = current < 0 ? target : current;
        const wanted = Math.round(position);
        if (
          drawnSource < 0 ||
          Math.abs(index - position) < 1 ||
          Math.abs(index - wanted) < Math.abs(drawnSource - wanted)
        ) {
          dirty = true;
          schedule();
        }
      },
    });

    function draw() {
      if (!rect) return;
      const position = clamp(current < 0 ? target : current, 0, count - 1);

      // Cross-fade: frame `base` underneath, the next frame on top at the fractional
      // remainder, quantised so the settling tail of the easing doesn't repaint needlessly.
      let base = Math.floor(position);
      let mix = crossfade ? Math.round((position - base) * BLEND_STEPS) / BLEND_STEPS : 0;
      if (!crossfade) base = Math.round(position);
      if (mix >= 1) {
        base = Math.min(base + 1, count - 1);
        mix = 0;
      }
      const source = loader.get(base) ? base : loader.nearestLoaded(base);
      // Blend only between two real neighbours; if either is still loading, show one frame.
      const overlay = mix > 0 && source === base ? loader.get(base + 1) : null;
      const key = overlay ? `${source}+${mix}` : `${source}`;
      if (!dirty && key === drawnKey) return;

      const img = source >= 0 ? loader.get(source) : null;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!img || rect.banded) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (img) {
        const x = Math.round(rect.x * pixelRatio);
        const y = Math.round(rect.y * pixelRatio);
        const w = Math.round(rect.w * pixelRatio);
        const h = Math.round(rect.h * pixelRatio);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, x, y, w, h);
        if (overlay) {
          ctx.globalAlpha = mix;
          ctx.drawImage(overlay, x, y, w, h);
          ctx.globalAlpha = 1;
        }
        if (rect.banded) {
          const fade = Math.round(h * BAND_FADE);
          ctx.fillStyle = fadeTop;
          ctx.fillRect(x, y, w, fade);
          ctx.fillStyle = fadeBottom;
          ctx.fillRect(x, y + h - fade, w, fade);
        }
      }
      drawnSource = source;
      drawnKey = key;
      dirty = false;
    }

    function resize() {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (!width || !height) return;
      const nextRect = computeFrameRect(width, height, frameWidth, frameHeight, fitOptions);
      // Never allocate more canvas pixels than the source frame can actually fill.
      const nextRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO, Math.max(1, 1 / nextRect.scale));
      const key = `${width}x${height}@${nextRatio}`;
      if (key === sizeKey) return;
      sizeKey = key;
      rect = nextRect;
      pixelRatio = nextRatio;

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);

      background = getComputedStyle(viewport).backgroundColor || background;
      if (rect.banded) {
        const top = rect.y * pixelRatio;
        const bottom = (rect.y + rect.h) * pixelRatio;
        const fade = rect.h * pixelRatio * BAND_FADE;
        const clear = transparentOf(background);
        fadeTop = ctx.createLinearGradient(0, top, 0, top + fade);
        fadeTop.addColorStop(0, background);
        fadeTop.addColorStop(1, clear);
        fadeBottom = ctx.createLinearGradient(0, bottom - fade, 0, bottom);
        fadeBottom.addColorStop(0, clear);
        fadeBottom.addColorStop(1, background);
      }

      reportLayout({
        banded: rect.banded,
        imageTop: rect.y,
        imageBottom: rect.y + rect.h,
        imageLeft: rect.x,
        imageWidth: rect.w,
        imageHeight: rect.h,
        width,
        height,
      });
      dirty = true;
      draw(); // synchronous: resizing a canvas clears it, so repaint before the browser does
    }

    function tick(now) {
      rafId = 0;
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 1 / 60;
      lastTime = now;

      const box = section.getBoundingClientRect();
      const scrollable = Math.max(0, box.height - viewport.clientHeight);
      const introSpan = Math.min(scrollable, box.height * introFraction);
      const frameSpan = scrollable - introSpan;
      const frameProgressAt = (pos) => (frameSpan > 0 ? clamp((pos - introSpan) / frameSpan, 0, 1) : 0);

      scrollTarget = clamp(-box.top, 0, scrollable);
      const visible = box.bottom > 0 && box.top < window.innerHeight;
      if (scrollCurrent < 0 || !visible || !wasVisible) {
        scrollCurrent = scrollTarget; // first paint, off-screen or just arrived: no easing
      } else {
        scrollCurrent += (scrollTarget - scrollCurrent) * (1 - Math.exp(-dt / smoothing));
        if (Math.abs(scrollTarget - scrollCurrent) < 0.5) scrollCurrent = scrollTarget;
      }
      wasVisible = visible;

      // Text follows the scroll position directly; the image follows the eased one.
      const progress = frameProgressAt(scrollTarget);
      const nextTarget = progress * (count - 1);
      if (nextTarget !== target) direction = nextTarget > target ? 1 : -1;
      target = nextTarget;
      current = frameProgressAt(scrollCurrent) * (count - 1);

      if (introSpan > 0) {
        const intro = clamp(scrollCurrent / introSpan, 0, 1);
        if (intro !== lastIntro) {
          lastIntro = intro;
          reportIntro(intro);
        }
      }

      if (visible) loader.unlock(); // user reached the section before the page went idle
      // Prioritise the frame actually being painted. On large scroll jumps the
      // eased playhead travels through intermediate frames, so preloading around
      // target would leave the visible sequence behind.
      loader.setFocus(Math.round(current), direction);
      if (visible) draw();

      const visibleProgress = frameProgressAt(scrollCurrent);
      if (visibleProgress !== lastProgress) {
        lastProgress = visibleProgress;
        reportProgress(visibleProgress, Math.round(current));
      }

      if (scrollCurrent !== scrollTarget) requestTick();
      else lastTime = 0;
    }

    function requestTick() {
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function schedule() {
      if (isStatic) draw();
      else requestTick();
    }

    // Resize: element size (incl. mobile URL-bar changes) and device-pixel-ratio changes.
    const resizeObserver = new ResizeObserver(() => {
      resize();
      schedule();
    });
    resizeObserver.observe(viewport);

    // Full repaint, even if the size is unchanged.
    const repaint = () => {
      sizeKey = '';
      resize();
    };

    // Browsers can drop the canvas backing store (GPU reset, memory pressure,
    // background tabs) and hand it back blank, so paint it again.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') repaint();
    };
    canvas.addEventListener('contextrestored', repaint);
    document.addEventListener('visibilitychange', onVisibilityChange);

    let ratioQuery = null;
    const onRatioChange = () => {
      repaint();
      watchPixelRatio();
    };
    function watchPixelRatio() {
      ratioQuery?.removeEventListener('change', onRatioChange);
      ratioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      ratioQuery.addEventListener('change', onRatioChange);
    }
    watchPixelRatio();

    // Loading: the first frames now; the rest once the page itself has loaded,
    // so the sequence never competes with the site's critical assets.
    let cancelUnlock = () => {};
    const unlockWhenIdle = () => {
      if (window.requestIdleCallback) {
        const id = window.requestIdleCallback(() => loader.unlock(), { timeout: 2000 });
        cancelUnlock = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(() => loader.unlock(), 300);
        cancelUnlock = () => window.clearTimeout(id);
      }
    };

    resize();
    loader.start();
    reportLoad(loader.readyProgress());

    if (isStatic) {
      loader.unlock();
    } else {
      if (document.readyState === 'complete') unlockWhenIdle();
      else window.addEventListener('load', unlockWhenIdle, { once: true });
      window.addEventListener('scroll', requestTick, { passive: true });
      requestTick();
    }

    return () => {
      cancelAnimationFrame(rafId);
      cancelUnlock();
      window.removeEventListener('load', unlockWhenIdle);
      window.removeEventListener('scroll', requestTick);
      canvas.removeEventListener('contextrestored', repaint);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      ratioQuery?.removeEventListener('change', onRatioChange);
      resizeObserver.disconnect();
      loader.destroy();
    };
  }, [urls, mode, staticFrame, frameWidth, frameHeight, smoothing, minVisibleWidth, focusX, focusY, bandAnchor, introFraction, crossfade]);

  return { sectionRef, viewportRef, canvasRef };
}
