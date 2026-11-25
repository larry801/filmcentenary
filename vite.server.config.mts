/**
 * Builds the dependency-free single-file server the Nodaroo deployment uploads.
 *
 * `tsc-bundle` (used by the Docker images) inlines only the repository's own
 * modules and leaves every npm package as a runtime `require`, so that artifact
 * needs `node_modules` next to it. This config bundles the packages in as well,
 * which is what "no dependencies" means here: the output is one file that runs
 * under plain `node` in an empty directory.
 *
 * `pg-native` stays external because `pg` loads it optionally and it is a native
 * binding that cannot be bundled; the FlatFile store the panel uses never
 * reaches it.
 */
import {defineConfig} from 'vite';

export default defineConfig({
    build: {
        ssr: 'server.ts',
        outDir: 'build',
        // The client bundle in build/ has to survive this build.
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
