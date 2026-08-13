import './media-mobile-runtime.css';

type StoredMedia = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  blob: Blob;
  goalIds: string[];
};

const DB_NAME = 'oncheck-media-v2';
const DB_VERSION = 1;
const STORE_NAME = 'media';
const COVER_KEY = 'oncheck-cover-map-v2';

let activeInput: HTMLInputElement | null = null;
let mobileSheet: HTMLElement | null = null;

function mobileRuntimeEnabled() {
  return window.matchMedia('(max-width: 900px)').matches ||
    window.matchMedia('(pointer: coarse)').matches ||
    /iphone|ipad|ipod|android/i.test(navigator.userAgent);
}

function uid() {
  return crypto.randomUUID();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open ONCHECK media storage.'));
  });
}

function writeRecord(db: IDBDatabase, record: StoredMedia) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Unable to save media.'));
    tx.onabort = () => reject(tx.error ?? new Error('Media save was aborted.'));
    tx.objectStore(STORE_NAME).put(record);
  });
}

function readAllMedia(db: IDBDatabase) {
  return new Promise<StoredMedia[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll() as IDBRequest<StoredMedia[]>;
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error ?? new Error('Unable to read media.'));
  });
}

function readCoverMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(COVER_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function writeCover(goalId: string, mediaId?: string) {
  const map = readCoverMap();
  if (mediaId) map[goalId] = mediaId;
  else delete map[goalId];
  localStorage.setItem(COVER_KEY, JSON.stringify(map));
}

async function persistStorage() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // Safari decides persistence itself; uploads can still continue.
  }
}

function showMessage(message: string) {
  document.querySelector('.mobile-media-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'mobile-media-toast';
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  window.setTimeout(() => toast.remove(), 2200);
}

async function savePickedFiles(files: File[], goalId?: string, coverGoalId?: string) {
  if (!files.length) return;
  await persistStorage();
  const db = await openDb();
  let firstImageId: string | undefined;

  try {
    for (const [index, file] of files.entries()) {
      const record: StoredMedia = {
        id: uid(),
        name: file.name || `Mobile upload ${index + 1}`,
        type: file.type || 'application/octet-stream',
        size: file.size,
        createdAt: Date.now() + index,
        blob: file,
        goalIds: goalId || coverGoalId ? [goalId ?? coverGoalId ?? ''].filter(Boolean) : [],
      };
      await writeRecord(db, record);
      if (!firstImageId && record.type.startsWith('image/')) firstImageId = record.id;
    }

    if (coverGoalId && firstImageId) writeCover(coverGoalId, firstImageId);
    sessionStorage.setItem('oncheck-mobile-media-result', coverGoalId ? 'Cover updated.' : `${files.length} media item${files.length === 1 ? '' : 's'} added.`);
    window.location.reload();
  } catch (error) {
    console.error('ONCHECK mobile media upload failed', error);
    let detail = '';
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (estimate?.quota) detail = ` Browser storage available: about ${Math.round(estimate.quota / 1024 / 1024)} MB.`;
    } catch {
      // Ignore quota reporting failures.
    }
    alert(`ONCHECK could not save that media on this device.${detail} Try a smaller file or check Safari/Chrome site storage permissions.`);
  } finally {
    db.close();
  }
}

function cleanupInput(input: HTMLInputElement) {
  window.setTimeout(() => {
    if (activeInput === input) activeInput = null;
    input.remove();
  }, 0);
}

function openNativePicker(options: { goalId?: string; coverGoalId?: string; imagesOnly?: boolean } = {}) {
  activeInput?.remove();

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = options.imagesOnly || options.coverGoalId ? 'image/*' : 'image/*,video/*';
  input.multiple = !options.coverGoalId;
  input.className = 'oncheck-native-media-input';
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  document.body.append(input);
  activeInput = input;

  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    if (!files.length) {
      cleanupInput(input);
      return;
    }
    void savePickedFiles(files, options.goalId, options.coverGoalId).finally(() => cleanupInput(input));
  }, { once: true });

  input.addEventListener('cancel', () => cleanupInput(input), { once: true });

  const picker = input as HTMLInputElement & { showPicker?: () => void };
  try {
    if (typeof picker.showPicker === 'function') picker.showPicker();
    else input.click();
  } catch {
    input.click();
  }
}

function closeSheet() {
  mobileSheet?.remove();
  mobileSheet = null;
  document.documentElement.classList.remove('mobile-media-sheet-open');
}

