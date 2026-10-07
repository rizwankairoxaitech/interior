/**
 * Progressive, prioritised loader for numbered image sequences.
 *
 * - Frames are cached at module level by URL, so remounts (React StrictMode,
 *   route changes) and multiple instances never download a frame twice.
 * - Load order is coarse-to-fine: the first few frames, the final frame, then
 *   every 16th frame, every 8th, 4th, 2nd and finally every frame. The whole
 *   sequence becomes scrubbable early and sharpens as loading continues.
 * - Frames around the current playhead always jump the queue, biased in the
 *   direction the user is scrolling.
 */

const IDLE = 0;
const LOADING = 1;
const LOADED = 2;
const SKIPPED = 3; // failed, or excluded from this loader

const COARSE_STRIDES = [16, 8, 4, 2, 1];
const LOOK_AHEAD = 24;
const LOOK_BEHIND = 8;
const MAX_RESIDENT = 54;

/** url -> { status, img, promise } */
const imageCache = new Map();

export function buildFrameUrls({ framePath, frameCount, extension = '.webp', padLength = 4, startNumber = 1 }) {
  return Array.from(
    { length: frameCount },
    (_, i) => `${framePath}${String(i + startNumber).padStart(padLength, '0')}${extension}`,
  );
}

/**
 * True when the device or network suggests serving the lighter frame set.
 * Signals are only available in Chromium; other browsers get the full set.
 */
export function prefersLowResFrames() {
  if (typeof navigator === 'undefined') return false;
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches) return true;
  const connection = navigator.connection;
  if (connection?.saveData) return true;
  if (connection && /2g|3g/.test(connection.effectiveType || '')) return true;
  if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
  return false;
}

export function loadFrame(url, priority = 'auto') {
  const cached = imageCache.get(url);
  if (cached) return cached.promise;

  const img = new Image();
  img.decoding = 'async';
  if ('fetchPriority' in img) img.fetchPriority = priority;

  const entry = { status: LOADING, img, promise: null };
  entry.promise = new Promise((resolve, reject) => {
    img.onload = () => {
      // Warm the decode cache so drawImage() is less likely to decode mid-scroll.
      // Never wait on it: Chrome can leave decode() pending while a page isn't
      // rendering frames (background tabs), which would hold a loading slot forever.
      img.decode?.().catch(() => {});
      entry.status = LOADED;
      resolve(img);
    };
    img.onerror = () => {
      imageCache.delete(url); // allow a later retry (e.g. after a network blip)
      reject(new Error(`Failed to load frame: ${url}`));
    };
  });
  imageCache.set(url, entry);
  img.src = url;
  return entry.promise;
}

function buildLoadOrder(frameCount, eagerCount) {
  const order = [];
  const seen = new Uint8Array(frameCount);
  const push = (i) => {
    if (i >= 0 && i < frameCount && !seen[i]) {
      seen[i] = 1;
      order.push(i);
    }
  };

  for (let i = 0; i < Math.min(eagerCount, frameCount); i++) push(i);
  const eagerEnd = order.length;
  push(frameCount - 1);

  let readyEnd = order.length;
  for (const stride of COARSE_STRIDES) {
    for (let i = 0; i < frameCount; i += stride) push(i);
    if (stride === COARSE_STRIDES[0]) readyEnd = order.length;
  }
  return { order, eagerEnd, readyEnd };
}

/**
 * @param {object} options
 * @param {string[]} options.urls          One URL per frame, in sequence order.
 * @param {number[]} [options.only]        Restrict loading to these indices.
 * @param {number}   [options.eagerCount]  Frames loaded before the page finishes loading.
 * @param {number}   [options.concurrency] Parallel requests once unlocked.
 * @param {(index:number, ok:boolean) => void} [options.onLoad]
 */
