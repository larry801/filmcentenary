const normalRunLogger = {
    info: (log: string) => console.info(`info|${log}`),
    debug: (log: string) => console.debug(`debug|${log}`),
    warn: (log: string) => console.warn(`warn|${log}`),
    error: (log: string) => console.error(`error|${log}`),
}
export const logger = normalRunLogger;