import { useEffect, useImperativeHandle, useRef } from 'react';
import './ScrollIntroMask.css';

const ZOOM_MARGIN = 1.12; // end scale overshoots "stroke fills the screen" by this much
const CARD_FADE_FROM = 0.9; // the card dissolves only at the very end, hiding any slivers
const TINT = 0.34; // darkening of the scene inside the letters at rest (≈5:1 against the card)
const TINT_FADE = [0.2, 0.85]; // ...gone before the card fades, so the reveal is the true image
const META_FADE_TO = 0.12; // tagline and scroll cue are gone by this point
const ENTRANCE_MS = 1100;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Pixel-measure the main stroke of `letter` (the stem, for an "I") on a scratch
 * canvas: returns its width and centre offset from the glyph origin, in em.
 */
function measureStroke(font, letter) {
  const size = 200;
  const scratch = document.createElement('canvas');
  scratch.width = size * 2;
  scratch.height = size * 2;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  ctx.font = font(size);
  const m = ctx.measureText(letter);
  const originX = Math.ceil(m.actualBoundingBoxLeft) + 8;
  const baseline = Math.ceil(m.actualBoundingBoxAscent) + 8;
  ctx.fillText(letter, originX, baseline);

  // Longest run of ink across the middle of the cap height.
  const row = ctx.getImageData(0, Math.round(baseline - m.actualBoundingBoxAscent / 2), scratch.width, 1).data;
  let best = { length: 0, start: 0 };
  let start = -1;
  for (let x = 0; x <= scratch.width; x++) {
    const ink = x < scratch.width && row[x * 4 + 3] > 127;
    if (ink && start < 0) start = x;
    if (!ink && start >= 0) {
      if (x - start > best.length) best = { length: x - start, start };
      start = -1;
    }
  }
  if (!best.length) return null;
  return { width: best.length / size, center: (best.start + best.length / 2 - originX) / size };
}

/**
 * A white card with a word cut out of it, laid over a sticky scene. The scene
 * shows through the letters; `update(progress)` zooms the word until the card
 * dissolves and the scene underneath is fully revealed. `setFrameBand()` centres
 * the word on the scene's image band (portrait layouts), so the zoom opens onto it.
 *
 * The word is drawn on a canvas (destination-out) so the zoom-origin metrics and
 * the rendering come from the same text engine. Font and card colour come from
 * CSS: `.kse-intro__canvas { font-family; font-weight; color }`.
 */
