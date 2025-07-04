import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs/promises';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),
      name: 'GaltonBoard',
      fileName: (format) => `galton-board-js.${format}.js`,
      formats: ['es', 'iife'],
    },
    minify: true,
  },
  plugins: [
    {
      name: 'copy-demo-html',
      writeBundle: async () => {
        const demoHtmlPath = path.resolve(__dirname, 'index.html');
        const outHtmlPath = path.resolve(__dirname, 'dist/index.html');
        let html = await fs.readFile(demoHtmlPath, 'utf8');
        html = html.replace(
          /<script type="module" src="[^"]+"><\/script>/,
          `<script type="module" src="galton-board-js.iife.js"></script>`,
        );
        await fs.writeFile(outHtmlPath, html);
      },
    },
  ],
});
