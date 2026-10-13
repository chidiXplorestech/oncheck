import './brand.css';
import { trackMark } from './identity';

const BRAND_FROM = 'ONCHECK';
const BRAND_TO = 'ONTRACK';

function lockup(node: HTMLElement) {
  if (node.dataset.ontrackLockup === '1') return;
  node.dataset.ontrackLockup = '1';
  node.innerHTML = `<span class="ontrack-brand-mark">${trackMark()}</span><span class="ontrack-wordmark">ontrack<span class="ontrack-brand-dot">.</span></span>`;
}

function replaceBrandText(root: ParentNode = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue?.includes(BRAND_FROM)) {
      node.nodeValue = node.nodeValue.replaceAll(BRAND_FROM, BRAND_TO);
    }
    node = walker.nextNode();
  }

  document.querySelectorAll<HTMLElement>('.brand,.auth-brand').forEach(lockup);
  document.title = BRAND_TO;
  document.querySelector('meta[name="description"]')?.setAttribute(
    'content',
    'ONTRACK — make room for what matters. Your goals, daily focus and week in one place.',
  );
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', BRAND_TO);
}

let queued = false;
function queueBrandPass() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    replaceBrandText();
  });
}

const observer = new MutationObserver(queueBrandPass);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
replaceBrandText();

document.documentElement.dataset.brand = 'ontrack';
