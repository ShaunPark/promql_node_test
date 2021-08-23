import { CacheMemory, DataCollector } from "../interfaces/DateCollector";
import { ExLogger } from "../interfaces/ExLogger";


const temp:number[] = [
    24, 51, 56, 66, 55, 42, 72, 74, 78, 59, 52, 49, 48, 47, 51, 52, 53, 77, 58, 59, 30, 20
]

const unit: number = 6
export class DummyDataCollector implements DataCollector {
    private startTime: number

    constructor() {
        this.startTime = Date.now()
    }

    getCacheMemory = async (): Promise<Array<CacheMemory>> => {
        const ret = new Array<CacheMemory>()
        const now = Date.now()
        const timeDiff = now - this.startTime;
        const index = Math.ceil(timeDiff / (unit * 1000))

        ret.push({ ipAddress: "0.0.0.0", memoryUsage: temp[index] , nodeName:"test", labelKey:"worker", labelValue:"value"})

        return Promise.resolve(ret)
    }
    getTotalMemory = async (): Promise<Array<CacheMemory>> => {
        const ret = new Array<CacheMemory>()
        ret.push({ ipAddress: "0.0.0.0", memoryUsage: 100 , nodeName:"test", labelKey:"worker", labelValue:"value"})
        return Promise.resolve(ret)
    }
}

export class DummyLogger implements ExLogger {
    public info = (nodeName: string, message: string) => {
        // console.log(`[DummyLogger.info] ${nodeName} - ${message}`)
    };
    public error = (nodeName: string, message: string) => {
        // console.log(`[DummyLogger.error] ${nodeName} - ${message}`)

    };
    public warn = (nodeName: string, message: string) => {
        // console.log(`[DummyLogger.warn] ${nodeName} - ${message}`)
    };
}