const IMAGES = `${import.meta.env.BASE_URL}images/pieces/`;

/*
 * Pieces lifted out of the kitchen's final frame (frame_0120.webp, 1920 × 1080).
 * `cutout` and `patch` boxes are in frame pixels: the cut-out is the object itself,
 * the patch is the clean background that hides it in the frame once it has left.
 * An optional `render` is a sharp studio image of the same view, registered over the
 * cut-out (its box is in frame pixels too; width/height are its own pixels): the
 * piece takes off as the frame's pixels and sharpens into it.
 * A `showcase` piece travels on past its card: it turns from the back view (as it
 * stood at the island) to a studio front view, set large in the studio statement.
 * All images come from scripts/extract-kitchen-pieces.py.
 */
export const KITCHEN_FRAME_SIZE = { width: 1920, height: 1080 };

/** What a piece looks like once it has taken off: its studio render when there is one. */
export const finalImageOf = (piece) => piece.render ?? piece.cutout;

export const KITCHEN_PIECES = [
  {
    id: 'pendant',
    number: '01',
    name: 'Globe pendant',
    detail: 'Hand-blown clear glass, brushed brass gallery',
    note: 'Three over the island',
    alt: 'A clear glass globe pendant with a warm filament bulb, hung from a brass ceiling rose.',
    hang: 'top', // hangs from the top of its card; 'bottom' stands on the card's floor
    swing: 4, // degrees of tilt at mid-flight
    cutout: { src: `${IMAGES}piece-pendant.webp`, x: 920, y: 45, w: 85, h: 352 },
    patch: { src: `${IMAGES}patch-pendant.webp`, x: 915, y: 40, w: 95, h: 362 },
  },
  {
    id: 'stool',
    number: '02',
    name: 'Counter stool',
    detail: 'Taupe velvet seat, blackened steel frame',
    note: 'Four along the island',
    alt: 'An upholstered taupe counter stool with a curved back and slim black steel legs.',
    hang: 'bottom',
    swing: -3,
    cutout: { src: `${IMAGES}piece-stool.webp`, x: 743, y: 664, w: 167, h: 323 },
    patch: { src: `${IMAGES}patch-stool.webp`, x: 738, y: 659, w: 177, h: 333 },
    render: { src: `${IMAGES}stool-back.webp`, x: 745.46, y: 667.42, w: 164.09, h: 316.16, width: 519, height: 1000 },
    showcase: {
      src: `${IMAGES}stool-front.webp`,
      width: 713,
      height: 1200,
      alt: 'The counter stool from the front: a curved taupe velvet seat on slim black steel legs.',
      caption: 'Counter stool · Taupe velvet, blackened steel',
    },
  },
];

/** The piece that carries on from the list into the studio statement. */
export const SHOWCASE_PIECE = KITCHEN_PIECES.find((piece) => piece.showcase);

export const KITCHEN_MATERIALS = [
  {
    id: 'marble',
    number: '03',
    name: 'Calacatta marble',
    detail: 'Honed slab for the waterfall island and splashback',
    image: `${IMAGES}swatch-marble.webp`,
  },
  {
    id: 'joinery',
    number: '04',
    name: 'Olive shaker joinery',
    detail: 'Hand-painted doors with brass bar pulls',
    image: `${IMAGES}swatch-joinery.webp`,
  },
  {
    id: 'oak',
    number: '05',
    name: 'Natural oak floor',
    detail: 'Wide boards, finished in matt oil',
    image: `${IMAGES}swatch-oak.webp`,
  },
];
