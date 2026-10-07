import { useId, useLayoutEffect, useMemo, useRef } from 'react';
import { useScrollFrameSequence } from '../hooks/useScrollFrameSequence.js';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.js';
import { buildFrameUrls, prefersLowResFrames } from '../utils/frameLoader.js';
import ScrollIntroMask from './ScrollIntroMask.jsx';
import './ScrollSequenceExperience.css';

// Free space (px) needed under a banded portrait frame to set the text there
// instead of over the image.
const MIN_TEXT_SPACE = 190;

function chapterIndexAt(chapters, progress) {
  return chapters.findIndex((chapter) => progress >= chapter.from && progress <= chapter.to);
}

function activateChapter(elements, activeRef, index) {
  if (index === activeRef.current) return;
  elements.forEach((el, i) => {
    if (!el) return;
    const active = i === index;
    el.classList.toggle('is-active', active);
    el.setAttribute('aria-hidden', String(!active));
  });
  activeRef.current = index;
}

/**
 * Sticky, scroll-scrubbed image sequence with synchronised text chapters.
 * Room-agnostic: pass any numbered frame sequence and chapter list.
 *
 * chapters: [{ from, to, position: 'left' | 'right' | 'center', eyebrow, title, body, hint }]
 *   `from` / `to` are progress through the frame sequence (0–1).
 *
 * intro (optional): { word, tagline, cue, length } — a white card with `word` cut
 *   out of it over the first frame; scrolling `length` vh zooms the word until the
 *   card dissolves, then the frames play. Skipped under reduced motion.
 *
 * frameLayer (optional): nodes laid over the drawn frame, under the scrim. The layer
 *   tracks the frame's rect, so children can be placed in % of the frame.
 */
