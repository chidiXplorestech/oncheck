import './mobile.css';
import './workout-mobile.css';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let deferredPrompt: InstallPromptEvent | null = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function installButton() {
  let button = document.querySelector<HTMLButtonElement>('#oncheck-install');
  if (button) return button;
  button = document.createElement('button');
  button.id = 'oncheck-install';
  button.className = 'mobile-install';
  button.type = 'button';
  button.textContent = 'INSTALL ONCHECK';
  button.hidden = true;
  document.body.append(button);
  return button;
}

function showIOSInstructions() {
  const dialog = document.createElement('dialog');
  dialog.className = 'install-sheet';
  dialog.innerHTML = `<div><span>ONCHECK · MOBILE</span><h2>Add ONCHECK to your Home Screen</h2><p>In Safari, tap the <strong>Share</strong> button, choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>. ONCHECK will open like an app and can keep working after it has been loaded once.</p><button type="button">GOT IT</button></div>`;
  document.body.append(dialog);
  dialog.querySelector('button')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
  } catch (error) {
    console.warn('ONCHECK service worker registration failed', error);
  }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event as InstallPromptEvent;
  if (!isStandalone()) installButton().hidden = false;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  installButton().hidden = true;
});

window.addEventListener('DOMContentLoaded', () => {
  const button = installButton();
  if (!isStandalone() && isIOS()) button.hidden = false;
  button.addEventListener('click', async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      button.hidden = true;
      return;
    }
    if (isIOS()) showIOSInstructions();
  });
  void registerServiceWorker();
});
