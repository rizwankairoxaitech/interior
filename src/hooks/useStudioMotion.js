import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { usePrefersReducedMotion } from './usePrefersReducedMotion.js';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function useStudioMotion(scope) {
  const reducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reducedMotion) {
        // Clear only animated props: 'all' would also wipe each card's inline --stack-index.
        gsap.set('[data-reveal], .project-card__media img, .process-card', { clearProps: 'transform,opacity,filter' });
        return undefined;
      }

      gsap.utils.toArray('[data-reveal]').forEach((element) => {
        gsap.fromTo(
          element,
          { y: 36, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1.05,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: element,
              start: 'top 88%',
              once: true,
            },
          },
        );
      });

      gsap.utils.toArray('.project-card__media img').forEach((image) => {
        gsap.fromTo(
          image,
          { scale: 0.92 },
          {
            scale: 1.04,
            ease: 'none',
            scrollTrigger: {
              trigger: image.closest('.project-card'),
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.7,
            },
          },
        );
      });

      // Deeper cards sit smaller; dim with brightness so covered cards stay opaque instead of showing through.
      const cards = gsap.utils.toArray('.process-card');
      cards.slice(0, -1).forEach((card, index) => {
        const next = cards[index + 1];
        gsap.to(card, {
          scale: 1 - (cards.length - 1 - index) * 0.02,
          filter: 'brightness(0.62)',
          ease: 'none',
          scrollTrigger: {
            trigger: next,
            start: 'top 78%',
            end: () => `top ${parseFloat(getComputedStyle(next).top) || 0}px`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
      });
    },
    { scope, dependencies: [reducedMotion], revertOnUpdate: true },
  );
}
