import ConfigManager from "./utils/ConfigManager";
import IConfig, { DropCondition, MemoryCache } from "./types/Type";
import Log from "./utils/Logger";
import * as util from "./utils/Util";
import { DataCollector } from "./interfaces/DateCollector";
import { ExLogger } from "./interfaces/ExLogger";
import { Executor } from "./interfaces/Excutor";

const COMMAND_FOR_ALL_DROP = "echo 3 > /proc/sys/vm/drop_caches"
const COMMAND_FOR_PAGE_DROP = "echo 1 > /proc/sys/vm/drop_caches"
const COMMAND_SWAP_OFFON = "swapoff -a && swapon -a"

export class MemoryMonitor {

    constructor(private configManager: ConfigManager, private exLogger: ExLogger, private executor: Executor) { }

    /**
     * 메인 메소드 
     * 
     * 설정파일을 읽고
     * 노드 전체 메모리 조회 후 cache 사용량을 조회
     * 조회된 정보를 기반으로 레벨 판정 및 drop 작업 수행
     * 로그를 출력하고
     * swap off/on 작업을 수행
     * @param dataCollector 
     */
    main = async (dataCollector: DataCollector) => {
        const nodes: Map<string, MemoryCache> = new Map()

        setInterval(async () => {
            try {
                const config = this.configManager.config
                await this.getTotalMemory(nodes, dataCollector)
                await this.getCacheMemery(nodes, dataCollector)
                this.judgeMemoryUsage(nodes, config)
                this.printCurrentStatus(nodes, config)
                if (config.swapOffOn.enabled) {
                    this.swapOffAndOn(nodes, config)
                }
            } catch (err) {
                Log.error(JSON.stringify(err))
            }
        }, this.configManager.config.processInterval)
    }

    private swapOffed: boolean = false

    /**
     * 주기적으로 정해진 시간대가 되면 메모리 swap을 off 후 on 하는 작업을 수행
     * 모든 노드에 대해서 동시에 수행하도록 함
     * @param config 설정 정보
     * @param nodes 노드 정보 목록
     */
    swapOffAndOn = (nodes: Map<string, MemoryCache>, config: IConfig) => {
        if (this.isSwapOffTime(config)) {
            if (!this.swapOffed) {
                Array.from(nodes).forEach(([_, info]) => {
                    if (config.dryRun) {
                        Log.info(`[MemoryMonitor.swapOffAndOn] DryRun is enabled. Swap off/on skipped. `)
                    } else {
                        this.exLogger.info(info.nodeName, `Execute swap off and on`)
                        if (config.ssh.useIpAddress) {
                            this.executor.exec(info.ipAddress, COMMAND_SWAP_OFFON)
                        } else {
                            this.executor.exec(info.nodeName, COMMAND_SWAP_OFFON)
                        }
                    }
                })
                this.swapOffed = true
            }
        } else {
            this.swapOffed = false
        }
    }

    /**
    * 현재 시각이 swap off/on 작업을 할 시점인지 확인
    * 
    * @param now 현재 시각
    * @returns swap off/on 작업 시간인지 여부 
    */
    private isSwapOffTime = (config: IConfig): boolean => {
        const swapStartTime = util.timeStrToDate(config.swapOffOn.startTime, "02:30+09:00")
        const swapEndTime = util.timeStrToDate(config.swapOffOn.endTime, "02:50+09:00")

        const ret = util.betweenTimes(new Date(), swapStartTime, swapEndTime)
        Log.debug(`[MemoryMonitor.isSwapOffTime] isSwapOffTime : ${ret}`)
        return ret
    }

