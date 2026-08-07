import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [
    basicSsl(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'K-Flow Ride',
        short_name: 'K-Flow',
        description: 'Cyclist tracking and social app',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Bicycle_icon.svg/512px-Bicycle_icon.svg.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Bicycle_icon.svg/192px-Bicycle_icon.svg.png',
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
