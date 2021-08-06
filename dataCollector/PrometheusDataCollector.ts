import { PrometheusDriver } from "prometheus-query";
import IConfig, { InstantResult, MemoryCache, RangeResult } from "../types/Type";
import { average } from "../utils/Util";
import { DataCollector } from "./DateCollector";

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

    getCacheMemory = async (nodes: Map<string, MemoryCache>) => {
        const q = 'node_memory_Cached_bytes + node_memory_Buffers_bytes'

        const now = Date.now()
        const start = now - 1 * 60 * 1000
        const end = now
        const step = 60

        const result = (await this.prom.rangeQuery(q, start, end, step)).result as RangeResult[]

        result.forEach(({ metric, values }) => {
            const avg = average(values.map(({ value }) => value))
            const ipAddr = metric.labels.instance.split(":", 2)

            const info = nodes.get(ipAddr[0])
            if (info !== undefined) {
                const diff = (info.bufferMem == -1) ? 0 : avg - info.bufferMem
                nodes.set(ipAddr[0], { ...info, bufferMem: avg, diffMem: diff })
            }
        })
    }

    getTotalMemory = async ( nodes: Map<string, MemoryCache>) => {
        const q = 'node_memory_MemTotal_bytes'
        const result = await (await this.prom.instantQuery(q)).result as InstantResult[]

        result.forEach(metric => {
            const instanceStr = metric.metric.labels["instance"]
            if (instanceStr !== undefined) {
                const ipAddr = instanceStr.split(":", 2)
                const info = nodes.get(ipAddr[0])
                if (info === undefined) {
                    nodes.set(ipAddr[0], { nodeIp: ipAddr[0], totalMem: metric.value.value, bufferMem: -1, pageOverStartedTime: 0, allOverStartTime: 0, pageDrop: false, allDrop: false, diffMem: 0, actionTime: 0 })
                } else {
                    nodes.set(ipAddr[0], { ...info, totalMem: metric.value.value })
                }
            }
        })
    }
}

export default PrometheusDataCollector