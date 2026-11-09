import React from "react";

export interface NotificationOptions {
    /** True when the local seat is the one expected to act right now. */
    isMyTurn: boolean;
    /** True when the local seat must answer a pending response window. */
    needsResponse: boolean;
    /** Short, localized description used in the tab title. */
    titleSuffix?: string;
}

const TITLE_PREFIX = "\u25cf ";
const FLASH_INTERVAL_MS = 1600;

interface TitleClaim {
    owner: string;
    suffix?: string;
}

/**
 * Hotseat mounts one board per seat, so several copies of this hook are alive
 * at once.  The title therefore has to be coordinated like a single shared
 * resource: only one claim may paint it, and a non-alerting seat must never
 * write back a title that already contains another seat's suffix.
 */
const claims: TitleClaim[] = [];
let baseTitle: string | undefined;
let flashTimer: number | undefined;
let flashOn = true;
let visibilityBound = false;

const hasDocument = (): boolean => typeof document !== "undefined";

/** Captured before the first claim and never derived from the live title. */
const getBaseTitle = (): string => {
    if (baseTitle === undefined) {
        baseTitle = document.title.replace(/^(?:\u25cf )+/, "");
    }
    return baseTitle;
};

const suffixText = (suffix?: string): string => suffix !== undefined && suffix !== "" ? ` \u00b7 ${suffix}` : "";

const paintTitle = (showBullet: boolean): void => {
    if (!hasDocument()) return;
    const title = getBaseTitle();
    if (claims.length === 0) {
        document.title = title;
        return;
    }
    const leader = claims[claims.length - 1];
    document.title = `${showBullet ? TITLE_PREFIX : ""}${title}${suffixText(leader.suffix)}`;
};

const stopFlashing = (): void => {
    if (typeof window !== "undefined" && flashTimer !== undefined) {
        window.clearInterval(flashTimer);
    }
    flashTimer = undefined;
    flashOn = true;
};

const startFlashing = (): void => {
    if (!hasDocument() || flashTimer !== undefined) return;
    flashTimer = window.setInterval(() => {
        if (!document.hidden) return;
        flashOn = !flashOn;
        paintTitle(flashOn);
    }, FLASH_INTERVAL_MS);
};

const onVisibilityChange = (): void => {
    if (!document.hidden) {
        flashOn = true;
        paintTitle(true);
    }
};

const bindVisibility = (): void => {
    if (visibilityBound || !hasDocument()) return;
    document.addEventListener("visibilitychange", onVisibilityChange);
    visibilityBound = true;
};

const unbindVisibility = (): void => {
    if (!visibilityBound || !hasDocument()) return;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    visibilityBound = false;
};

/** Returns true when this claim turned an idle title into an alerting one. */
const claimTitle = (owner: string, suffix?: string): boolean => {
    if (!hasDocument()) return false;
    const becameActive = claims.length === 0;
    const existing = claims.findIndex((claim) => claim.owner === owner);
    if (existing !== -1) claims.splice(existing, 1);
    claims.push({owner, suffix});
    bindVisibility();
    startFlashing();
    paintTitle(true);
    return becameActive;
};

const releaseTitle = (owner: string): void => {
    if (!hasDocument()) return;
    const existing = claims.findIndex((claim) => claim.owner === owner);
    if (existing === -1) return;
    claims.splice(existing, 1);
    if (claims.length === 0) {
        stopFlashing();
        unbindVisibility();
    }
    paintTitle(true);
};

const playChime = (audioRef: React.MutableRefObject<AudioContext | null>): void => {
    try {
        const AudioCtor = (window as unknown as {AudioContext?: typeof AudioContext}).AudioContext;
        if (AudioCtor === undefined) return;
        audioRef.current = audioRef.current ?? new AudioCtor();
        const context = audioRef.current;
        if (context.state === "suspended") void context.resume();
        const start = context.currentTime;
        const note = (frequency: number, at: number): void => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(0.06, at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
            oscillator.connect(gain).connect(context.destination);
            oscillator.start(at);
            oscillator.stop(at + 0.24);
        };
        note(660, start);
        note(880, start + 0.16);
    } catch {
        // Autoplay policies may block audio; the title change still works.
    }
};

const showNotification = (suffix?: string): void => {
    try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
            new Notification(`${getBaseTitle()}${suffixText(suffix)}`);
        }
    } catch {
        // Notifications are optional.
    }
};

/**
 * Draws attention to the tab when the local player has something to do.
 *
 * - prefixes the document title with a bullet while action is required
 * - flashes the title between the page title and the alert text
 * - optionally plays a short two-note chime (after the first user gesture)
 * - optionally raises a browser notification when the tab is hidden
 *
 * Several seats may mount this hook (local hotseat).  Claims are coordinated
 * through the module-level list above, so the last seat to need attention owns
 * the title and inactive seats never overwrite it.  Everything is guarded so
 * server-side rendering and Jest stay side-effect free.
 */
export const useTurnNotification = ({isMyTurn, needsResponse, titleSuffix}: NotificationOptions): void => {
    const alert = isMyTurn || needsResponse;
    const owner = React.useId();
    const wasAlerting = React.useRef(false);
    const audio = React.useRef<AudioContext | null>(null);

    React.useEffect(() => {
        if (!hasDocument()) return undefined;
        if (!alert) {
            wasAlerting.current = false;
            releaseTitle(owner);
            return undefined;
        }
        const becameActive = claimTitle(owner, titleSuffix);
        if (becameActive && !wasAlerting.current) {
            playChime(audio);
            showNotification(titleSuffix);
        }
        wasAlerting.current = true;
        return () => releaseTitle(owner);
    }, [alert, titleSuffix, owner]);
};

/** Asks for notification permission once, on the first deliberate click. */
export const useNotificationPermission = (enabled: boolean): void => {
    React.useEffect(() => {
        if (!enabled || typeof window === "undefined" || typeof Notification === "undefined") return undefined;
        if (Notification.permission !== "default") return undefined;
        const ask = (): void => {void Notification.requestPermission();};
        window.addEventListener("pointerdown", ask, {once: true});
        return () => window.removeEventListener("pointerdown", ask);
    }, [enabled]);
};

export const notificationTitle = (isMyTurn: boolean, needsResponse: boolean, yourTurn: string, responseNeeded: string): string | undefined =>
    needsResponse ? responseNeeded : isMyTurn ? yourTurn : undefined;
