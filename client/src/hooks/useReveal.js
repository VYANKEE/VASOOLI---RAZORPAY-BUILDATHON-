import { useEffect, useRef } from "react";

// Attaches an IntersectionObserver that adds "in-view" to elements with
// class "reveal" as they scroll into the viewport — powers the landing
// page's scroll-reveal storytelling without a heavy animation library.
//
// A MutationObserver backs this up: several .reveal elements on the
// landing page (hero stats, floating cards, the stats strip) only exist
// once an async metrics fetch resolves, i.e. after this effect's initial
// querySelectorAll already ran. Without watching for new nodes those
// elements would never get observed and would sit permanently at
// opacity: 0. This catches them (and anything else added later) as soon
// as they mount.
export function useReveal(deps = []) {
  const scopeRef = useRef(null);

  useEffect(() => {
    const scope = scopeRef.current || document;
    const observed = new WeakSet();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    function observeAll(root) {
      if (root.nodeType !== 1) return;
      const candidates = root.matches?.(".reveal") ? [root, ...root.querySelectorAll(".reveal")] : root.querySelectorAll(".reveal");
      candidates.forEach((el) => {
        if (!observed.has(el)) {
          observed.add(el);
          observer.observe(el);
        }
      });
    }

    observeAll(scope);

    const mo = new MutationObserver((mutations) => {
      mutations.forEach((m) => m.addedNodes.forEach((node) => observeAll(node)));
    });
    mo.observe(scope, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scopeRef;
}
