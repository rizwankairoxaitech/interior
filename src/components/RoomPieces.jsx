import { useRef } from 'react';
import { KITCHEN_MATERIALS, KITCHEN_PIECES, SHOWCASE_PIECE, finalImageOf } from '../data/kitchenPieces.js';
import { usePieceFlight } from '../hooks/usePieceFlight.js';

const percentOf = (value, total) => `${(value / total) * 100}%`;
const sizeOf = (image) => ({ width: image.width ?? image.w, height: image.height ?? image.h });

/**
 * The finished kitchen, itemised. Its pendant and stool fly out of the sequence's
 * last frame into their cards as the room scrolls away (see usePieceFlight).
 */
export default function RoomPieces() {
  const sectionRef = useRef(null);
  usePieceFlight(sectionRef);

  return (
    <section ref={sectionRef} className='pieces section-shell' id='pieces' aria-labelledby='pieces-title'>
      <div className='pieces__heading' data-reveal>
        <p className='eyebrow'>Room components</p>
        <h2 id='pieces-title'>Every piece, chosen for this room.</h2>
        <p className='pieces__copy'>
          Lighting, seating and surfaces are specified together, so the kitchen arrives complete rather than
          collected.
        </p>
      </div>

      <ol className='pieces__list'>
        {KITCHEN_PIECES.map((piece) => {
          const image = finalImageOf(piece);
          return (
            <li
              className={['piece-card', `piece-card--${piece.hang}`, piece.showcase && 'piece-card--travels']
                .filter(Boolean)
                .join(' ')}
              key={piece.id}
            >
              <div className='piece-card__stage'>
                <img
                  className='piece-card__object'
                  data-piece-slot={piece.id}
                  src={image.src}
                  alt={piece.alt}
                  {...sizeOf(image)}
                />
              </div>
              <div className='piece-card__meta'>
                <span className='piece-card__number'>{piece.number}</span>
                <h3>{piece.name}</h3>
                <p>{piece.detail}</p>
                <p className='piece-card__note'>{piece.note}</p>
              </div>
            </li>
          );
        })}
        {KITCHEN_MATERIALS.map((material) => (
          <li className='piece-card piece-card--material' key={material.id} data-reveal>
            <div className='piece-card__stage'>
              <img className='piece-card__swatch' src={material.image} alt='' width='320' height='320' loading='lazy' />
            </div>
            <div className='piece-card__meta'>
              <span className='piece-card__number'>{material.number}</span>
              <h3>{material.name}</h3>
              <p>{material.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className='pieces-flight' aria-hidden='true'>
        {KITCHEN_PIECES.map((piece) => {
          const { cutout, render } = piece;
          const box = finalImageOf(piece);
          return (
            <div className={`piece-flyer piece-flyer--${piece.hang}`} data-piece-flyer={piece.id} key={piece.id}>
              <div className='piece-flyer__body'>
                {/* The frame's own pixels, registered inside the final image's box: exact at take-off. */}
                <div
                  className='piece-flyer__photo'
                  style={{
                    left: percentOf(cutout.x - box.x, box.w),
                    top: percentOf(cutout.y - box.y, box.h),
                    width: percentOf(cutout.w, box.w),
                    height: percentOf(cutout.h, box.h),
                  }}
                >
                  <img src={cutout.src} alt='' width={cutout.w} height={cutout.h} />
                  <span className='piece-flyer__shade' style={{ '--mask': `url(${cutout.src})` }} />
                </div>
                {render && (
                  <div className='piece-flyer__render'>
                    <img src={render.src} alt='' {...sizeOf(render)} />
                    <span className='piece-flyer__shade' style={{ '--mask': `url(${render.src})` }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {SHOWCASE_PIECE && (
          // Second leg: from its card into the studio statement, turning to face the viewer.
          <div className='piece-turn' data-piece-turn={SHOWCASE_PIECE.id}>
            <div className='piece-turn__body'>
              <img
                className='piece-turn__back'
                src={finalImageOf(SHOWCASE_PIECE).src}
                alt=''
                {...sizeOf(finalImageOf(SHOWCASE_PIECE))}
              />
              <img
                className='piece-turn__front'
                src={SHOWCASE_PIECE.showcase.src}
                alt=''
                width={SHOWCASE_PIECE.showcase.width}
                height={SHOWCASE_PIECE.showcase.height}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
