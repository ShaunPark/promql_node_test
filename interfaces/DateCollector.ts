export type CacheMemory = {
    ipAddress: string,
    nodeName: string,
    memoryUsage: number,
    labelKey: string,
    labelValue: string
}
export interface DataCollector {
    getCacheMemory: () => Promise<Array<CacheMemory>>
    getTotalMemory: () => Promise<Array<CacheMemory>>
}