async function openCoverSheet(goalId: string) {
  closeSheet();

  const overlay = document.createElement('div');
  overlay.className = 'mobile-media-sheet';
  overlay.innerHTML = `
    <button type="button" class="mobile-media-backdrop" data-mobile-media-close aria-label="Close cover picker"></button>
    <section class="mobile-media-panel" role="dialog" aria-modal="true" aria-label="Change goal cover">
      <div class="mobile-media-head">
        <div><span>GOAL MEDIA</span><h2>Change cover</h2><p>Use an image already on this phone or add a new one.</p></div>
        <button type="button" class="mobile-media-close" data-mobile-media-close aria-label="Close">×</button>
      </div>
      <div class="mobile-media-actions">
        <button type="button" class="primary" data-mobile-media-upload-cover>+ Upload image</button>
        <button type="button" class="secondary" data-mobile-media-remove-cover>Remove cover</button>
      </div>
      <div class="mobile-media-existing"><p>Loading your images…</p></div>
    </section>`;

  document.body.append(overlay);
  mobileSheet = overlay;
  document.documentElement.classList.add('mobile-media-sheet-open');

  overlay.querySelectorAll<HTMLElement>('[data-mobile-media-close]').forEach(button => {
    button.addEventListener('click', closeSheet);
  });

  overlay.querySelector<HTMLElement>('[data-mobile-media-upload-cover]')?.addEventListener('click', () => {
    closeSheet();
    openNativePicker({ coverGoalId: goalId, imagesOnly: true });
  });

  overlay.querySelector<HTMLElement>('[data-mobile-media-remove-cover]')?.addEventListener('click', () => {
    writeCover(goalId);
    sessionStorage.setItem('oncheck-mobile-media-result', 'Cover removed.');
    closeSheet();
    window.location.reload();
  });

  const existing = overlay.querySelector<HTMLElement>('.mobile-media-existing');
  if (!existing) return;

  try {
    const db = await openDb();
    const images = (await readAllMedia(db)).filter(item => item.type.startsWith('image/'));
    db.close();
    existing.innerHTML = '';

    if (!images.length) {
      const empty = document.createElement('p');
      empty.className = 'mobile-media-empty';
      empty.textContent = 'No images have been added on this device yet.';
      existing.append(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'mobile-media-grid';
    const current = readCoverMap()[goalId];
    for (const imageRecord of images) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = `mobile-media-option ${current === imageRecord.id ? 'selected' : ''}`;
      option.dataset.mobileCoverId = imageRecord.id;

      const image = document.createElement('img');
      image.src = URL.createObjectURL(imageRecord.blob);
      image.alt = imageRecord.name;
      image.addEventListener('load', () => URL.revokeObjectURL(image.src), { once: true });
      image.addEventListener('error', () => URL.revokeObjectURL(image.src), { once: true });

      const label = document.createElement('span');
      label.textContent = imageRecord.name;
      option.append(image, label);
      option.addEventListener('click', () => {
        writeCover(goalId, imageRecord.id);
        sessionStorage.setItem('oncheck-mobile-media-result', 'Cover updated.');
        closeSheet();
        window.location.reload();
      });
      grid.append(option);
    }
    existing.append(grid);
  } catch (error) {
    console.error('ONCHECK mobile cover library failed', error);
    existing.innerHTML = '<p class="mobile-media-empty">Your saved media library could not be opened on this device.</p>';
  }
}

function stop(event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

// This listener is imported before media-layer.ts so the mobile path wins before
// the desktop-oriented document capture handler runs.
document.addEventListener('click', event => {
  if (!mobileRuntimeEnabled()) return;
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
  if (!target) return;

  if (target.dataset.action === 'upload-media') {
    stop(event);
    const goalId = target.closest('.editor-aside')?.querySelector<HTMLElement>('.preview-cover[data-id]')?.dataset.id;
    openNativePicker({ goalId });
    return;
  }

  if (target.dataset.action === 'goal-cover') {
    stop(event);
    const goalId = target.dataset.id;
    if (goalId) void openCoverSheet(goalId);
  }
}, true);

window.addEventListener('DOMContentLoaded', () => {
  const message = sessionStorage.getItem('oncheck-mobile-media-result');
  if (!message) return;
  sessionStorage.removeItem('oncheck-mobile-media-result');
  showMessage(message);
});
