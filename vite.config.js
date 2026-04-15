import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, process.cwd(), '')
  const curatorPlacesCuratorIdMode =
    rootEnv.CURATOR_PLACES_CURATOR_ID_MODE ||
    rootEnv.VITE_CURATOR_PLACES_CURATOR_ID_MODE ||
    'both'

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_CURATOR_PLACES_CURATOR_ID_MODE': JSON.stringify(
        curatorPlacesCuratorIdMode
      ),
    },
    server: {
      port: 5173,
      host: true,
      cors: true,
      proxy: {
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
  }
})
