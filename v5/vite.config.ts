import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'DARTS AI · 7-Day Starter',
        short_name: 'DARTS AI',
        description: 'AI × Shopify 7-Day Starter by DARTS AI Academy',
        theme_color: '#1b0f3b',
        background_color: '#0f0a1e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Precache only the Latin font files; Malayalam and other subsets load on demand.
        globIgnores: ['**/*-malayalam-*.woff2', '**/*-latin-ext-*.woff2', '**/*-devanagari-*.woff2', '**/*-cyrillic*.woff2', '**/*-greek*.woff2', '**/*-vietnamese-*.woff2'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30 } },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: ({ url, request }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/learn_settings') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: { cacheName: 'settings', networkTimeoutSeconds: 6, expiration: { maxEntries: 10 } },
          },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'charts', test: /node_modules[\\/](recharts|d3-|victory-vendor|es-toolkit|redux|@reduxjs|immer|reselect|decimal\.js)/, priority: 20 },
            { name: 'vendor', test: /node_modules[\\/](@supabase|zustand|lucide-react)/, priority: 10 },
          ],
        },
      },
    },
  },
})
