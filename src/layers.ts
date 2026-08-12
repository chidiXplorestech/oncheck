import './system-layer';
import './media-layer';
import './workout-layer';
import './pwa';

document.documentElement.dataset.oncheckLayers = 'ready';

void import('./calendar-layer')
  .then(() => {
    document.documentElement.dataset.oncheckCalendarImport = 'ready';
  })
  .catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    document.documentElement.dataset.oncheckCalendarImport = 'error';
    document.documentElement.dataset.oncheckCalendarError = message;
    console.error('ONCHECK calendar layer failed to load', error);
  });
