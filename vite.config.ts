import {defineConfig, splitVendorChunkPlugin} from 'vite'
import {resolve} from "path";
import reactRefresh from '@vitejs/plugin-react-refresh'

// https://vitejs.dev/config/
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
        reactRefresh(),
        splitVendorChunkPlugin()
    ],
    resolve: {
        alias: [
            {
                find: /^@material-ui\/icons\/(.*)/,
                replacement: "@material-ui/icons/esm/$1",
            },
            {
                find: /^@material-ui\/core\/(.+)/,
                replacement: "@material-ui/core/es/$1",
            },
            {
                find: /^@material-ui\/core$/,
                replacement: "@material-ui/core/es",
            },
            {
                find: 'src',
                replacement: resolve(__dirname, 'src')
            }
        ],
    },

    server: {
        cors: true,
        host: '0.0.0.0' // debug in lan
    }
})
