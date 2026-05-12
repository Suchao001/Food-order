import { defineNuxtConfig } from "nuxt/config";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@vite-pwa/nuxt'],
  app: {
    head: {
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' }
      ],
      meta: [
        { name: 'theme-color', content: '#f97316' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' }
      ]
    }
  },
  runtimeConfig: {
    accessPin: process.env.ACCESS_PIN,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    vapidEmail: process.env.VAPID_EMAIL,
    public: {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY
    }
  },
  pwa: {
    strategies: 'injectManifest',
    srcDir: 'service-worker',
    filename: 'sw.ts',
    registerType: 'autoUpdate',
    manifest: {
      name: 'Food Order',
      short_name: 'FoodOrder',
      description: 'สั่งอาหาร',
      theme_color: '#f97316',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico}']
    },
    devOptions: {
      enabled: true,
      type: 'module'
    }
  }
})
