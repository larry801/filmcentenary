import {defineConfig} from 'vite'
import {fileURLToPath} from "node:url";
import react from '@vitejs/plugin-react'

const base = "/";

// https://vite.dev/config/
export default defineConfig({
    base,
    define: {
        // constant/cards.ts builds card image URLs from this instead of
        // `import.meta.env.BASE_URL`, because Jest's CommonJS runtime cannot
        // parse `import.meta`. Keep it equal to `base`.
        __VQ_BASE_URL__: JSON.stringify(base),
    },
    build: {
        outDir: 'build',
        rolldownOptions: {
            output: {
                codeSplitting: {
                    // Keep vendor families in their own chunks. The songJinn map
                    // geometry is split into parts because a single module that
                    // large cannot be divided by the bundler.
                    groups: [
                        {
                            name: 'react',
                            test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                        },
                        {
                            name: 'react-router',
                            test: /node_modules[\\/](react-router|react-router-dom)[\\/]/,
                        },
                        {
                            name: 'mui',
                            test: /node_modules[\\/](@mui|@emotion)[\\/]/,
                        },
                        {
                            name: 'boardgame',
                            test: /node_modules[\\/](boardgame\.io|@boardgame\.io|socket\.io|socket\.io-client|socket\.io-parser|engine\.io|engine\.io-client|redux|immer|lodash|nanoid)[\\/]/,
                        },
                        {
                            name: 'songjinn-map-0',
                            test: /songJinn[\\/]constant[\\/]map-part-0\.ts/,
                        },
                        {
                            name: 'songjinn-map-1',
                            test: /songJinn[\\/]constant[\\/]map-part-1\.ts/,
                        },
                        {
                            name: 'songjinn-map-2',
                            test: /songJinn[\\/]constant[\\/]map-part-2\.ts/,
                        },
                        {
                            name: 'songjinn-map-3',
                            test: /songJinn[\\/]constant[\\/]map-part-3\.ts/,
                        },
                        {
                            name: 'visx',
                            test: /node_modules[\\/](@visx|d3|d3-[^\\/]+)[\\/]/,
                        },
                    ],
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
