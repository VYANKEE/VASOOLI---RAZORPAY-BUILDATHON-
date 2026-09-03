import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

// Inertia-based smooth scrolling for the whole app (Lenis — the modern,
// actively-maintained successor to Locomotive Scroll). Runs its own rAF
// loop that drives native scroll with easing; everything else (native
// scroll events, IntersectionObserver-based reveals, anchor links) keeps
// working normally since Lenis still moves the real scrollTop.
export function useSmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
    });

    function raf(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    let frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);
}
