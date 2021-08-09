import { PrometheusDriver } from "prometheus-query";
import IConfig, { InstantResult, RangeResult } from "../types/Type";
import { average } from "../utils/Util";
import { CacheMemory, DataCollector } from "./DateCollector";

class PrometheusDataCollector implements DataCollector {
    private prom
    constructor(config:IConfig) {
        let url = config.prometheus.url.trim()
        if (!url.startsWith("http://")) {
            url = `http://${url}`
        }
        this.prom = new PrometheusDriver({
            endpoint: url,
            baseURL: "/api/v1" // default value
        })
    }



    getCacheMemory = async ():Promise<Array<CacheMemory>> => {
        const q = 'node_memory_Cached_bytes + node_memory_Buffers_bytes'

        const now = Date.now()
        const start = now - 1 * 60 * 1000
        const end = now
        const step = 60

        const result = (await this.prom.rangeQuery(q, start, end, step)).result as RangeResult[]
        const ret = new Array<CacheMemory>() 

        result.forEach(({ metric, values }) => {
            const ipAddr = metric.labels.instance.split(":", 2)

            const avg = average(values.map(({ value }) => value))
            ret.push({ipAddress:ipAddr[0], memoryUsage:avg})
        })

        return Promise.resolve(ret)
    }

    getTotalMemory = async ():Promise<Array<CacheMemory>> => {
        const q = 'node_memory_MemTotal_bytes'
        const result = await (await this.prom.instantQuery(q)).result as InstantResult[]
        const ret = new Array<CacheMemory>()

        result.forEach(metric => {
            const instanceStr = metric.metric.labels["instance"]
            if (instanceStr !== undefined) {
                const ipAddr = instanceStr.split(":", 2)

                ret.push({ipAddress:ipAddr[0], memoryUsage:metric.value.value})
            }
        })
        return Promise.resolve(ret)
    }
}

export default PrometheusDataCollector