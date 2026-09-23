// Renders a handful of frames for quick visual review: node scripts/stills.mjs 60 400 960 ...
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition, openBrowser } from '@remotion/renderer';

const frames = process.argv.slice(2).map(Number);
const browserExecutable = process.env.CHROME || null;
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const puppeteerInstance = await openBrowser('chrome', { browserExecutable });
const composition = await selectComposition({ serveUrl, id: 'Trailer', browserExecutable, puppeteerInstance });
for (const frame of frames) {
  const output = path.resolve(`out/still-${frame}.jpg`);
  await renderStill({ serveUrl, composition, frame, output, imageFormat: 'jpeg', jpegQuality: 80, browserExecutable, puppeteerInstance, timeoutInMilliseconds: 120000 });
  console.log('rendered', output);
}
await puppeteerInstance.close({ silent: true });
