// vite.config.js
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'public/*.hdr', dest: '' }  // Copies HDR files to the output directory
      ]
    })
  ],
  server: {
    open: true,  // Automatically open in browser
  }
});
