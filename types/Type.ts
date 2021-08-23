export default interface IConfig {
    dryRun: boolean
    actionBuffer: number
    ratioForPageCacheDrop: DropCondition
    ratioForAllDrop: DropCondition
    processInterval: number
    elasticSearch: IElasticSearch
    prometheus: IPrometheus
    ssh: ISSH
    clusterName: string
    swapOffOn: ISwap
}

export interface ISwap {
    enabled: boolean
    startTime: string
    endTime: string
}
export interface IElasticSearch {
    host: string
    port: number
    memoryIndex: string
    id?: string
    apiKey?: string
    useApiKey: boolean
}

export interface ISSH {
    sshPemFile: string
    sshUser: string
    useIpAddress: boolean
}

export type DropCondition = {
    ratio: number
    duration: number
}

export interface IPrometheus {
    url: string
    nodeSelector: string
}

export type MemoryCache = {
    ipAddress: string,
    nodeName: string,
    totalMem: number,
    bufferMem: number,
    currentLevel: number,
    level_Started: Array<number>
    diffMem: number,
    actionTime: number,
    labels: Map<string, string>
}

export type InstantResult = {
    metric: { name: string, labels: { [key: string]: string } },
    value: { time: Date, value: number }
}
export type RangeResult = {
    metric: { name: string, labels: { [key: string]: string } },
    values: Array<{ time: Date, value: number }>
}

