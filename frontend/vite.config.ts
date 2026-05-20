import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'TW Stock Tracker',
        short_name: 'TWStock',
        description: 'Taiwan stock analysis and portfolio tracking',
        theme_color: '#3b82f6',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) => {
              if (request.method !== 'GET' || request.headers.has('authorization')) {
                return false
              }

              const publicApiPaths = [
                /^\/api\/v1\/stocks$/,
                /^\/api\/v1\/stocks\/batch\/summary$/,
                /^\/api\/v1\/stocks\/[^/]+$/,
                /^\/api\/v1\/stocks\/[^/]+\/quotes\/latest$/,
                /^\/api\/v1\/stocks\/[^/]+\/prices$/,
                /^\/api\/v1\/stocks\/[^/]+\/recommendation$/,
                /^\/api\/v1\/stocks\/[^/]+\/sync-status$/,
                /^\/api\/v1\/stocks\/[^/]+\/peers$/,
                /^\/api\/v1\/stocks\/[^/]+\/fundamentals$/,
                /^\/api\/v1\/stocks\/[^/]+\/profile$/,
                /^\/api\/v1\/stocks\/[^/]+\/target-prices$/,
                /^\/api\/v1\/content-visibility\/public$/,
              ]

              return publicApiPaths.some((pattern) => pattern.test(url.pathname))
            },
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'public-api-cache-v1',
              expiration: {
                maxEntries: 75,
                maxAgeSeconds: 15 * 60, // 15 minutes
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/v1/'),
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|woff|woff2)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/health': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
