const normalRunLogger = {
    info: (log: string) => console.log(`info|${log}`),
    debug: (log: string) => console.log(`debug|${log}`),
    error: (log: string) => console.log(`error|${log}`),
}
export const logger = normalRunLogger;