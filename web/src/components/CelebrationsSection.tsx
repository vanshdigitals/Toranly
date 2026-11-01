import React, { useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Container } from './Container';
import { SectionHeading } from './SectionHeading';
import './CelebrationsSection.css';

interface CelebrationCard {
  id: string;
  title: string;
  description: string;
  imageName: string;
  altText: string;
}

const CELEBRATIONS: CelebrationCard[] = [
  {
    id: 'weddings',
    title: 'Weddings',
    description: 'Plan every function, from mehendi to reception, under one budget.',
    imageName: 'wedding',
    altText: 'Hennaed hands holding marigold petals beside a brass lamp',
  },
  {
    id: 'engagements',
    title: 'Engagements',
    description: 'Venue, food, decor and gifts, organised without the last-minute rush.',
    imageName: 'engagement',
    altText: 'Two hands exchanging rings over a plate of sweets',
  },
  {
    id: 'birthdays',
    title: 'Birthdays',
    description: 'Cake, venue, return gifts and a checklist that keeps the day on track.',
    imageName: 'birthday',
    altText: "A child's birthday table with a homemade cake",
  },
  {
    id: 'anniversaries',
    title: 'Anniversaries',
    description: 'From a quiet dinner to a full evening with family, planned calmly.',
    imageName: 'anniversary',
    altText: "An older couple's hands together beside two cups of chai",
  },
  {
    id: 'community',
    title: 'Community events',
    description: 'Sound, seating, food and safety, with a clear schedule for the day.',
    imageName: 'community',
    altText: 'A neighbourhood gathering under string lights and marigold garlands',
  },
  {
    id: 'family',
    title: 'Family celebrations',
    description: 'Housewarmings, reunions and festive get-togethers, without scattered lists.',
    imageName: 'family',
    altText: 'A doorway decorated with a marigold toran and rangoli',
  },
];

