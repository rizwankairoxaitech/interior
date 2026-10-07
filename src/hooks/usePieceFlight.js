import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { KITCHEN_FRAME_SIZE, KITCHEN_PIECES, SHOWCASE_PIECE, finalImageOf } from '../data/kitchenPieces.js';
import { usePrefersReducedMotion } from './usePrefersReducedMotion.js';

gsap.registerPlugin(ScrollTrigger);

// What darkens the frame at take-off, so each piece leaves looking exactly as it sat in the room.
const SCRIM_INK = '12, 10, 8'; // .kse__scrim
const BAND_FADE = 0.14; // useScrollFrameSequence: share of a banded frame faded into the background

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const lerp = (from, to, t) => from + (to - from) * t;
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Gradient layers (screen y, colour) matching the stage's darkening, top layer first. */
function shadeLayers(kitchen, stage, frameTop, frameHeight, stageHeight) {
  const layers = [];
  if (kitchen.dataset.layout !== 'band') {
    layers.push([
      [stageHeight * 0.5, `rgba(${SCRIM_INK}, 0)`],
      [stageHeight * 0.76, `rgba(${SCRIM_INK}, 0.34)`],
      [stageHeight, `rgba(${SCRIM_INK}, 0.66)`],
    ]);
    layers.push([
      [0, `rgba(${SCRIM_INK}, 0.18)`],
      [stageHeight * 0.14, `rgba(${SCRIM_INK}, 0)`],
    ]);
  }
  if (kitchen.dataset.banded === 'true') {
    const background = getComputedStyle(stage).backgroundColor;
    const clear = background.replace(/rgba?\(([^)]+)\)/, (_, inner) => `rgba(${inner.split(',').slice(0, 3).join(',')}, 0)`);
    const fade = frameHeight * BAND_FADE;
    const bottom = frameTop + frameHeight;
    layers.push([
      [frameTop, background],
      [frameTop + fade, clear],
      [bottom - fade, clear],
      [bottom, background],
    ]);
  }
  return layers;
}

/**
 * Lifts the kitchen's pieces out of its last frame and flies them into their cards.
 *
 * The flight runs from the moment the kitchen's sticky stage releases until the
 * heading and cards sit centred under the header. Pieces travel in a fixed layer
 * (transforming in-flow elements shakes against threaded scrolling); at each end
 * they hand over to the real thing: the frame, whose patch hides the original
 * once it has left, and the card's own image. A piece with a studio render takes
 * off as the exact frame pixels and sharpens into the render as it rises.
 *
 * The showcase piece then flies a second leg, from its card into the studio
 * statement, turning half a circle from its back view to its front view.
 */
