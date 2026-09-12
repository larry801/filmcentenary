import {defineConfig} from 'vite'
import {fileURLToPath} from "node:url";
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    build: {
        outDir: 'build',
        rollupOptions: {
            output: {
                manualChunks(id: string) {
                    // creating a chunk to react routes deps. Reducing the vendor chunk size
                    if (
                        id.includes('react-router-dom') ||
                        id.includes('react-router') ||
                        id.includes('boardgame.io')
                    ) {
                        return '@react-router';
                    }
                    if (
                        id.includes('visx') ||
                        id.includes('d3') ||
                        id.includes('material')
                    ) {
                        return 'visx';
                    }
                },
            }
        }
    },
    plugins: [
        react(),
    ],
    resolve: {
        alias: [
            {
                find: 'src',
                replacement: fileURLToPath(new URL('./src', import.meta.url))
            }
        ],
    },

    server: {
        cors: true,
        host: '0.0.0.0' // debug in lan
    }
})
