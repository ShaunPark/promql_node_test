export interface ExLogger {
    info: (nodeName: string, message: string) => void
    error: (nodeName: string, message: string) => void
    warn: (nodeName: string, message: string) => void
}