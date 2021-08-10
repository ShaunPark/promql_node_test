import ConfigManager from "./utils/ConfigManager";
import IConfig, { DropCondition, MemoryCache } from "./types/Type";
import Log from "./utils/Logger";
import { percent, bytesToSize } from "./utils/Util";
import { DataCollector } from "./interfaces/DateCollector";
import { ExLogger } from "./interfaces/ExLogger";
import { Executor } from "./interfaces/Excutor";

const COMMAND_FOR_ALL_DROP = "echo 3 > /proc/sys/vm/drop_caches"
const COMMAND_FOR_PAGE_DROP = "echo 1 > /proc/sys/vm/drop_caches"

export class MemoryMonitor {
    private nodes: Map<string, MemoryCache> = new Map()

    constructor(private configManager: ConfigManager, private exLogger: ExLogger, private executor:Executor) { }

    main = async (dataCollector: DataCollector) => {
        setInterval(async () => {
            const config = this.configManager.config
            await this.getTotalMemory(this.nodes, dataCollector)
            await this.getCacheMemery(this.nodes, dataCollector)
            this.judgeMemoryUsage(config, this.nodes)
            this.printCurrentStatus(this.nodes, config)
        }, this.configManager.config.processInterval)
    }

    getTotalMemory = async (nodes: Map<string, MemoryCache>, dataCollector: DataCollector) => {
        const ret = await dataCollector.getTotalMemory()
        ret.forEach(({ ipAddress, memoryUsage }) => {
            const info = nodes.get(ipAddress)
            if (info === undefined) {
                nodes.set(ipAddress, { nodeIp: ipAddress, totalMem: memoryUsage, bufferMem: -1, level_1_Started: 0, level_2_Started: 0, currentLevel: 0, diffMem: 0, actionTime: 0 })
            } else {
                nodes.set(ipAddress, { ...info, totalMem: memoryUsage })
            }
        })

    }

    getCacheMemery = async (nodes: Map<string, MemoryCache>, dataCollector: DataCollector) => {
        const ret = await dataCollector.getCacheMemory()
        ret.forEach(({ ipAddress, memoryUsage }) => {
            const info = nodes.get(ipAddress)
            if (info !== undefined) {
                const diff = (info.bufferMem == -1) ? 0 : memoryUsage - info.bufferMem
                nodes.set(ipAddress, { ...info, bufferMem: memoryUsage, diffMem: diff })
            }
        })
    }

    processPageDrop = (info: MemoryCache, config: IConfig, condition: DropCondition, cmd: string) => {
        const msg = `[MemoryMonitor.processPageDrop] ${info.nodeIp} Buffer usage is over ${condition.ratio}% and has continued more than ${condition.duration} minutes. `
        Log.info(msg)
        this.exLogger.info(info.nodeIp, msg)
        if (config.dryRun) {
            Log.info(`[MemoryMonitor.processPageDrop] ryRun is enabled. Drop execution skipped. `)
        } else {
            try {
                this.executor.exec(info.nodeIp, cmd)
            } catch (err) {
                Log.error(err)
                this.exLogger.error(info.nodeIp, err)
            }
        }
    }

    judgeMemoryUsage = (config: IConfig, nodes: Map<string, MemoryCache>) => {
        const now = Date.now()
        // 전체 cache drop을 위한 조건 설정값.
        const allDrop = config.ratioForAllDrop
        // page drop을 위한 조건 설정값.
        const pageCacheDrop = config.ratioForPageCacheDrop

        Array.from(nodes).forEach(([_, info]) => {
            const usage = Math.round(info.bufferMem / info.totalMem * 100)
            const newInfo = { ...info }

            if (usage > allDrop.ratio) { // level 2
                if (newInfo.currentLevel == 1) {
                    newInfo.level_2_Started = now
                } else if (newInfo.currentLevel == 0) {
                    newInfo.level_1_Started = now
                    newInfo.level_2_Started = now
                }
                newInfo.currentLevel = 2
            } else if (usage > pageCacheDrop.ratio) { // level 1
                if (newInfo.currentLevel == 2) {
                    newInfo.level_2_Started = 0
                } else if (newInfo.currentLevel == 0) {
                    newInfo.level_1_Started = now
                }
                newInfo.currentLevel = 1
            } else { // level 0
                if (newInfo.currentLevel == 2) {
                    newInfo.level_2_Started = 0
                    newInfo.level_1_Started = 0
                } else if (newInfo.currentLevel == 1) {
                    newInfo.level_1_Started = 0
                }
                newInfo.currentLevel = 0
            }

            if (newInfo.actionTime + config.actionBuffer < now) {
                newInfo.actionTime = 0
            }
            if (newInfo.currentLevel == 2) {
                let fireTime = newInfo.level_2_Started + allDrop.duration
                if (newInfo.actionTime != 0) {
                    const minNextTime = newInfo.actionTime + config.actionBuffer
                    if (minNextTime > fireTime) {
                        fireTime = minNextTime
                    }
                }
                if (fireTime < now) {
                    newInfo.actionTime = now
                    this.processPageDrop(info, config, allDrop, COMMAND_FOR_ALL_DROP)
                }
            }
            if (newInfo.currentLevel == 1) {
                let fireTime = newInfo.level_1_Started + pageCacheDrop.duration
                if (newInfo.actionTime != 0) {
                    const minNextTime = newInfo.actionTime + config.actionBuffer
                    if (minNextTime > fireTime) {
                        fireTime = minNextTime
                    }
                }
                if (fireTime < now) {
                    newInfo.actionTime = now
                    this.processPageDrop(info, config, pageCacheDrop, COMMAND_FOR_PAGE_DROP)
                }
            }

            nodes.set(newInfo.nodeIp, newInfo)
        })
    }

    printCurrentStatus = (nodes: Map<string, MemoryCache>, config: IConfig) => {
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
                now: new Date().toLocaleTimeString(),
                level: info.currentLevel,
                // actionTime: (info.actionTime != 0) ? new Date(info.actionTime).toLocaleTimeString() : "--",
                // minNext: (info.actionTime != 0) ? new Date(info.actionTime + config.actionBuffer).toLocaleTimeString() : "--",
                // PageStart: (info.level_1_Started != 0) ? new Date(info.level_1_Started).toLocaleTimeString() : "--",
                // fireTime: (info.level_1_Started != 0) ? new Date(info.level_1_Started + config.ratioForPageCacheDrop.duration).toLocaleTimeString() : "--",
                // AllStart: (info.level_2_Started != 0) ? new Date(info.level_2_Started).toLocaleTimeString() : "--",
                // AllTime: (info.level_2_Started != 0) ? new Date(info.level_2_Started + config.ratioForAllDrop.duration).toLocaleTimeString() : "--"
            }
        }))
    }
}