export default function ScrollSequenceExperience({
  id,
  framePath,
  frameCount,
  frameExtension = '.webp',
  framePadLength = 4,
  frameWidth = 1920,
  frameHeight = 1080,
  lowResFramePath,
  lowResFrameWidth = 1280,
  lowResFrameHeight = 720,
  chapters = [],
  heading,
  headingLevel = 2, // 1 when the section is the page hero; chapter titles sit one level below
  imageLabel,
  loadingLabel = 'Entering the space',
  scrollLength = 600, // section height in vh (desktop)
  mobileScrollLength = 450, // section height in vh (≤ 767px wide)
  smoothing,
  crossfade = true, // blend neighbouring frames for continuous motion (off on low-end devices)
  intro,
  frameLayer,
  skipHref,
  skipLabel = 'Skip the reveal',
  className = '',
}) {
  const headingId = useId();
  const Heading = `h${headingLevel}`;
  const ChapterHeading = `h${Math.min(headingLevel + 1, 6)}`;
  const reducedMotion = usePrefersReducedMotion();
  const mode = reducedMotion ? 'static' : 'scroll';

  // The intro adds its own scroll distance on top of the frames'. Mobile scales it
  // by the same ratio so the intro is the same share of the section everywhere.
  const introLength = intro && mode === 'scroll' ? (intro.length ?? 150) : 0;
  const totalLength = scrollLength + introLength;
  const totalMobileLength = (mobileScrollLength * totalLength) / scrollLength;

  const lowRes = useMemo(() => Boolean(lowResFramePath) && prefersLowResFrames(), [lowResFramePath]);
  const urls = useMemo(
    () =>
      buildFrameUrls({
        framePath: lowRes ? lowResFramePath : framePath,
        frameCount,
        extension: frameExtension,
        padLength: framePadLength,
      }),
    [lowRes, lowResFramePath, framePath, frameCount, frameExtension, framePadLength],
  );

  const chapterRefs = useRef([]);
  const activeChapter = useRef(-1);
  const barRef = useRef(null);
  const introRef = useRef(null);

  const { sectionRef, viewportRef, canvasRef } = useScrollFrameSequence({
    urls,
    mode,
    frameWidth: lowRes ? lowResFrameWidth : frameWidth,
    frameHeight: lowRes ? lowResFrameHeight : frameHeight,
    smoothing,
    crossfade,
    introFraction: introLength / totalLength,

    // These run inside requestAnimationFrame: direct DOM writes only, no React state.
    onProgress(progress) {
      sectionRef.current?.classList.toggle('is-scrolled', progress > 0.02);
      activateChapter(chapterRefs.current, activeChapter, chapterIndexAt(chapters, progress));
    },
    onIntroProgress(progress) {
      introRef.current?.update(progress);
      sectionRef.current?.classList.toggle('is-intro', progress < 1);
    },
    onLoadProgress(ratio) {
      if (barRef.current) barRef.current.style.transform = `scaleX(${ratio})`;
      sectionRef.current?.classList.toggle('is-ready', ratio >= 1);
    },
    onLayout({ banded, imageTop, imageBottom, imageLeft, imageWidth, imageHeight, height }) {
      const section = sectionRef.current;
      if (!section) return;
      section.dataset.layout = banded && height - imageBottom >= MIN_TEXT_SPACE ? 'band' : 'cover';
      section.dataset.banded = String(banded);
      section.style.setProperty('--kse-image-bottom', `${Math.round(imageBottom)}px`);
      section.style.setProperty('--kse-frame-x', `${imageLeft}px`);
      section.style.setProperty('--kse-frame-y', `${imageTop}px`);
      section.style.setProperty('--kse-frame-w', `${imageWidth}px`);
      section.style.setProperty('--kse-frame-h', `${imageHeight}px`);
      introRef.current?.setFrameBand(imageTop, imageBottom, banded);
    },
  });

  // Reduced motion shows the finished state with its closing chapter.
  useLayoutEffect(() => {
    activeChapter.current = -1;
    if (mode === 'static') activateChapter(chapterRefs.current, activeChapter, chapters.length - 1);
  }, [mode, chapters]);

  return (
    <section
      ref={sectionRef}
      id={id}
      className={['kse', introLength > 0 && 'is-intro', className].filter(Boolean).join(' ')}
      data-mode={mode}
      aria-labelledby={heading ? headingId : undefined}
      style={{ '--kse-length': totalLength, '--kse-length-mobile': totalMobileLength }}
    >
      <div ref={viewportRef} className="kse__viewport">
        <canvas ref={canvasRef} className="kse__canvas" role="img" aria-label={imageLabel} />
        {frameLayer && (
          <div className="kse__frame-layer" aria-hidden="true">
            {frameLayer}
          </div>
        )}
        <div className="kse__scrim" aria-hidden="true" />

        {heading && (
          <Heading id={headingId} className="kse__sr-only">
            {heading}
          </Heading>
        )}

        <div className="kse__chapters">
          {chapters.map((chapter, i) => (
            <div
              key={chapter.title}
              ref={(el) => {
                chapterRefs.current[i] = el;
              }}
              className={`kse__chapter kse__chapter--${chapter.position || 'left'}`}
            >
              {chapter.eyebrow && <p className="kse__eyebrow">{chapter.eyebrow}</p>}
              <ChapterHeading className="kse__title">{chapter.title}</ChapterHeading>
              {chapter.body && <p className="kse__body">{chapter.body}</p>}
              {chapter.hint && (
                <p className="kse__hint" aria-hidden="true">
                  {chapter.hint}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="kse__loader" aria-hidden="true">
          <span className="kse__loader-label">{loadingLabel}</span>
          <span className="kse__loader-track">
            <span ref={barRef} className="kse__loader-bar" />
          </span>
        </div>

        {skipHref && (
          <a className='kse__skip' href={skipHref}>
            {skipLabel} <span aria-hidden='true'>↓</span>
          </a>
        )}

        {introLength > 0 && (
          <ScrollIntroMask ref={introRef} word={intro.word} tagline={intro.tagline} cue={intro.cue} />
        )}
      </div>
    </section>
  );
}
