import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const indexPath = resolve(dist, 'index.html');
let html = await readFile(indexPath, 'utf8');

function assetPath(value) {
  const clean = value.replace(/^\.\//, '').replace(/^\//, '');
  return resolve(dist, clean);
}

const stylesheetPattern = /<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/gi;
for (const match of [...html.matchAll(stylesheetPattern)]) {
  const href = match[1];
  const css = await readFile(assetPath(href), 'utf8');
  html = html.replace(match[0], `<style data-oncheck-offline>\n${css}\n</style>`);
}

const scriptPattern = /<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/gi;
for (const match of [...html.matchAll(scriptPattern)]) {
  const src = match[1];
  const js = (await readFile(assetPath(src), 'utf8')).replace(/<\/script/gi, '<\\/script');
  html = html.replace(match[0], `<script type="module" data-oncheck-offline>\n${js}\n</script>`);
}

html = html
  .replace(/\s*<link\s+rel="manifest"[^>]*>/gi, '')
  .replace(/\s*<link\s+rel="icon"[^>]*>/gi, '')
  .replace('<title>ONCHECK</title>', '<title>ONCHECK · Offline</title>')
  .replace('</head>', '<meta name="oncheck-build" content="single-file-offline" /></head>');

const output = resolve(dist, 'oncheck-offline.html');
await writeFile(output, html, 'utf8');
console.log(`Created ${output}`);