    /**
     * 모니터링 대상 노드들의 전체 메모리를 조회하여 노드 정보 목록에 업데이트
     * 노드 정보 목록에 해당 노드가 없으면, 해당 노드를 노드 정보 목록에 추가함.
     * @param nodes 노드 정보 목록
     * @param dataCollector 메모리 정보를 가져올 data collector
     */
    getTotalMemory = async (nodes: Map<string, MemoryCache>, dataCollector: DataCollector) => {
        const ret = await dataCollector.getTotalMemory()
        ret.forEach(({ ipAddress, memoryUsage, nodeName }) => {
            const info = nodes.get(nodeName)
            if (info === undefined) {
                nodes.set(nodeName, { ipAddress: ipAddress, nodeName: nodeName, totalMem: memoryUsage, bufferMem: -1, level_1_Started: 0, level_2_Started: 0, currentLevel: 0, diffMem: 0, actionTime: 0 })
            } else {
                nodes.set(nodeName, { ...info, totalMem: memoryUsage })
            }
        })
        // 모니터링 정보중에 사라졌으면 삭제
        const nodeNames = ret.map(node => node.nodeName)
        Array.from(nodes)
            .map(([key, node]) => node.nodeName)
            .filter(nodeName => !nodeNames.includes(nodeName))
            .forEach(nodeName => {
                nodes.delete(nodeName)
            })
    }

    /**
     * 모니터링 대상 노드들의 cache 사용량을 조회하여 노드 정보 목록에 업데이트
     * @param nodes 노드 정보 목록
     * @param dataCollector 메모리 정보를 가져올 data collector
     */
    getCacheMemery = async (nodes: Map<string, MemoryCache>, dataCollector: DataCollector) => {
        const ret = await dataCollector.getCacheMemory()
        ret.forEach(({ memoryUsage, nodeName }) => {
            const info = nodes.get(nodeName)
            if (info !== undefined) {
                const diff = (info.bufferMem == -1) ? 0 : memoryUsage - info.bufferMem
                nodes.set(nodeName, { ...info, bufferMem: memoryUsage, diffMem: diff })
            }
        })
    }

    /**
     * drop 작업을 수행할 노드에 대해서 로그를 출력하고 executor를 통해 drop작업을 수행함 
     * @param info page drop을 수행할 노드 정보
     * @param config 설정 파일 정보
     * @param condition page drop 조건 
     * @param cmd page drop에 사용될 명령어
     */
    processPageDrop = (info: MemoryCache, config: IConfig, condition: DropCondition, cmd: string) => {
        const msg = ` ${info.nodeName} Buffer usage is over ${condition.ratio}% and has continued more than ${condition.duration} minutes. `
        Log.info(`[MemoryMonitor.processPageDrop] ${msg}`)
        this.exLogger.info(info.nodeName, msg)
        if (config.dryRun) {
            Log.info(`[MemoryMonitor.processPageDrop] DryRun is enabled. Drop execution skipped. `)
        } else {
            try {
                // IP로 접근할 것인지 노드명으로 접근할 것인지 설정에 따라 수행
                if (config.ssh.useIpAddress) {
                    this.executor.exec(info.ipAddress, cmd)
                } else {
                    this.executor.exec(info.nodeName, cmd)
                }
            } catch (err) {
                Log.error(err)
                this.exLogger.error(info.nodeName, err)
            }
        }
    }

