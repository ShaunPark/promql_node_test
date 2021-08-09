export default interface IConfig {
    dryRun: boolean
    actionBuffer: number
    ratioForPageCacheDrop: DropCondition
    ratioForAllDrop: DropCondition
    processInterval: number
    elasticSearch: IElasticSearch
    prometheus: IPrometheus
    ssh: ISSH
    clusterName:string
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
}

export interface DropCondition {
    ratio: number
    duration: number
}

export interface IPrometheus {
    url: string
}

export type MemoryCache = {
    nodeIp: string,
    totalMem: number,
    bufferMem: number,
    currentLevel:number,
    level_1_Started:number,
    level_2_Started:number,
    diffMem: number,
    actionTime: number
}

export type InstantResult = {
    metric: { name: string, labels: { [key: string]: string } },
    value: { time: Date, value: number }
}
export type RangeResult = {
    metric: { name: string, labels: { [key: string]: string } },
    values: Array<{ time: Date, value: number }>
}

