import { PrometheusDriver, RangeVector } from "prometheus-query"
import ConfigManager from "./utils/ConfigManager";
import { parse } from "ts-command-line-args"
import IConfig, { DropCondition, MemoryCache } from "./types/Type";
import Log from "./utils/Logger";
import SSH from "./utils/SSH";
import ESLogger from "./elasticsearch/ESLogger";
import { percent } from "./utils/Util";
import PrometheusDataCollector from "./dataCollector/PrometheusDataCollector";
import { DataCollector } from "./dataCollector/DateCollector";


const bytesToSize = (bytes: number): string => {
    if (bytes <= 0) return '0B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
}
const COMMAND_FOR_ALL_DROP = "echo 3 > /proc/sys/vm/drop_caches"
const COMMAND_FOR_PAGE_DROP = "echo 1 > /proc/sys/vm/drop_caches"
const ONE_MINIUTE_MILLISEC = 60000

class MemoryMonitor {
    private nodes: Map<string, MemoryCache> = new Map()

    constructor(private configManager: ConfigManager) {}

    main = async (dataCollector:DataCollector) => {
        await ESLogger.init(this.configManager)

        setInterval(async () => {
            const config = this.configManager.config
            await dataCollector.getTotalMemory(this.nodes)
            await dataCollector.getCacheMemory(this.nodes)
            this.judgeMemoryUsage(config, this.nodes)
            this.printCurrentStatus(this.nodes)
        }, this.configManager.config.processInterval)
    }


    processPageDrop = (info: MemoryCache, config: IConfig, condition: DropCondition, cmd: string) => {
        const msg = `${info.nodeIp} Buffer usage is over ${condition.ratio}% and has continued more than ${condition.duration} minutes. `
        Log.info(msg)
        ESLogger.info(info.nodeIp, msg)
        if (config.dryRun) {
            Log.info(`DryRun is enabled. Drop execution skipped. `)
        } else {
            try {
                const ssh = new SSH(config)
                ssh.exec(info.nodeIp, COMMAND_FOR_ALL_DROP)
            } catch (err) {
                Log.error(err)
                ESLogger.error(info.nodeIp, err)
            }
        }
    }

    judgeMemoryUsage = (config: IConfig, nodes: Map<string, MemoryCache>) => {
        const now = Date.now()
        Array.from(nodes).forEach(([_, info]) => {
            // buffer 메모리 사용율
            const usage = info.bufferMem / info.totalMem * 100
            // 해당 노드에서 page drop 을 위한 조건이 유지된 시간.
            const pageDuration = (info.pageOverStartedTime !== 0) ? now - info.pageOverStartedTime : 0
            // 해당 노드에서 전체 cache drop을 위한 조건이 유지된 시간.
            const allDuration = (info.allOverStartTime !== 0) ? now - info.allOverStartTime : 0
            // 전체 cache drop을 위한 조건 설정값.
            const allDrop = config.ratioForAllDrop
            // page drop을 위한 조건 설정값.
            const pageCacheDrop = config.ratioForPageCacheDrop

            if (usage >= pageCacheDrop.ratio) {
                let newInfo = undefined
                let actionTime = undefined
                if (usage >= allDrop.ratio) {
                    Log.info(`${info.nodeIp} over ${allDrop.ratio}% `)
                    if (!info.allDrop) {
                        if (info.pageDrop) { // case 3
                            newInfo = { allOverStartTime: now, allDrop: true }
                        } else {  // case 2
                            newInfo = { allOverStartTime: now, allDrop: true, pageOverStartedTime: now, pageDrop: true }
                        }
                    }
                } else {
                    Log.info(`${info.nodeIp} over ${pageCacheDrop.ratio}% `)
                    if (!info.pageDrop) {
                        if (info.allDrop) { // case 6
                            newInfo = { allOverStartTime: 0, allDrop: false }
                        } else {  //case 1
                            newInfo = { pageOverStartedTime: now, pageDrop: true }
                        }
                    }
                }
                nodes.set(info.nodeIp, { ...info, ...newInfo })
                if (now - info.actionTime > config.actionBuffer * ONE_MINIUTE_MILLISEC) {
                    if (allDuration >= allDrop.duration * ONE_MINIUTE_MILLISEC) {
                        // 해당 조건이 발생한 후 유지 시간이 설정된 시간을 초과 했으면 전체 cache drop을 수행함
                        newInfo = { ...newInfo, actionTime: now }
                        this.processPageDrop(info, config, allDrop, COMMAND_FOR_ALL_DROP)
                    } else if (pageDuration >= pageCacheDrop.duration * ONE_MINIUTE_MILLISEC) {
                        // 해당 조건이 발생한 후 유지 시간이 설정된 시간을 초과 했으면 page drop을 수행함
                        newInfo = { ...newInfo, actionTime: now }
                        this.processPageDrop(info, config, pageCacheDrop, COMMAND_FOR_PAGE_DROP)
                    } else if (info.actionTime !== 0) {
                        newInfo = { ...newInfo, actionTime: 0 }
                    }
                }

                nodes.set(info.nodeIp, { ...info, ...newInfo })
            } else {
                if (info.allDrop) { // case 7
                    nodes.set(info.nodeIp, { ...info, allOverStartTime: 0, allDrop: false, pageOverStartedTime: 0, pageDrop: false })
                } else if (info.pageDrop) { // case 5
                    nodes.set(info.nodeIp, { ...info, pageOverStartedTime: 0, pageDrop: false })
                }

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

}

interface IArguments {
    configFile: string
}

const args = parse<IArguments>({
    configFile: { type: String, alias: 'f', defaultValue: "config.yaml" }
})

const configManager = new ConfigManager(args.configFile);
const promMon = new MemoryMonitor(configManager)
const dataCollector = new PrometheusDataCollector(configManager.config)

promMon.main(dataCollector)