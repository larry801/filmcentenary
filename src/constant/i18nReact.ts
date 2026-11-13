import React from "react";
import i18n from "./i18n";
import type {AppI18n} from "./i18n";

/**
 * The client half of the i18n binding.
 *
 * `i18n.ts` stays dependency-free because the server bundle imports it and the
 * runtime image installs production dependencies only (no React).  Components
 * call `i18n.use()` once at the top of their body to subscribe to locale
 * changes: on the server that call is a no-op, and this module replaces it
 * with a real React hook for the browser.  It is imported once from the client
 * entry point (`src/index.tsx`), the same split `@i18n-chain/react` used to
 * provide before the runtime image dropped that devDependency.
 */
i18n.use = function use(): AppI18n {
    const [, setLocale] = React.useState(i18n.getLocaleName());
    React.useEffect(() => i18n.listen(setLocale), []);
    return i18n;
} as AppI18n["use"];