    /**
     * 
     * @param nodes 노드 정보 목록
     * @param config 설정 정보
     */
    judgeMemoryUsage = (nodes: Map<string, MemoryCache>, config: IConfig) => {
        const now = Date.now()
        // 전체 cache drop을 위한 조건 설정값.
        const allDrop = config.ratioForAllDrop
        // page drop을 위한 조건 설정값.
        const pageCacheDrop = config.ratioForPageCacheDrop

        Array.from(nodes).forEach(([_, info]) => {
            const usage = Math.round(info.bufferMem / info.totalMem * 100)
            const newInfo = { ...info }

            if (usage > allDrop.ratio) { // level 2
                // 현재 조건이 레벨 2일때 작업 수행
                if (newInfo.currentLevel == 1) {
                    newInfo.level_2_Started = now
                } else if (newInfo.currentLevel == 0) {
                    newInfo.level_1_Started = now
                    newInfo.level_2_Started = now
                }
                newInfo.currentLevel = 2
            } else if (usage > pageCacheDrop.ratio) { // level 1
                // 현재 조건이 레벨 1일때의 작업 수행
                if (newInfo.currentLevel == 2) {
                    newInfo.level_2_Started = 0
                } else if (newInfo.currentLevel == 0) {
                    newInfo.level_1_Started = now
                }
                newInfo.currentLevel = 1
            } else {
                // 현재 조건이 레벨 0일때의 작업 수행
                if (newInfo.currentLevel == 2) {
                    newInfo.level_2_Started = 0
                    newInfo.level_1_Started = 0
                } else if (newInfo.currentLevel == 1) {
                    newInfo.level_1_Started = 0
                }
                newInfo.currentLevel = 0
            }
            // 만약 지난번 drop을 한 후 일정 버퍼만큼의 시간이 지났으면 지난번 작업 시점 초기화 
            if (newInfo.actionTime + config.actionBuffer < now) {
                newInfo.actionTime = 0
            }
            // 새롭게 설정된 레벨에 따라 작업 수행
            if (newInfo.currentLevel == 2) {
                // 레벨 2 인경우 레벨 2가 시작된 시점 부터의 경과 시간을 확인 한 후 
                // 언제 drop 시점을 계산
                let fireTime = newInfo.level_2_Started + allDrop.duration
                if (newInfo.actionTime != 0) {
                    const minNextTime = newInfo.actionTime + config.actionBuffer
                    if (minNextTime > fireTime) {
                        fireTime = minNextTime
                    }
                }
                // drop시점이 지났으면 작업 시점을 저장 하고 drop 수행
                if (fireTime < now) {
                    newInfo.actionTime = now
                    this.processPageDrop(info, config, allDrop, COMMAND_FOR_ALL_DROP)
                }
            }
            if (newInfo.currentLevel == 1) {
                // 레벨 1 인경우 레벨 1이 시작된 시점 부터의 경과 시간을 확인 한 후 
                // 언제 drop 시점을 계산
                // 만약 레벨 2에 의해 작업이 수행되었으면 actionTime이 설정되므로 동시에 처리되지 않음 
                let fireTime = newInfo.level_1_Started + pageCacheDrop.duration
                if (newInfo.actionTime != 0) {
                    const minNextTime = newInfo.actionTime + config.actionBuffer
                    if (minNextTime > fireTime) {
                        fireTime = minNextTime
                    }
                }
                // drop시점이 지났으면 작업 시점을 저장 하고 drop 수행
                if (fireTime < now) {
                    newInfo.actionTime = now
                    this.processPageDrop(info, config, pageCacheDrop, COMMAND_FOR_PAGE_DROP)
                }
            }
            // 노드 처리 정보를 저장 하고 종료 
            nodes.set(newInfo.nodeName, newInfo)
        })
    }

    /**
     * 현재 상태를 로그로 출력
     * @param nodes 노드 정보 목록
     * @param config 설정 정보
     */
    printCurrentStatus = (nodes: Map<string, MemoryCache>, config: IConfig) => {
        Log.info('Memory status')
        console.table(Array.from(nodes).map(([_, info]) => {
            // let diffStr = ""
            // if (info.diffMem < 0) {
            //     diffStr = `${util.bytesToSize(info.diffMem * -1)} ↓`
            // } else if (info.diffMem > 0) {
            //     diffStr = `↑ ${util.bytesToSize(info.diffMem)}`
            // } else {
            //     diffStr = "0B"
            // }
            return {
                nodeIp: info.ipAddress,
                totolMem: util.bytesToSize(info.totalMem),
                bufferMem: util.bytesToSize(info.bufferMem),
                percent: `${util.percent(info.bufferMem, info.totalMem)}%`,
                // now: new Date().toLocaleTimeString(),
                // level: info.currentLevel,
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