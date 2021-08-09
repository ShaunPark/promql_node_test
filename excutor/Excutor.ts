export interface Executor {
    exec: (ipAddress: string, command: string) => void
}