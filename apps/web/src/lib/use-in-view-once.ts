import { useEffect, useRef, type RefObject } from "react";

/**
 * Calls onIntersect the first time the element enters the viewport, then
 * stops observing. The callback is kept in a ref so callers can pass inline
 * closures without re-subscribing the observer.
 */
export function useInViewOnce(
  ref: RefObject<Element | null>,
  onIntersect: () => void,
  options?: { threshold?: number; rootMargin?: string },
): void {
  const cbRef = useRef(onIntersect);
  useEffect(() => {
    cbRef.current = onIntersect;
  });

  const { threshold = 0.12, rootMargin } = options ?? {};
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          cbRef.current();
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin]);
}
