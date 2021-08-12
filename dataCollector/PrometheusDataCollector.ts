import { PrometheusDriver } from "prometheus-query";
import IConfig, { InstantResult, RangeResult } from "../types/Type";
import { CacheMemory, DataCollector } from "../interfaces/DateCollector";
import Log from "../utils/Logger";

class PrometheusDataCollector implements DataCollector {
    private prom
    private isPrivate: boolean | undefined = undefined
    private nodeSelectorKey: string
    private nodeSelectorValue: string

    constructor(config: IConfig) {
        let url = config.prometheus.url.trim()
        if (!url.startsWith("http://")) {
            url = `http://${url}`
        }
        this.prom = new PrometheusDriver({
            endpoint: url,
            baseURL: "/api/v1" // default value
        })
        const selector = config.prometheus.nodeSelector
        const strs = selector.split("=", 2)
        if (strs.length == 2) {
            this.nodeSelectorKey = strs[0].trim()
            this.nodeSelectorValue = strs[1].trim()
        } else {
            throw new Error(`Invalid node selector in config file. ${selector}`)
        }
    }

    private checkIfPrivate = async (): Promise<boolean> => {
        try {
            const q = `kube_node_labels`
            const result = (await this.prom.instantQuery(q)).result as InstantResult[]

            if (result.length > 0) {
                if (result[0].metric.labels["label_node_ip"] !== undefined) {
                    return Promise.resolve(true)
                }
            }
            return Promise.resolve(false)

        } catch (err) {
            console.error(JSON.stringify(err))
            return Promise.reject(err)
        }
    }

    getCacheMemory = async (): Promise<Array<CacheMemory>> => {
        if (this.isPrivate === undefined) {
            this.isPrivate = await this.checkIfPrivate()
        }

        const q = `label_replace(avg_over_time(node_memory_Cached_bytes{job="node-exporter"}[1m]) + avg_over_time(node_memory_Buffers_bytes{job="node-exporter"}[1m])
                    , "ip", "$1", "instance", "(.*):.*") * on (ip) group_left(node, label_${this.nodeSelectorKey}) ${this.getLabelReplace()}`
        return this.queryPrometheus(q)
    }

    private getLabelReplace():string {
        return (this.isPrivate) ? `label_replace(kube_node_labels, "ip", "$1", "label_node_ip","(.*)")` : `label_replace(kube_node_labels, "ip", "$1.$2.$3.$4", "node", "ip-(\\\\d+)-(\\\\d+)-(\\\\d+)-(\\\\d+).*")`
    }

    getTotalMemory = async (): Promise<Array<CacheMemory>> => {
        if (this.isPrivate === undefined) {
            this.isPrivate = await this.checkIfPrivate()
        }

        const q = `label_replace(node_memory_MemTotal_bytes{job="node-exporter"}
                    , "ip", "$1", "instance", "(.*):.*") *  on (ip) group_left(node, label_${this.nodeSelectorKey}) ${this.getLabelReplace()}`

        return this.queryPrometheus(q)
    }

    private queryPrometheus = async (query: string) => {
        try {
            const result = await (await this.prom.instantQuery(query)).result as InstantResult[]
            const ret = new Array<CacheMemory>()

            result.filter(({ metric }) => metric.labels[`label_${this.nodeSelectorKey}`] == this.nodeSelectorValue)
                .forEach(data => {
                    ret.push({ ipAddress: data.metric.labels.ip, memoryUsage: data.value.value, nodeName: data.metric.labels.node })
                })
            return Promise.resolve(ret)
        } catch (err) {
            Log.error(JSON.stringify(err))
            return Promise.reject(err)
        }
    }
}

export default PrometheusDataCollector