export default function ScrollIntroMask({ ref, word, tagline, cue, focusLetter }) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const tintRef = useRef(null);
  const updateRef = useRef(() => {});
  const relayoutRef = useRef(() => {});
  const bandCenterRef = useRef(null); // vertical centre of the scene's image band, if banded

  useImperativeHandle(
    ref,
    () => ({
      update: (progress) => updateRef.current(progress),
      setFrameBand(top, bottom, banded) {
        const center = banded ? (top + bottom) / 2 : null;
        if (center === bandCenterRef.current) return;
        bandCenterRef.current = center;
        relayoutRef.current();
      },
    }),
    [],
  );

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const tint = tintRef.current;
    const ctx = canvas.getContext('2d');
    const style = getComputedStyle(canvas);
    const fontAt = (size) => `${style.fontWeight} ${size}px ${style.fontFamily}`;

    // Zoom into the stem of the letter "I" if the word has one; it fills the screen fastest.
    const focusIndex = focusLetter ?? (word.indexOf('I') >= 0 ? word.indexOf('I') : Math.floor(word.length / 2));

    let width = 0;
    let height = 0;
    let ratio = 1;
    let layout = null;
    let progress = 0;
    let appear = 0;
    let entranceRaf = 0;
    let disposed = false;

    function measure() {
      width = root.clientWidth;
      height = root.clientHeight;
      if (!width || !height) return;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      ctx.font = fontAt(100);
      const m = ctx.measureText(word);
      const inkWidth = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const targetWidth = width * (width < 768 ? 0.8 : 0.84);
      const size = Math.min((100 * targetWidth) / inkWidth, (100 * height * 0.34) / m.actualBoundingBoxAscent);
      const k = size / 100;

      // Centre the ink (not the advance box) on the image: the viewport, or the band.
      const centerY = bandCenterRef.current ?? height / 2;
      const x = width / 2 - ((m.actualBoundingBoxRight - m.actualBoundingBoxLeft) * k) / 2;
      const capHeight = m.actualBoundingBoxAscent * k;
      const y = centerY + capHeight / 2;

      // Zoom into the focus letter's stroke, deep enough that it covers the screen.
      const before = ctx.measureText(word.slice(0, focusIndex)).width;
      const letter = ctx.measureText(word[focusIndex]);
      const stroke = measureStroke(fontAt, word[focusIndex]) ?? {
        width: (letter.actualBoundingBoxLeft + letter.actualBoundingBoxRight) / 100 / 3,
        center: (letter.actualBoundingBoxRight - letter.actualBoundingBoxLeft) / 200,
      };
      const originX = x + before * k + stroke.center * size;
      const originY = y - capHeight / 2;
      const zoom = ZOOM_MARGIN * Math.max(width / (stroke.width * size), height / (capHeight * 0.8), 2);

      layout = { size, x, y, originX, originY, zoom, centerY };
      root.style.setProperty('--kse-intro-word-bottom', `${Math.round(y)}px`);
    }

    function draw() {
      if (!layout) return;
      const p = progress;
      const scale = layout.zoom ** p; // exponential: a steady perceived zoom speed
      // Drift the zoom point to the centre of the image as the word grows.
      const pan = p * p;
      const cx = layout.originX + (width / 2 - layout.originX) * pan;
      const cy = layout.originY + (layout.centerY - layout.originY) * pan;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = style.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = appear;
      ctx.setTransform(
        ratio * scale,
        0,
        0,
        ratio * scale,
        ratio * (cx - scale * layout.originX),
        ratio * (cy - scale * layout.originY),
      );
      ctx.font = fontAt(layout.size);
      ctx.fillText(word, layout.x, layout.y);
    }

    function render() {
      const done = progress >= 1;
      root.classList.toggle('is-done', done);
      if (done) return; // fully revealed: nothing to paint or composite
      canvas.style.opacity = String(1 - smoothstep(CARD_FADE_FROM, 1, progress));
      tint.style.opacity = String(TINT * (1 - smoothstep(TINT_FADE[0], TINT_FADE[1], progress)));
      root.style.setProperty('--kse-intro-meta', String(1 - smoothstep(0, META_FADE_TO, progress)));
      draw();
    }

    updateRef.current = (next) => {
      progress = next;
      render();
    };

    function entrance(start) {
      const step = (now) => {
        appear = clamp01((now - start) / ENTRANCE_MS);
        appear = 1 - (1 - appear) ** 3;
        draw();
        if (appear < 1 && !disposed) entranceRaf = requestAnimationFrame(step);
      };
      entranceRaf = requestAnimationFrame(step);
    }

    const repaint = () => {
      measure();
      render();
    };
    relayoutRef.current = () => layout && repaint();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') repaint();
    };

    // Measure only once the display font is in: fallback metrics would put the
    // zoom origin in the wrong place.
    const fontsReady = document.fonts?.load ? document.fonts.load(fontAt(100), word).catch(() => {}) : Promise.resolve();
    fontsReady.then(() => {
      if (disposed) return;
      repaint();
      root.classList.remove('is-pending');
      entrance(performance.now());
    });

    const resizeObserver = new ResizeObserver(() => layout && repaint());
    resizeObserver.observe(root);
    canvas.addEventListener('contextrestored', repaint);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      cancelAnimationFrame(entranceRaf);
      resizeObserver.disconnect();
      canvas.removeEventListener('contextrestored', repaint);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      updateRef.current = () => {};
      relayoutRef.current = () => {};
    };
  }, [word, focusLetter]);

  return (
    <div ref={rootRef} className="kse-intro is-pending" aria-hidden="true">
      <div ref={tintRef} className="kse-intro__tint" />
      <canvas ref={canvasRef} className="kse-intro__canvas" />
      <div className="kse-intro__meta">
        {tagline && <p className="kse-intro__tagline">{tagline}</p>}
        {cue && <p className="kse-intro__cue">{cue}</p>}
      </div>
    </div>
  );
}
