import { gsap } from 'gsap';

// Content is visible before this layer runs. Motion never gates an interaction.
const film = document.createElement('div');
film.className = 'ot-film';
film.setAttribute('aria-hidden', 'true');
film.innerHTML = '<div class="ot-dust"></div>';
document.body.prepend(film);

let queued = false;
let frame = 0;
const seenImages = new WeakSet<HTMLImageElement>();
const contexts = new Map<Element, gsap.Context>();
const seenViews = new WeakSet<Element>();
const media = gsap.matchMedia();

media.add('(prefers-reduced-motion: no-preference)', () => {
  let active = true;
  document.documentElement.dataset.motion = 'gsap';
  const dust = gsap.to('.ot-dust', { y: -18, x: 10, duration: 18, ease: 'sine.inOut', repeat: -1, yoyo: true });
  const visibility = () => { dust.paused(document.hidden); };
  document.addEventListener('visibilitychange', visibility);

  const imageObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const image = entry.target as HTMLImageElement;
      imageObserver.unobserve(image);
      const reveal = () => {
        if (!active || !image.isConnected || !image.naturalWidth) return;
        const context = gsap.context(() => {
          gsap.fromTo(image, { scale: 1.055, opacity: .5 }, { scale: 1, opacity: 1, duration: .8, ease: 'power2.out', clearProps: 'transform,opacity' });
        }, image);
        contexts.set(image, context);
        image.dataset.motionImage = 'revealed';
      };
      if (image.complete) reveal();
      else image.addEventListener('load', reveal, { once: true });
    }
  }, { threshold: .08 });

  const scan = () => {
    queued = false;
    if (!active) return;
    for (const [element, context] of contexts) {
      if (!element.isConnected) { context.revert(); contexts.delete(element); }
    }
    const views = document.querySelectorAll<HTMLElement>('.ot-home,.ot-plans-page,.page-wrap,.calendar-page,.auth-stage,dialog[open]');
    for (const view of views) {
      if (seenViews.has(view)) continue;
      seenViews.add(view);
      const context = gsap.context(() => {
        const texts = view.querySelectorAll('h1,.auth-heading h1,.ot-plan-panel>header h2,.ot-eyebrow');
        if (texts.length) gsap.fromTo(texts, { y: 14, opacity: .25 }, { y: 0, opacity: 1, stagger: .065, duration: .6, ease: 'power3.out', clearProps: 'transform,opacity' });
        const cards = view.querySelectorAll('.ot-today,.ot-priority-row,.ot-collection-card,.auth-atmosphere');
        if (cards.length) gsap.fromTo(cards, { y: 10, opacity: .4 }, { y: 0, opacity: 1, stagger: .045, duration: .55, delay: .1, ease: 'power2.out', clearProps: 'transform,opacity' });
      }, view);
      contexts.set(view, context);
      view.dataset.motionView = 'entered';
    }
    document.querySelectorAll<HTMLImageElement>('.training-visual-banner img,.exercise-visual img,.media-item img,.db-media-item img,.preview-cover img,.media-thumb img').forEach(image => {
      if (seenImages.has(image)) return;
      seenImages.add(image);
      imageObserver.observe(image);
    });
  };
  const queueScan = () => { if (!queued) { queued = true; frame = requestAnimationFrame(scan); } };
  const observer = new MutationObserver(queueScan);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
  queueScan();
  return () => {
    active = false;
    cancelAnimationFrame(frame);
    observer.disconnect();
    imageObserver.disconnect();
    document.removeEventListener('visibilitychange', visibility);
    for (const context of contexts.values()) context.revert();
    contexts.clear();
    dust.kill();
    queued = false;
    document.documentElement.dataset.motion = 'reduced';
  };
});
if (matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.dataset.motion = 'reduced';
