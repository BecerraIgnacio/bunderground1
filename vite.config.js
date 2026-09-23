import { defineConfig } from 'vite';

export default defineConfig({
  // the Remotion trailer project lives in ./trailer and is not part of the game
  server: { watch: { ignored: ['**/trailer/**'] } },
  optimizeDeps: { entries: ['index.html'] },
});
