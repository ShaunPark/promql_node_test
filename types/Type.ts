export default interface IConfig {
    dryRun: boolean
    ratioForPageCacheDrop: DropCondition
    ratioForAllDrop: DropCondition
    processInterval: number
    elasticSearch: IElasticSearch
    prometheus: IPrometheus
    ssh: ISSH
}

export interface IElasticSearch {
    host: string
    port: number
    logIndex: string
    statusIndex: string
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