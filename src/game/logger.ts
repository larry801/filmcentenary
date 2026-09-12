/**
 * Debug logging is opt-in. This game logs very heavily (every move, every
 * scoring step, every region ranking), and building those strings on every
 * render/state update is a big part of late-game lag, so all of it is off by
 * default and can be switched on when a match needs to be debugged:
 *
 *   browser  : localStorage.setItem('filmDebug', '1')   (then reload)
 *              or window.__FILM_DEBUG__ = true          (no reload needed)
 *   server   : FILM_DEBUG=1 node build/server.js
 *
 * `error` is never silenced.
 */
const readFlag = (): boolean => {
    const g = globalThis as any;
    if (typeof g.__FILM_DEBUG__ === 'boolean') {
        return g.__FILM_DEBUG__;
    }
    if (typeof process !== 'undefined' && process.env && process.env.FILM_DEBUG) {
        return process.env.FILM_DEBUG !== '0' && process.env.FILM_DEBUG !== 'false';
    }
    try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('filmDebug') === '1') {
            return true;
        }
    } catch (e) {
        // localStorage can be unavailable (private mode, SSR) - logging stays off.
    }
    return false;
};

let enabled = readFlag();

const normalRunLogger = {
    get enabled(): boolean {
        return enabled;
    },
    setEnabled(value: boolean): void {
        enabled = value;
    },
    info: (log: string) => {
        if (enabled) console.info(`info|${log}`);
    },
    debug: (log: string) => {
        if (enabled) console.info(`debug|${log}`);
    },
    warn: (log: string) => {
        if (enabled) console.warn(`warn|${log}`);
    },
    error: (log: string) => console.error(`error|${log}`),
}
export const logger = normalRunLogger;
