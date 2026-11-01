/**
 * Scrolls to an in-page section by id. Returns false when the section is not on this page.
 * Honours prefers-reduced-motion (DESIGN_SYSTEM.md §8): jumps instead of animating.
 */
export function scrollToSection(id: string): boolean {
  const element = document.getElementById(id);
  if (!element) return false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 'instant', not 'auto': 'auto' defers to the CSS scroll-behavior on <html>, which is smooth
  element.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth' });
  return true;
}
