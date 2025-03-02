import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  // Log environment variables (without sensitive values)
  console.log('Environment mode:', mode)
  console.log('Environment variables loaded:', Object.keys(env).filter(key => key.startsWith('VITE_')))

  return {
    plugins: [
      react(),
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    server: {
      port: 4000,
      strictPort: true,
      host: 'localhost',
      open: true,
      https: false,
    },
    define: {
      'process.env.VITE_INFURA_PROJECT_ID': JSON.stringify(env.VITE_INFURA_PROJECT_ID),
      'process.env.VITE_PRIVATE_KEY': JSON.stringify(env.VITE_PRIVATE_KEY),
      'import.meta.env.VITE_INFURA_PROJECT_ID': JSON.stringify(env.VITE_INFURA_PROJECT_ID),
      'import.meta.env.VITE_PRIVATE_KEY': JSON.stringify(env.VITE_PRIVATE_KEY),
    },
    resolve: {
      alias: {
        process: 'process/browser',
        stream: 'stream-browserify',
        buffer: 'buffer'
      }
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
      }
    },
    build: {
      rollupOptions: {
        external: ['hardhat'],
      },
      sourcemap: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
        },
      },
    }
  }
})
