// Renders the cover images: node scripts/covers.mjs → out/covers/*.png
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition, openBrowser } from '@remotion/renderer';

const COVERS = [
  ['CoverWide', 'bunderground-cover-3840x2160.png', 2],
  ['CoverOG', 'bunderground-og-1200x630.png', 1],
  ['CoverHeader', 'bunderground-header-920x430.png', 1],
  ['CoverTall', 'bunderground-capsule-1200x1800.png', 2],
];
const FRAME = 90;
fs.mkdirSync(path.resolve('out/covers'), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const puppeteerInstance = await openBrowser('chrome');
for (const [id, file, scale] of COVERS) {
  const composition = await selectComposition({ serveUrl, id, puppeteerInstance });
  const output = path.resolve('out/covers', file);
  await renderStill({ serveUrl, composition, frame: FRAME, output, imageFormat: 'png', scale, puppeteerInstance, timeoutInMilliseconds: 120000 });
  console.log('✓', output);
}
await puppeteerInstance.close({ silent: true });
