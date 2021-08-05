import { PrometheusDriver, RangeVector } from "prometheus-query"
import ConfigManager from "./utils/ConfigManager";
import { parse } from "ts-command-line-args"
import IConfig from "./types/Type";
import Log from "./utils/Logger";
import SSH from "./utils/SSH";


const bytesToSize = (bytes: number): string => {
    if (bytes <= 0) return '0B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
}
const average = (arr: number[]) => arr.reduce((p, c) => p + c, 0) / arr.length;
const percent = (child: number, parent: number) => ((child / parent) * 100).toFixed(2);

class PromTest {
    private prom
    private configManager: ConfigManager
    private nodes: Map<string, MemoryCache> = new Map()

    constructor(configFile: string) {
        try {
            this.configManager = new ConfigManager(configFile);
            const config: IConfig = this.configManager.config;

            Log.info(`[PromTest] load config from ${configFile}`)

            let url = config.prometheus.url.trim()
            if (!url.startsWith("http://")) {
                url = `http://${url}`
            }
            this.prom = new PrometheusDriver({
                endpoint: url,
                baseURL: "/api/v1" // default value
            })
        } catch (err) {
            Log.error(err)
            process.exit(1);
        }
    }

    main = () => {
        setInterval(async () => {
            const config = this.configManager.config
            await this.getTotalMemory(this.prom, this.nodes)
            await this.getCacheMemory(this.prom, this.nodes)
            this.judgeMemoryUsage(config, this.nodes)
            this.printCurrentStatus(this.nodes)
        }, this.configManager.config.processInterval)
    }

    getCacheMemory = async (client: PrometheusDriver, nodes: Map<string, MemoryCache>) => {
        const q = 'node_memory_Cached_bytes + node_memory_Buffers_bytes'

        const now = Date.now()
        const start = now - 1 * 60 * 1000
        const end = now
        const step = 60

        const result = (await client.rangeQuery(q, start, end, step)).result as RangeResult[]

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

    judgeMemoryUsage = (config: IConfig, nodes: Map<string, MemoryCache>) => {
        const now = Date.now()
        Array.from(nodes).forEach(([_, info]) => {
            const usage = info.bufferMem / info.totalMem * 100

            const pageDuration = (info.pageOverStartedTime !== 0) ? now - info.pageOverStartedTime : 0
            const allDuration = (info.allOverStartTime !== 0) ? now - info.allOverStartTime : 0

            const allDrop = config.ratioForAllDrop
            const pageCacheDrop = config.ratioForPageCacheDrop

            if (usage > allDrop.ratio) {
                console.log(`${info.nodeIp} over ${allDrop.ratio} `)
                if (info.allOverStartTime == 0) {
                    if (info.pageOverStartedTime == 0) {
                        nodes.set(info.nodeIp, { ...info, allOverStartTime: now, pageOverStartedTime: now, pageDrop: true, allDrop: true })
                    } else {
                        nodes.set(info.nodeIp, { ...info, allOverStartTime: now, allDrop: true })
                    }
                }
                if (allDuration >= allDrop.duration * 60 * 1000) {
                    console.log(`${info.nodeIp} Buffer usage is over ${allDrop.ratio}% and has continued more than ${allDrop.duration} minutes. `)

                    if (config.dryRun) {
                        console.log(`DryRun is enabled. Drop execution skipped. `)
                    } else {
                        const ssh = new SSH(config)
                        ssh.exec(info.nodeIp, `echo 3 > /proc/sys/vm/drop_caches`)
                    }
                }
            } else if (usage > pageCacheDrop.ratio) {
                console.log(`${info.nodeIp} over ${pageCacheDrop.ratio} `)
                if (info.pageOverStartedTime == 0) {
                    nodes.set(info.nodeIp, { ...info, pageOverStartedTime: now, allOverStartTime: 0, pageDrop: true, allDrop: false })
                }
                if (pageDuration >= pageCacheDrop.duration * 60 * 1000) {
                    console.log(`${info.nodeIp} Buffer usage is over ${pageCacheDrop.ratio}% and has continued more than ${pageCacheDrop.duration} minutes. `)
                    if (config.dryRun) {
                        console.log(`DryRun is enabled. Drop execution skipped. `)
                    } else {
                        const ssh = new SSH(config)
                        ssh.exec(info.nodeIp, `echo 1 > /proc/sys/vm/drop_caches`)
                    }
                }
            } else {
                nodes.set(info.nodeIp, { ...info, pageOverStartedTime: 0, allOverStartTime: 0, pageDrop: false, allDrop: false })
            }
        })
    }

    printCurrentStatus = (nodes: Map<string, MemoryCache>) => {
        console.table(Array.from(nodes).map(([_, info]) => {
            let diffStr = ""
            if (info.diffMem < 0) {
                diffStr = `${bytesToSize(info.diffMem * -1)} ↓`
            } else if (info.diffMem > 0) {
                diffStr = `↑ ${bytesToSize(info.diffMem)}`
            } else {
                diffStr = "0B"
            }
            return {
                nodeIp: info.nodeIp,
                totolMem: bytesToSize(info.totalMem),
                bufferMem: bytesToSize(info.bufferMem),
                percent: `${percent(info.bufferMem, info.totalMem)}%`,
                usageDiff: diffStr,
                over50: info.pageDrop,
                over70: info.allDrop
            }
        }))
    }

    getTotalMemory = async (client: PrometheusDriver, nodes: Map<string, MemoryCache>) => {
        const q = 'node_memory_MemTotal_bytes'
        const result = await (await client.instantQuery(q)).result as InstantResult[]


        result.forEach(metric => {
            const instanceStr = metric.metric.labels["instance"]
            if (instanceStr !== undefined) {
                const ipAddr = instanceStr.split(":", 2)
                const info = nodes.get(ipAddr[0])
                if (info === undefined) {
                    nodes.set(ipAddr[0], { nodeIp: ipAddr[0], totalMem: metric.value.value, bufferMem: -1, pageOverStartedTime: 0, allOverStartTime: 0, pageDrop: false, allDrop: false, diffMem: 0 })
                } else {
                    nodes.set(ipAddr[0], { ...info, totalMem: metric.value.value })
                }
            }
        })
    }
}

type MemoryCache = {
    nodeIp: string,
    totalMem: number,
    bufferMem: number,
    pageOverStartedTime: number,
    allOverStartTime: number,
    allDrop: boolean,
    pageDrop: boolean,
    diffMem: number
}

type InstantResult = {
    metric: { name: string, labels: { [key: string]: string } },
    value: { time: Date, value: number }
}
type RangeResult = {
    metric: { name: string, labels: { [key: string]: string } },
    values: Array<{ time: Date, value: number }>
}
interface IArguments {
    configFile: string
}

const args = parse<IArguments>({
    configFile: { type: String, alias: 'f', defaultValue: "config.yaml" }
})
const promMon = new PromTest(args.configFile);
promMon.main()