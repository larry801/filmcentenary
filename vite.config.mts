import {defineConfig} from 'vite'
import {fileURLToPath} from "node:url";
import react from '@vitejs/plugin-react'
import type {Plugin} from 'vite'

const base = "/";

// The running bundle and the server must agree on which build is current, so
// `VersionChecker` can reload a stale tab after a deploy. The version is baked
// into the bundle here and written next to it as `version.json`, which the
// server serves from the build directory.
const APP_VERSION = new Date().toISOString();

const versionFile = (): Plugin => ({
    name: 'film-version-file',
    apply: 'build',
    generateBundle() {
        this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({version: APP_VERSION}),
        });
    },
});

// https://vite.dev/config/
export default defineConfig({
    base,
    define: {
        // constant/cards.ts builds card image URLs from this instead of
        // `import.meta.env.BASE_URL`, because Jest's CommonJS runtime cannot
        // parse `import.meta`. Keep it equal to `base`.
        __VQ_BASE_URL__: JSON.stringify(base),
        __APP_VERSION__: JSON.stringify(APP_VERSION),
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
        versionFile(),
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
