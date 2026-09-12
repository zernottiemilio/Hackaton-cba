import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: actualiza el SW en cada carga sin pedirle nada al usuario.
      // Se cambió de 'prompt' → 'autoUpdate' porque el toast requería acción del
      // usuario y bloqueaba ver deploys nuevos hasta que aceptara. Para una demo
      // de hackaton necesitamos que cada push llegue instantáneo.
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // El SW cachea HTML/JS/CSS/imágenes durante el build (precaching) y además
      // configuramos runtime caching para fuentes externas y API GET.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        // El bundle superó los 2 MB default con el módulo tokenizadas (leaflet +
        // recharts + framer + turf). Subimos el límite hasta que el code-splitting
        // por route corte el bundle inicial. 4 MB deja margen sin ser absurdo.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Google Fonts CSS
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Google Fonts files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Inter font CSS (rsms)
            urlPattern: /^https:\/\/rsms\.me\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'rsms-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            // Backend API — GETs vacíos sobreviven offline con la última respuesta cacheada
            urlPattern: ({ url, request }) => {
              return request.method === 'GET' && /\/api\/v1\//.test(url.pathname);
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'agrofacil-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      includeAssets: [
        'favicon.svg',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'apple-touch-icon.svg',
      ],

      manifest: {
        name: 'AgroFácil',
        short_name: 'AgroFácil',
        description: 'Costo, margen y punto de equilibrio por lote, en USD y qq/ha.',
        theme_color: '#047C00',
        background_color: '#F4F7F4',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'es-AR',
        categories: ['business', 'productivity', 'agriculture'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },

      devOptions: {
        // PWA off en dev por default. Si lo querés probar local: { enabled: true }.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    host: true,
  },
});