export function createFrameLoader({ urls, only, eagerCount = 8, concurrency = 6, onLoad }) {
  const count = urls.length;
  const state = new Uint8Array(count);
  const images = new Array(count);
  const { order, eagerEnd, readyEnd } = buildLoadOrder(count, eagerCount);

  if (only) {
    const allowed = new Set(only);
    for (let i = 0; i < count; i++) if (!allowed.has(i)) state[i] = SKIPPED;
  }

  // The "ready" set is what the loading indicator waits for: the eager frames,
  // the final frame and the first coarse pass across the whole sequence.
  const readySet = new Set(order.slice(0, readyEnd).filter((i) => state[i] !== SKIPPED));
  let readySettled = 0;

  for (let i = 0; i < count; i++) {
    const cached = imageCache.get(urls[i]);
    if (state[i] === IDLE && cached?.status === LOADED) {
      state[i] = LOADED;
      images[i] = cached.img;
    }
  }
  for (const i of readySet) if (state[i] === LOADED) readySettled++;

  let cursor = 0;
  let active = 0;
  let focus = 0;
  let direction = 1;
  let unlocked = false;
  let destroyed = false;

  const isIdle = (i) => i >= 0 && i < count && state[i] === IDLE;

  function trimResident() {
    const loaded = [];
    for (let i = 0; i < count; i++) {
      if (state[i] === LOADED) loaded.push(i);
    }
    if (loaded.length <= MAX_RESIDENT) return;

    const removable = loaded
      .filter((i) => !readySet.has(i) && Math.abs(i - focus) > LOOK_AHEAD)
      .sort((a, b) => Math.abs(b - focus) - Math.abs(a - focus));

    while (loaded.length > MAX_RESIDENT && removable.length) {
      const i = removable.shift();
      const entry = imageCache.get(urls[i]);
      if (entry?.img === images[i]) {
        entry.img.removeAttribute('src');
        imageCache.delete(urls[i]);
      }
      images[i] = null;
      state[i] = IDLE;
      loaded.pop();
    }
  }

  function nextIndex() {
    if (unlocked) {
      for (let d = 0; d <= LOOK_AHEAD; d++) {
        const ahead = focus + direction * d;
        if (isIdle(ahead)) return ahead;
        if (d > 0 && d <= LOOK_BEHIND) {
          const behind = focus - direction * d;
          if (isIdle(behind)) return behind;
        }
      }
    }
    // Finish the coarse ready set in the background. Fine frames are fetched
    // around the playhead instead of decoding the entire sequence up front.
    const limit = unlocked ? readyEnd : eagerEnd;
    while (cursor < limit && !isIdle(order[cursor])) cursor++;
    return cursor < limit ? order[cursor] : -1;
  }

  function pump() {
    const maxActive = unlocked ? concurrency : 3;
    while (!destroyed && active < maxActive) {
      const i = nextIndex();
      if (i < 0) return;
      state[i] = LOADING;
      active++;
      loadFrame(urls[i], i === 0 ? 'high' : 'low')
        .then(
          (img) => {
            if (destroyed) return;
            images[i] = img;
            state[i] = LOADED;
            if (readySet.has(i)) readySettled++;
            onLoad?.(i, true);
            trimResident();
          },
          () => {
            if (destroyed) return;
            state[i] = SKIPPED; // never retried by this loader; neighbours stand in
            if (readySet.has(i)) readySettled++;
            onLoad?.(i, false);
          },
        )
        .finally(() => {
          active--;
          pump();
        });
    }
  }

  return {
    count,
    /** Begin loading the eager frames immediately. */
    start: pump,
    /** Allow the full sequence to load (call once the page itself has loaded). */
    unlock() {
      if (unlocked) return;
      unlocked = true;
      cursor = 0;
      pump();
    },
    get isUnlocked() {
      return unlocked;
    },
    /** Prioritise frames around the playhead. */
    setFocus(index, dir) {
      if (index === focus && dir === direction) return;
      focus = index;
      direction = dir;
      trimResident();
      pump();
    },
    get(index) {
      return state[index] === LOADED ? images[index] : null;
    },
    /** Index of the closest loaded frame, or -1 if nothing has loaded yet. */
    nearestLoaded(index) {
      for (let d = 0; d < count; d++) {
        if (state[index - d] === LOADED) return index - d;
        if (state[index + d] === LOADED) return index + d;
      }
      return -1;
    },
    readyProgress() {
      return readySet.size ? readySettled / readySet.size : 1;
    },
    destroy() {
      destroyed = true;
    },
  };
}
