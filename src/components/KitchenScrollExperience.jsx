import { KITCHEN_FRAME_SIZE, KITCHEN_PIECES } from '../data/kitchenPieces.js';
import ScrollSequenceExperience from './ScrollSequenceExperience.jsx';

const BASE = import.meta.env.BASE_URL; // "/" unless the site is deployed under a sub-path

export const TOTAL_FRAMES = 120;
export const FRAME_PATH = `${BASE}kitchen-frames/frame_`;
export const LOW_RES_FRAME_PATH = `${BASE}kitchen-frames/sm/frame_`; // 1280×720 copies

/*
 * `from` / `to` are scroll progress through the section (0–1); the frame
 * index is progress × 119. Comments note what the frames show in each range.
 */
export const KITCHEN_CHAPTERS = [
  {
    // frames 1–18: the bare room
    from: 0,
    to: 0.15,
    position: 'center',
    eyebrow: 'The room',
    title: 'Begin with what the space could become.',
    body: 'Light, proportion and the way you move set the first lines.',
    hint: 'Scroll to build',
  },
  {
    // frames 19–36: base cabinetry, hood and wall units arrive
    from: 0.15,
    to: 0.3,
    position: 'left',
    eyebrow: 'Cabinetry',
    title: 'Architecture becomes furniture.',
    body: 'Joinery is drawn into the room, not added after it.',
  },
  {
    // frames 37–54: range, island carcass, worktops
    from: 0.3,
    to: 0.45,
    position: 'right',
    eyebrow: 'Layout',
    title: 'Function finds its natural rhythm.',
    body: 'Every reach, turn and gathering place is considered.',
  },
  {
    // frames 55–72: marble backsplash and waterfall island
    from: 0.45,
    to: 0.6,
    position: 'left',
    eyebrow: 'Stone',
    title: 'Material gives the room its weight.',
    body: 'Vein, edge and finish are composed as one continuous gesture.',
  },
  {
    // frames 73–90: pendant lights descend
    from: 0.6,
    to: 0.75,
    position: 'right',
    eyebrow: 'Light',
    title: 'Atmosphere arrives after dark.',
    body: 'A warm, layered glow shifts the room from task to ritual.',
  },
  {
    // frames 91–108: olive tree, shelving, objects, stools
    from: 0.75,
    to: 0.9,
    position: 'left',
    eyebrow: 'The final layer',
    title: 'Objects make architecture feel lived in.',
    body: 'Each finishing touch brings softness, character and purpose.',
  },
  {
    // frames 109–120: the finished kitchen
    from: 0.9,
    to: 1,
    position: 'right',
    eyebrow: 'Complete',
    title: 'A room that feels entirely your own.',
    body: 'Resolved down to the last detail, ready for real life.',
  },
];

const percentOf = (value, total) => `${(value / total) * 100}%`;

// Clean background for each piece that flies out of the last frame; shown once it has left.
const PIECE_PATCHES = KITCHEN_PIECES.map(({ id, patch }) => (
  <span
    key={id}
    className="kse-patch"
    style={{
      left: percentOf(patch.x, KITCHEN_FRAME_SIZE.width),
      top: percentOf(patch.y, KITCHEN_FRAME_SIZE.height),
      width: percentOf(patch.w, KITCHEN_FRAME_SIZE.width),
      height: percentOf(patch.h, KITCHEN_FRAME_SIZE.height),
      '--patch': `url(${patch.src})`,
      '--patch-top': patch.y / KITCHEN_FRAME_SIZE.height,
    }}
  />
));

export default function KitchenScrollExperience(props) {
  return (
    <ScrollSequenceExperience
      id="kitchen"
      framePath={FRAME_PATH}
      frameCount={TOTAL_FRAMES}
      // A custom framePath without its own low-res set must not fall back to the kitchen's.
      lowResFramePath={props.framePath ? props.lowResFramePath : LOW_RES_FRAME_PATH}
      // The patches are cut from these frames; other frames would show them out of place.
      frameLayer={props.framePath ? undefined : PIECE_PATCHES}
      chapters={KITCHEN_CHAPTERS}
      heading="A kitchen, built as you scroll"
      imageLabel="An empty room with timber floors becomes a finished kitchen: olive-green shaker cabinetry, a plaster range hood, a marble backsplash, a waterfall marble island, glass pendant lights and four upholstered bar stools."
      {...props}
    />
  );
}
