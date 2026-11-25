import {defineConfig} from "@playwright/test";
import base from "./playwright.config";

/**
 * The 3D table's browser suite, on its own.
 *
 * WebGL is software-rasterised on CI, and a table scene is heavy: running it
 * beside the VQ boards starved their ten-second waits.  Its own job keeps the
 * two apart, and `yarn test:e2e` stays the sheet-and-rules suite.
 */
export default defineConfig({
    ...base,
    testMatch: ["**/table3d.spec.ts"],
    // The base config excludes this file so the default run stays fast; the
    // derived config is the one that owns it.
    testIgnore: [],
});