export function usePieceFlight(sectionRef, kitchenId = 'kitchen') {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const section = sectionRef.current;
    const kitchen = document.getElementById(kitchenId);
    const stage = kitchen?.querySelector('.kse__viewport');
    const layer = kitchen?.querySelector('.kse__frame-layer');
    if (reducedMotion || !section || !stage || !layer || kitchen.dataset.mode === 'static') return undefined;

    const flights = KITCHEN_PIECES.map((piece) => {
      const flyer = section.querySelector(`[data-piece-flyer='${piece.id}']`);
      return {
        piece,
        flyer,
        body: flyer?.querySelector('.piece-flyer__body'),
        photo: flyer?.querySelector('.piece-flyer__photo'),
        render: flyer?.querySelector('.piece-flyer__render'),
        shades: [...(flyer?.querySelectorAll('.piece-flyer__shade') ?? [])],
        slot: section.querySelector(`[data-piece-slot='${piece.id}']`),
        from: null,
        to: null,
      };
    }).filter((flight) => flight.flyer && flight.slot);
    if (!flights.length) return undefined;

    let start = 0;
    let end = 0;
    let phase = '';

    function measure() {
      const scrollY = window.scrollY;
      const stageBox = stage.getBoundingClientRect();
      const frameBox = layer.getBoundingClientRect();

      // The stage is stuck to the top until here; after it the room scrolls away.
      start = kitchen.getBoundingClientRect().top + scrollY + kitchen.offsetHeight - stage.offsetHeight;

      // Land when the heading and the piece cards sit centred under the header
      // (or just the cards, when both don't fit).
      const headerHeight = document.querySelector('.site-header')?.offsetHeight ?? 0;
      const room = window.innerHeight - headerHeight;
      const contentTop =
        section.getBoundingClientRect().top + scrollY + parseFloat(getComputedStyle(section).paddingTop);
      const cards = flights.map(({ slot }) => slot.closest('.piece-card').getBoundingClientRect());
      const cardsTop = Math.min(...cards.map((box) => box.top)) + scrollY;
      const cardsBottom = Math.max(...cards.map((box) => box.bottom)) + scrollY;
      end =
        cardsBottom - contentTop <= room
          ? contentTop - headerHeight - (room - (cardsBottom - contentTop)) / 2
          : cardsTop - headerHeight - Math.max(16, (room - (cardsBottom - cardsTop)) / 2);
      end = Math.max(end, start + window.innerHeight * 0.5);

      // Take-off: the stage is stuck at the top, so the frame sits at its offset in the stage.
      const scale = frameBox.width / KITCHEN_FRAME_SIZE.width;
      const frameTop = frameBox.top - stageBox.top;
      const layers = shadeLayers(kitchen, stage, frameTop, frameBox.height, stage.offsetHeight);

      flights.forEach((flight) => {
        const box = finalImageOf(flight.piece); // the flyer is sized as the card's image
        const slotBox = flight.slot.getBoundingClientRect();
        flight.from = { x: frameBox.left + box.x * scale, y: frameTop + box.y * scale, w: box.w * scale };
        flight.to = { x: slotBox.left, y: slotBox.top + scrollY - end, w: slotBox.width };
        flight.flyer.style.width = `${slotBox.width}px`;
        flight.flyer.style.height = `${slotBox.height}px`;

        // The flyer starts scaled by from.w / to.w; express each shade in its own layer's px.
        // The photo layer starts where the cut-out sits in the frame; the render fills the flyer.
        const startScale = flight.from.w / flight.to.w;
        const photoTop = frameTop + flight.piece.cutout.y * scale;
        flight.shades.forEach((shade) => {
          const top = shade.closest('.piece-flyer__photo') ? photoTop : flight.from.y;
          const local = (y) => `${((y - top) / startScale).toFixed(1)}px`;
          shade.style.backgroundImage = layers.length
            ? layers
                .map((stops) => `linear-gradient(to bottom, ${stops.map(([y, colour]) => `${colour} ${local(y)}`).join(', ')})`)
                .join(', ')
            : 'none';
        });
      });
    }

    function render(progress) {
      const next = progress <= 0 ? 'before' : progress >= 1 ? 'landed' : 'flying';
      if (next !== phase) {
        phase = next;
        section.dataset.flight = next;
        kitchen.dataset.unpacked = String(next !== 'before');
      }
      section.style.setProperty('--landing', smoothstep(0.72, 1, progress).toFixed(3));
      if (next !== 'flying') return;

      const travel = easeInOut(progress);
      const arc = Math.sin(Math.PI * progress);
      const lift = arc * window.innerHeight * 0.04;
      const shade = (1 - smoothstep(0, 0.22, progress)).toFixed(3);
      // The render fades in over the photo, then the photo leaves: no see-through midpoint.
      const reveal = smoothstep(0.02, 0.14, progress).toFixed(3);
      const photo = (1 - smoothstep(0.12, 0.17, progress)).toFixed(3);

      flights.forEach((flight) => {
        const { piece, flyer, body, from, to } = flight;
        const x = lerp(from.x, to.x, travel);
        const y = lerp(from.y, to.y, travel) - lift;
        const scale = lerp(from.w, to.w, travel) / to.w;
        flyer.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
        body.style.transform = `rotate(${(arc * piece.swing).toFixed(2)}deg)`;
        flight.shades.forEach((element) => {
          element.style.opacity = shade;
        });
        if (flight.render) {
          flight.render.style.opacity = reveal;
          flight.photo.style.opacity = photo;
        }
      });
    }

    const trigger = ScrollTrigger.create({
      start: () => {
        measure();
        return start;
      },
      end: () => end,
      invalidateOnRefresh: true,
      onRefresh: (self) => render(self.progress),
      onUpdate: (self) => render(self.progress),
    });

    // ---- Second leg: card → studio statement, turning from back view to front view.
    const turner = SHOWCASE_PIECE && section.querySelector(`[data-piece-turn='${SHOWCASE_PIECE.id}']`);
    const showcase = SHOWCASE_PIECE && document.querySelector(`[data-piece-showcase='${SHOWCASE_PIECE.id}']`);
    const card = SHOWCASE_PIECE && section.querySelector(`[data-piece-slot='${SHOWCASE_PIECE.id}']`);
    const figure = showcase?.closest('.studio-story__showcase');
    const turnBody = turner?.querySelector('.piece-turn__body');
    const leg = { start: 0, end: 0, from: null, to: null, phase: '' };

    function measureTurn() {
      const scrollY = window.scrollY;
      const headerHeight = document.querySelector('.site-header')?.offsetHeight ?? 0;
      const room = window.innerHeight - headerHeight;
      const showBox = showcase.getBoundingClientRect();
      const showTop = showBox.top + scrollY;

      // Land with the stool centred under the header; set off once the full list has
      // had a moment on screen (runs after the first leg's measure(), so `end` is fresh).
      leg.end = showTop - headerHeight - Math.max(16, (room - showBox.height) / 2);
      leg.start = Math.max(end, Math.min(end + window.innerHeight * 0.3, leg.end - window.innerHeight * 0.45));
      leg.end = Math.max(leg.end, leg.start + 1);

      // The flyer is sized as the front view; the back view sits centred at its full height,
      // so at take-off the flyer is scaled until that back view covers the card's image.
      const cardBox = card.getBoundingClientRect();
      const back = finalImageOf(SHOWCASE_PIECE);
      const backWidth = showBox.height * (back.w / back.h);
      const startScale = cardBox.height / showBox.height;
      leg.from = {
        x: cardBox.left - ((showBox.width - backWidth) / 2) * startScale,
        y: cardBox.top + scrollY - leg.start,
        w: showBox.width * startScale,
      };
      leg.to = { x: showBox.left, y: showTop - leg.end, w: showBox.width };
      turner.style.width = `${showBox.width}px`;
      turner.style.height = `${showBox.height}px`;
    }

    function renderTurn(progress) {
      const next = progress <= 0 ? 'waiting' : progress >= 1 ? 'placed' : 'turning';
      if (next !== leg.phase) {
        leg.phase = next;
        section.dataset.showcase = next;
        figure.dataset.state = next;
      }
      section.style.setProperty('--departing', smoothstep(0, 0.12, progress).toFixed(3));
      figure.style.setProperty('--arriving', smoothstep(0.8, 1, progress).toFixed(3));
      if (next !== 'turning') return;

      const travel = easeInOut(progress);
      const lift = Math.sin(Math.PI * progress) * window.innerHeight * 0.05;
      const x = lerp(leg.from.x, leg.to.x, travel);
      const y = lerp(leg.from.y, leg.to.y, travel) - lift;
      const scale = lerp(leg.from.w, leg.to.w, travel) / leg.to.w;
      turner.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      // Half a turn mid-leg: quick through the edge-on moment, settled before it lands.
      const angle = 180 * easeInOutCubic(clamp01((progress - 0.12) / 0.62));
      turnBody.style.transform = `rotateY(${angle.toFixed(2)}deg)`;
    }

    const turnTrigger =
      turner && showcase && card && figure
        ? ScrollTrigger.create({
            start: () => {
              measureTurn();
              return leg.start;
            },
            end: () => leg.end,
            invalidateOnRefresh: true,
            onRefresh: (self) => renderTurn(self.progress),
            onUpdate: (self) => renderTurn(self.progress),
          })
        : null;

    return () => {
      trigger.kill();
      if (turnTrigger) {
        turnTrigger.kill();
        delete section.dataset.showcase;
        delete figure.dataset.state;
        section.style.removeProperty('--departing');
        figure.style.removeProperty('--arriving');
        turner.removeAttribute('style');
        turnBody.removeAttribute('style');
      }
      delete kitchen.dataset.unpacked;
      delete section.dataset.flight;
      section.style.removeProperty('--landing');
      flights.forEach(({ flyer, body, photo, render, shades }) => {
        flyer.removeAttribute('style');
        body.removeAttribute('style');
        photo.style.removeProperty('opacity');
        render?.style.removeProperty('opacity');
        shades.forEach((shade) => {
          shade.style.removeProperty('background-image');
          shade.style.removeProperty('opacity');
        });
      });
    };
  }, [sectionRef, kitchenId, reducedMotion]);
}
