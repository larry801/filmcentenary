/**
 * Builds the single-file server the Nodaroo deployment uploads.
 *
 * `tsc-bundle` (used by the Docker images) inlines only the repository's own
 * modules and leaves every npm package as a runtime `require`, so that artifact
 * needs `node_modules` next to it. This config bundles the packages in as well,
 * plus the client the last `yarn build` produced: index.html and the hashed
 * bundles under assets/ travel inside the file as gzipped base64, so the panel
 * needs neither node_modules nor a copy of build/. The artwork stays out — it is
 * committed under public/ and served from the checkout.
 *
 * `pg-native` stays external because `pg` loads it optionally and it is a native
 * binding that cannot be bundled; the FlatFile store the panel uses never
 * reaches it.
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {defineConfig} from 'vite';

const clientBuild = path.join(import.meta.dirname, 'build');

const contentTypes: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
};

/** index.html plus assets/, keyed by the URL the browser asks for. */
const embedClient = (): Record<string, {type: string; body: string}> => {
    const indexHtml = path.join(clientBuild, 'index.html');
    if (!existsSync(indexHtml)) {
        throw new Error(`Missing ${indexHtml}. Run "yarn build" before "yarn build:single".`);
    }
    const files: Record<string, {type: string; body: string}> = {};
    const add = (file: string, url: string) => {
        files[url] = {
            type: contentTypes[path.extname(file)] ?? 'application/octet-stream',
            body: gzipSync(readFileSync(file)).toString('base64'),
        };
    };
    add(indexHtml, '/index.html');
    const assetsDir = path.join(clientBuild, 'assets');
    for (const name of existsSync(assetsDir) ? readdirSync(assetsDir) : []) {
        // Sourcemaps are for debugging the build, not for serving.
        if (!name.endsWith('.map')) {
            add(path.join(assetsDir, name), `/assets/${name}`);
        }
    }
    return files;
};

export default defineConfig({
    // The port Nodaroo allocated for the panel server, baked into the bundle so
    // the uploaded file needs no environment variable to listen correctly.
    define: {
        __PANEL_PORT__: JSON.stringify('25664'),
        __CLIENT_ASSETS__: JSON.stringify(JSON.stringify(embedClient())),
    },
    build: {
        ssr: 'server.ts',
        outDir: 'build',
        // The client bundle this config reads has to survive the build.
        emptyOutDir: false,
        // Unminified on purpose: a stack trace from the panel names real code.
        minify: false,
        target: 'node20',
        rollupOptions: {
            external: ['pg-native'],
            output: {entryFileNames: 'server.js', format: 'cjs'},
        },
    },
    ssr: {noExternal: true},
});
