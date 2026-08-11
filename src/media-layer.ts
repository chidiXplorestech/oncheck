import './media-layer.css';

type StoredMedia = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  blob: Blob;
  goalIds: string[];
};

type LegacyState = {
  media?: string[];
  goals?: Array<{ id: string; cover?: string }>;
};

const DB_NAME = 'oncheck-media-v2';
const DB_VERSION = 1;
const STORE_NAME = 'media';
const COVER_KEY = 'oncheck-cover-map-v2';
const STATE_KEY = 'oncheck-state-v1';
const MIGRATION_KEY = 'oncheck-media-migrated-v2';

let dbPromise: Promise<IDBDatabase> | null = null;
let mediaCache: StoredMedia[] = [];
const objectUrls = new Map<string, string>();
let patchScheduled = false;

function uid() {
  return crypto.randomUUID();
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open media storage.'));
  });
  return dbPromise;
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Media storage request failed.'));
  });
}

async function listMedia(): Promise<StoredMedia[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const records = await idbRequest(tx.objectStore(STORE_NAME).getAll() as IDBRequest<StoredMedia[]>);
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

async function getMedia(id: string): Promise<StoredMedia | undefined> {
  const cached = mediaCache.find(item => item.id === id);
  if (cached) return cached;
  const db = await openDb();
  return idbRequest(txStore(db, 'readonly').get(id) as IDBRequest<StoredMedia | undefined>);
}

function txStore(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

async function putMedia(record: StoredMedia) {
  const db = await openDb();
  await idbRequest(txStore(db, 'readwrite').put(record));
}

async function removeMedia(id: string) {
  const db = await openDb();
  await idbRequest(txStore(db, 'readwrite').delete(id));
  const url = objectUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(id);

  const covers = readCoverMap();
  let changed = false;
  for (const [goalId, mediaId] of Object.entries(covers)) {
    if (mediaId === id) {
      delete covers[goalId];
      changed = true;
    }
  }
  if (changed) writeCoverMap(covers);
}

function mediaUrl(record: StoredMedia) {
  const existing = objectUrls.get(record.id);
  if (existing) return existing;
  const url = URL.createObjectURL(record.blob);
  objectUrls.set(record.id, url);
  return url;
}

function readCoverMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(COVER_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function writeCoverMap(map: Record<string, string>) {
  localStorage.setItem(COVER_KEY, JSON.stringify(map));
}

function setCover(goalId: string, mediaId?: string) {
  const map = readCoverMap();
  if (mediaId) map[goalId] = mediaId;
  else delete map[goalId];
  writeCoverMap(map);
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function migrateLegacyMedia() {
  if (localStorage.getItem(MIGRATION_KEY) === '1') return false;
  let state: LegacyState;
  try {
    state = JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}') as LegacyState;
  } catch {
    localStorage.setItem(MIGRATION_KEY, '1');
    return false;
  }

  let changed = false;
  const coverMap = readCoverMap();

  for (const [index, source] of (state.media ?? []).entries()) {
    if (!source.startsWith('data:')) continue;
    try {
      const blob = await dataUrlToBlob(source);
      await putMedia({
        id: uid(),
        name: `Imported media ${index + 1}`,
        type: blob.type || 'image/jpeg',
        size: blob.size,
        createdAt: Date.now() + index,
        blob,
        goalIds: [],
      });
      changed = true;
    } catch (error) {
      console.warn('ONCHECK: unable to migrate one legacy media item.', error);
    }
  }

  if (state.media?.some(source => source.startsWith('data:'))) {
    state.media = state.media.filter(source => !source.startsWith('data:'));
    changed = true;
  }

  for (const goal of state.goals ?? []) {
    if (!goal.cover?.startsWith('data:')) continue;
    try {
      const blob = await dataUrlToBlob(goal.cover);
      const mediaId = uid();
      await putMedia({
        id: mediaId,
        name: `${goal.id} cover`,
        type: blob.type || 'image/jpeg',
        size: blob.size,
        createdAt: Date.now(),
        blob,
        goalIds: [goal.id],
      });
      coverMap[goal.id] = mediaId;
      delete goal.cover;
      changed = true;
    } catch (error) {
      console.warn('ONCHECK: unable to migrate a legacy cover.', error);
    }
  }

  if (changed) {
    writeCoverMap(coverMap);
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }
  localStorage.setItem(MIGRATION_KEY, '1');
  return changed;
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // Persistence is a browser preference; uploads still work without it.
  }
}

async function addFiles(files: File[], goalId?: string) {
  if (!files.length) return [] as StoredMedia[];
  await requestPersistentStorage();
  const added: StoredMedia[] = [];

  for (const file of files) {
    const record: StoredMedia = {
      id: uid(),
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: Date.now() + added.length,
      blob: file,
      goalIds: goalId ? [goalId] : [],
    };
    try {
      await putMedia(record);
      added.push(record);
    } catch (error) {
      console.error('ONCHECK media upload failed', error);
      const storage = await navigator.storage?.estimate?.();
      const used = storage?.usage ? `${Math.round(storage.usage / 1024 / 1024)} MB used` : 'storage usage unavailable';
      const quota = storage?.quota ? `${Math.round(storage.quota / 1024 / 1024)} MB available to this site` : 'browser quota unavailable';
      alert(`This file could not be saved. ONCHECK does not impose a media-count or 2 MB limit, but your browser/device storage quota still applies. (${used}; ${quota})`);
      break;
    }
  }

  await refreshMedia();
  return added;
}

function chooseFiles(options: { goalId?: string; coverGoalId?: string; imagesOnly?: boolean } = {}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = !options.coverGoalId;
  input.accept = options.imagesOnly || options.coverGoalId ? 'image/*' : 'image/*,video/*';
  input.addEventListener('change', async () => {
    const files = Array.from(input.files ?? []);
    const added = await addFiles(files, options.goalId ?? options.coverGoalId);
    if (options.coverGoalId) {
      const firstImage = added.find(item => item.type.startsWith('image/'));
      if (firstImage) setCover(options.coverGoalId, firstImage.id);
      await refreshMedia();
    }
  }, { once: true });
  input.click();
}

function createPreview(record: StoredMedia, className = '') {
  if (record.type.startsWith('video/')) {
    const video = document.createElement('video');
    video.className = className;
    video.src = mediaUrl(record);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    return video;
  }
  const image = document.createElement('img');
  image.className = className;
  image.src = mediaUrl(record);
  image.alt = record.name;
  image.loading = 'lazy';
  return image;
}

function applyGoalCovers() {
  const coverMap = readCoverMap();
  for (const button of document.querySelectorAll<HTMLElement>('.cover[data-id], .preview-cover[data-id]')) {
    const goalId = button.dataset.id;
    if (!goalId) continue;
    const mediaId = coverMap[goalId];
    const record = mediaCache.find(item => item.id === mediaId && item.type.startsWith('image/'));
    button.querySelectorAll(':scope > img[data-db-cover]').forEach(node => node.remove());
    if (!record) continue;
    const image = createPreview(record, 'db-cover-image');
    image.dataset.dbCover = '1';
    const label = button.querySelector(':scope > em');
    if (label) button.insertBefore(image, label);
    else button.prepend(image);
    button.querySelector(':scope > span')?.setAttribute('hidden', '');
  }
}

function goalIdForMediaStrip(strip: HTMLElement) {
  const editorAside = strip.closest('.editor-aside');
  return editorAside?.querySelector<HTMLElement>('.preview-cover[data-id]')?.dataset.id;
}

function patchMediaStrips() {
  for (const strip of document.querySelectorAll<HTMLElement>('.media-strip')) {
    const goalId = goalIdForMediaStrip(strip);
    const records = goalId
      ? mediaCache.filter(item => item.goalIds.includes(goalId) || item.goalIds.length === 0)
      : mediaCache.slice(0, 8);
    const fingerprint = `${goalId ?? 'global'}:${records.map(item => item.id).join(',')}`;
    if (strip.dataset.dbFingerprint === fingerprint) continue;

    strip.querySelectorAll('[data-db-media]').forEach(node => node.remove());
    const addButton = strip.querySelector('.media-thumb.add');
    for (const record of records) {
      const item = document.createElement(goalId && record.type.startsWith('image/') ? 'button' : 'div');
      item.className = 'media-thumb db-media-thumb';
      item.dataset.dbMedia = record.id;
      if (goalId && record.type.startsWith('image/')) {
        item.setAttribute('type', 'button');
        item.dataset.mediaSetCover = record.id;
        item.dataset.goalId = goalId;
        item.title = `Use ${record.name} as cover`;
      }
      item.append(createPreview(record));
      if (addButton) strip.insertBefore(item, addButton);
      else strip.append(item);
    }
    strip.dataset.dbFingerprint = fingerprint;
  }
}

function patchMediaPage() {
  const grid = document.querySelector<HTMLElement>('.media-grid');
  if (!grid) return;
  const fingerprint = mediaCache.map(item => item.id).join(',');
  if (grid.dataset.dbFingerprint === fingerprint) return;

  grid.querySelectorAll('[data-db-media]').forEach(node => node.remove());
  const addButton = grid.querySelector('.media-add');
  for (const record of mediaCache) {
    const item = document.createElement('article');
    item.className = 'media-item db-media-item';
    item.dataset.dbMedia = record.id;
    item.append(createPreview(record));

    const meta = document.createElement('div');
    meta.className = 'db-media-meta';
    const name = document.createElement('span');
    name.textContent = record.name;
    const size = document.createElement('small');
    size.textContent = `${(record.size / 1024 / 1024).toFixed(record.size > 10_000_000 ? 0 : 1)} MB`;
    meta.append(name, size);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-btn db-media-delete';
    remove.dataset.mediaDbDelete = record.id;
    remove.setAttribute('aria-label', `Delete ${record.name}`);
    remove.textContent = '⌫';

    item.append(meta, remove);
    if (addButton) grid.insertBefore(item, addButton);
    else grid.append(item);
  }
  grid.dataset.dbFingerprint = fingerprint;
}

function patchMediaCount() {
  const heading = document.querySelector<HTMLElement>('.page-head .eyebrow');
  if (heading && heading.textContent?.includes('VISUAL REFERENCES')) {
    heading.textContent = `VISUAL REFERENCES · ${mediaCache.length} ITEM${mediaCache.length === 1 ? '' : 'S'}`;
  }
}

function patchAll() {
  patchScheduled = false;
  applyGoalCovers();
  patchMediaStrips();
  patchMediaPage();
  patchMediaCount();
}

function schedulePatch() {
  if (patchScheduled) return;
  patchScheduled = true;
  requestAnimationFrame(patchAll);
}

async function refreshMedia() {
  mediaCache = await listMedia();
  for (const strip of document.querySelectorAll<HTMLElement>('.media-strip')) delete strip.dataset.dbFingerprint;
  const grid = document.querySelector<HTMLElement>('.media-grid');
  if (grid) delete grid.dataset.dbFingerprint;
  schedulePatch();
}

function openCoverPicker(goalId: string) {
  const dialog = document.createElement('dialog');
  dialog.className = 'media-picker-modal';

  const panel = document.createElement('div');
  panel.className = 'media-picker-panel';
  const header = document.createElement('div');
  header.className = 'media-picker-head';
  const copy = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = 'Change cover';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Choose an existing image or upload a new one.';
  copy.append(title, subtitle);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'icon-btn';
  close.textContent = '×';
  close.addEventListener('click', () => dialog.close());
  header.append(copy, close);

  const actions = document.createElement('div');
  actions.className = 'media-picker-actions';
  const upload = document.createElement('button');
  upload.type = 'button';
  upload.className = 'primary';
  upload.textContent = '+ Upload new image';
  upload.addEventListener('click', () => {
    dialog.close();
    chooseFiles({ coverGoalId: goalId, imagesOnly: true });
  });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'secondary';
  remove.textContent = 'Remove cover';
  remove.addEventListener('click', () => {
    setCover(goalId);
    dialog.close();
    schedulePatch();
  });
  actions.append(upload, remove);

  const grid = document.createElement('div');
  grid.className = 'media-picker-grid';
  const images = mediaCache.filter(item => item.type.startsWith('image/'));
  if (!images.length) {
    const empty = document.createElement('p');
    empty.className = 'media-picker-empty';
    empty.textContent = 'No images in your library yet. Upload one to use it as a cover.';
    grid.append(empty);
  } else {
    for (const record of images) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'media-picker-option';
      option.append(createPreview(record));
      const label = document.createElement('span');
      label.textContent = record.name;
      option.append(label);
      option.addEventListener('click', () => {
        setCover(goalId, record.id);
        dialog.close();
        schedulePatch();
      });
      grid.append(option);
    }
  }

  panel.append(header, actions, grid);
  dialog.append(panel);
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}

function stopMainHandler(event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

document.addEventListener('click', async event => {
  const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action],[data-media-db-delete],[data-media-set-cover]');
  if (!element) return;

  if (element.dataset.action === 'goal-cover') {
    stopMainHandler(event);
    const goalId = element.dataset.id;
    if (goalId) openCoverPicker(goalId);
    return;
  }

  if (element.dataset.action === 'upload-media') {
    stopMainHandler(event);
    const strip = element.closest('.editor-aside')?.querySelector<HTMLElement>('.preview-cover[data-id]');
    chooseFiles({ goalId: strip?.dataset.id });
    return;
  }

  if (element.dataset.mediaSetCover && element.dataset.goalId) {
    stopMainHandler(event);
    setCover(element.dataset.goalId, element.dataset.mediaSetCover);
    schedulePatch();
    return;
  }

  if (element.dataset.mediaDbDelete) {
    stopMainHandler(event);
    const record = await getMedia(element.dataset.mediaDbDelete);
    if (!record) return;
    if (!confirm(`Delete “${record.name}” from ONCHECK media?`)) return;
    await removeMedia(record.id);
    await refreshMedia();
  }
}, true);

const observer = new MutationObserver(schedulePatch);
observer.observe(document.documentElement, { childList: true, subtree: true });

void (async () => {
  try {
    const migrated = await migrateLegacyMedia();
    if (migrated) {
      location.reload();
      return;
    }
    await refreshMedia();
  } catch (error) {
    console.error('ONCHECK media layer could not start.', error);
  }
})();
