export interface HorizontalScrollAvailability {
  left: boolean;
  right: boolean;
}

/** Allow a pixel of rounding tolerance at either end of a horizontal scroller. */
export function horizontalScrollAvailability(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
): HorizontalScrollAvailability {
  const maxScroll = Math.max(0, scrollWidth - clientWidth);
  return {
    left: maxScroll > 1 && scrollLeft > 1,
    right: maxScroll > 1 && scrollLeft < maxScroll - 1,
  };
}