export const CelebrationsSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const firstGroupRef = useRef<HTMLUListElement>(null);

  // Position state (persisted across RAF frames without triggering re-renders)
  const offsetRef = useRef(0);
  const listWidthRef = useRef(2424);
  const cardStepRef = useRef(404);

  // Animation & timing refs
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Step animation (arrows & swipe)
  const isStepAnimatingRef = useRef(false);
  const stepStartTimeRef = useRef(0);
  const stepStartOffsetRef = useRef(0);
  const stepTargetOffsetRef = useRef(0);
  const stepResumeTimerRef = useRef<number | null>(null);
  const isPausedForStepRef = useRef(false);

  // Interaction pausing refs
  const isHoveredRef = useRef(false);
  const isFocusedRef = useRef(false);
  const isTouchingRef = useRef(false);
  const isInteractionPausedRef = useRef(false);
  const interactionResumeTimerRef = useRef<number | null>(null);

  // Visibility & reduced motion
  const isIntersectingRef = useRef(true);
  const isTabVisibleRef = useRef(true);
  const isReducedMotionRef = useRef(false);

  // Touch tracking for swipe
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchDeltaXRef = useRef(0);

  // Direct DOM transform update
  const applyTransform = useCallback((x: number) => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(-${x.toFixed(2)}px, 0, 0)`;
    }
  }, []);

  // Update layout measurements on mount & resize
  const updateMeasurements = useCallback(() => {
    if (firstGroupRef.current) {
      const rect = firstGroupRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        listWidthRef.current = rect.width;
      }
      const card = firstGroupRef.current.querySelector<HTMLElement>('.celebration-card');
      if (card) {
        const cardWidth = card.offsetWidth;
        const gap = parseInt(window.getComputedStyle(firstGroupRef.current).gap || '24', 10) || 24;
        cardStepRef.current = cardWidth + gap;
      }
    }
  }, []);

  // Step trigger (used by previous/next arrows and swipe gestures)
  const triggerStep = useCallback(
    (direction: 'next' | 'prev') => {
      const step = cardStepRef.current || 404;
      const listWidth = listWidthRef.current || 2424;

      // Cancel any pending auto-resume timer
      if (stepResumeTimerRef.current) {
        clearTimeout(stepResumeTimerRef.current);
        stepResumeTimerRef.current = null;
      }
      isPausedForStepRef.current = true;

      // Reduced motion: instant step with no animation
      if (isReducedMotionRef.current) {
        if (direction === 'next') {
          offsetRef.current += step;
          while (offsetRef.current >= listWidth) offsetRef.current -= listWidth;
        } else {
          if (offsetRef.current < step) offsetRef.current += listWidth;
          offsetRef.current -= step;
        }
        applyTransform(offsetRef.current);
        isStepAnimatingRef.current = false;
        return;
      }

      // 400ms smooth ease-out animation
      let current = offsetRef.current;
      if (direction === 'prev') {
        // If current offset is less than one step, wrap by +listWidth first (seamless visually)
        if (current < step) {
          current += listWidth;
          offsetRef.current = current;
          applyTransform(current);
        }
        stepStartOffsetRef.current = current;
        stepTargetOffsetRef.current = current - step;
      } else {
        stepStartOffsetRef.current = current;
        stepTargetOffsetRef.current = current + step;
      }

      stepStartTimeRef.current = performance.now();
      isStepAnimatingRef.current = true;
    },
    [applyTransform],
  );

  // Main RAF loop handling both continuous 40px/s movement and 400ms step easing
  useEffect(() => {
    const loop = (currentTime: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = currentTime;
      }
      const dt = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = currentTime;

      const listWidth = listWidthRef.current || 2424;

      if (isStepAnimatingRef.current) {
        const elapsed = currentTime - stepStartTimeRef.current;
        const progress = Math.min(elapsed / 400, 1);
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        const newOffset =
          stepStartOffsetRef.current +
          (stepTargetOffsetRef.current - stepStartOffsetRef.current) * ease;
        offsetRef.current = newOffset;
        applyTransform(newOffset);

        if (progress >= 1) {
          isStepAnimatingRef.current = false;
          // Normalize offset strictly within [0, listWidth)
          while (offsetRef.current >= listWidth) offsetRef.current -= listWidth;
          while (offsetRef.current < 0) offsetRef.current += listWidth;
          applyTransform(offsetRef.current);

          // Resume auto-movement ~3 seconds after last arrow click / swipe
          if (stepResumeTimerRef.current) clearTimeout(stepResumeTimerRef.current);
          stepResumeTimerRef.current = window.setTimeout(() => {
            isPausedForStepRef.current = false;
          }, 3000);
        }
      } else {
        const canAutoMove =
          !isReducedMotionRef.current &&
          isIntersectingRef.current &&
          isTabVisibleRef.current &&
          !isHoveredRef.current &&
          !isFocusedRef.current &&
          !isTouchingRef.current &&
          !isInteractionPausedRef.current &&
          !isPausedForStepRef.current;

        if (canAutoMove) {
          offsetRef.current += 40 * dt;
          if (listWidth > 0 && offsetRef.current >= listWidth) {
            offsetRef.current -= listWidth;
          }
          applyTransform(offsetRef.current);
        }
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [applyTransform]);

  // Initial measurement & resize listener
  useEffect(() => {
    updateMeasurements();
    window.addEventListener('resize', updateMeasurements);
    return () => window.removeEventListener('resize', updateMeasurements);
  }, [updateMeasurements]);

  // Reduced motion media query listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    isReducedMotionRef.current = media.matches;

    const handler = (e: MediaQueryListEvent) => {
      isReducedMotionRef.current = e.matches;
      if (e.matches) {
        lastTimeRef.current = null;
      }
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  // IntersectionObserver: Pause when off-screen to save battery
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      isIntersectingRef.current = entry.isIntersecting;
      if (!entry.isIntersecting) {
        lastTimeRef.current = null;
      }
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // VisibilityChange: Pause when browser tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      const isVisible = document.visibilityState === 'visible';
      isTabVisibleRef.current = isVisible;
      if (!isVisible) {
        lastTimeRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Mouse hover handlers: pause on hover, resume ~1s after mouse leaves
  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    if (interactionResumeTimerRef.current) {
      clearTimeout(interactionResumeTimerRef.current);
      interactionResumeTimerRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    isInteractionPausedRef.current = true;
    if (interactionResumeTimerRef.current) clearTimeout(interactionResumeTimerRef.current);
    interactionResumeTimerRef.current = window.setTimeout(() => {
      isInteractionPausedRef.current = false;
    }, 1000);
  };

  // Keyboard focus handlers: pause while track or controls are focused, resume ~1s after blur
  const handleFocus = () => {
    isFocusedRef.current = true;
    if (interactionResumeTimerRef.current) {
      clearTimeout(interactionResumeTimerRef.current);
      interactionResumeTimerRef.current = null;
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    const currentTarget = e.currentTarget;
    requestAnimationFrame(() => {
      if (!currentTarget.contains(document.activeElement)) {
        isFocusedRef.current = false;
        isInteractionPausedRef.current = true;
        if (interactionResumeTimerRef.current) clearTimeout(interactionResumeTimerRef.current);
        interactionResumeTimerRef.current = window.setTimeout(() => {
          isInteractionPausedRef.current = false;
        }, 1000);
      }
    });
  };

  // Touch handlers: pause while touching, horizontal swipe moves one card in swipe direction
  const handleTouchStart = (e: React.TouchEvent) => {
    isTouchingRef.current = true;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchDeltaXRef.current = 0;
    if (interactionResumeTimerRef.current) {
      clearTimeout(interactionResumeTimerRef.current);
      interactionResumeTimerRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
  };

  const handleTouchEnd = () => {
    isTouchingRef.current = false;
    const deltaX = touchDeltaXRef.current;

    // Detect horizontal swipe
    if (deltaX < -40) {
      // Swiped left -> advance to next celebration
      triggerStep('next');
    } else if (deltaX > 40) {
      // Swiped right -> go back to previous celebration
      triggerStep('prev');
    } else {
      // Regular touch without swipe -> resume ~1s after touch ends
      isInteractionPausedRef.current = true;
      if (interactionResumeTimerRef.current) clearTimeout(interactionResumeTimerRef.current);
      interactionResumeTimerRef.current = window.setTimeout(() => {
        isInteractionPausedRef.current = false;
      }, 1000);
    }
  };

  const renderCardList = (isDuplicate = false) => (
    <ul
      ref={!isDuplicate ? firstGroupRef : undefined}
      className="celebrations-cards-group"
      aria-hidden={isDuplicate ? 'true' : undefined}
      aria-label={!isDuplicate ? 'Celebration types' : undefined}
      inert={isDuplicate ? true : undefined}
    >
      {CELEBRATIONS.map((item, index) => (
        <li key={`${isDuplicate ? 'dup-' : ''}${item.id}`} className="celebration-card">
          <Link
            to={`/events/new?type=${item.imageName}`}
            className="celebration-card-link"
            tabIndex={isDuplicate ? -1 : 0}
          >
            <div className="celebration-image-wrapper">
              <img
                src={`/celebrations/${item.imageName}.webp`}
                srcSet={`/celebrations/${item.imageName}-750.webp 750w, /celebrations/${item.imageName}.webp 1500w`}
                sizes="(min-width: 1024px) 380px, (min-width: 640px) 320px, 280px"
                alt={item.altText}
                width={750}
                height={500}
                loading={index === 0 && !isDuplicate ? 'eager' : 'lazy'}
                className="celebration-card-image"
              />
            </div>
            <div className="celebration-card-content">
              <div className="celebration-card-header">
                <h3 className="celebration-card-title">{item.title}</h3>
                <span className="celebration-card-cta" aria-hidden="true">
                  <span>Plan</span>
                  <ArrowRight size={14} />
                </span>
              </div>
              <p className="celebration-card-desc">{item.description}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <section
      ref={sectionRef}
      id="celebrations"
      className="celebrations-section"
      aria-labelledby="celebrations-heading"
    >
      <Container>
        <SectionHeading
          headingId="celebrations-heading"
          heading="Every celebration, your way"
          intro="One planner that adapts to the occasion, whether it's a three-day wedding or a Sunday birthday lunch."
        />

        {/* Continuous Marquee Track Wrapper */}
        <div
          className="celebrations-marquee-wrapper"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div ref={trackRef} className="celebrations-marquee-track">
            {/* First copy: Accessible list for screen readers */}
            {renderCardList(false)}

            {/* Second copy: Duplicate for seamless loop, inert & aria-hidden */}
            {renderCardList(true)}
          </div>
        </div>

        {/* Previous and Next Circular 44px Arrow Buttons */}
        <div className="celebrations-nav-buttons" onFocus={handleFocus} onBlur={handleBlur}>
          <button
            type="button"
            className="celebrations-arrow-btn"
            aria-label="Previous celebration"
            onClick={() => triggerStep('prev')}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="celebrations-arrow-btn"
            aria-label="Next celebration"
            onClick={() => triggerStep('next')}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </Container>
    </section>
  );
};
