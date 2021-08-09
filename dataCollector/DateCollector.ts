export type CacheMemory = {
    ipAddress:string,
    memoryUsage:number
}
export interface DataCollector {
    getCacheMemory: () => Promise<Array<CacheMemory>>
    getTotalMemory: () => Promise<Array<CacheMemory>>
}