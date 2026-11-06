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

/**
 * Draws attention to the tab when the local player has something to do.
 *
 * - prefixes the document title with a bullet while action is required
 * - flashes the title between the page title and the alert text
 * - optionally plays a short two-note chime (after the first user gesture)
 * - optionally raises a browser notification when the tab is hidden
 *
 * Everything is guarded so server-side rendering and Jest stay side-effect free.
 */
export const useTurnNotification = ({isMyTurn, needsResponse, titleSuffix}: NotificationOptions): void => {
    const alert = isMyTurn || needsResponse;
    const wasAlerting = React.useRef(false);
    const audio = React.useRef<AudioContext | null>(null);

    React.useEffect(() => {
        if (typeof document === "undefined") return undefined;
        const base = document.title.replace(/^(?:\u25cf )+/, "");
        if (!alert) {
            document.title = base;
            wasAlerting.current = false;
            return undefined;
        }
        const suffix = titleSuffix !== undefined && titleSuffix !== "" ? ` \u00b7 ${titleSuffix}` : "";
        document.title = `${TITLE_PREFIX}${base}${suffix}`;
        // Only chime/notify on the transition into the alert state, not on every render.
        if (wasAlerting.current) return undefined;
        wasAlerting.current = true;
        try {
            const AudioCtor = (window as unknown as {AudioContext?: typeof AudioContext}).AudioContext;
            if (AudioCtor !== undefined) {
                audio.current = audio.current ?? new AudioCtor();
                const context = audio.current;
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
            }
        } catch {
            // Autoplay policies may block audio; the title change still works.
        }
        try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
                new Notification(`${base}${suffix}`);
            }
        } catch {
            // Notifications are optional.
        }
        return undefined;
    }, [alert, titleSuffix]);

    React.useEffect(() => {
        if (typeof document === "undefined" || !alert) return undefined;
        const base = document.title;
        let flip = false;
        const timer = window.setInterval(() => {
            if (!document.hidden) return;
            flip = !flip;
            document.title = flip ? base.replace(TITLE_PREFIX, "") : base;
        }, 1600);
        const stop = (): void => {document.title = base;};
        document.addEventListener("visibilitychange", stop);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", stop);
            document.title = base.replace(TITLE_PREFIX, "");
            wasAlerting.current = false;
        };
    }, [alert]);
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
