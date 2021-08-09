import Log from "../utils/Logger";
import { ESClient } from "./ESClient";
import IConfig from "../types/Type";

export type LogType = {
    clusterName: string
    logType: "Error"|"Info"|"Warning"
    nodeName: string,
    message?: string
};

const mapping = {
    clusterName: {type:"keyword"},
    logType: {type:"keyword"},
    nodeName: { type: "keyword" },
    message: { type: "text" }
}

export class ESLogClient extends ESClient<LogType> {
    constructor(config: IConfig) {
        const el = config.elasticSearch;
        if (el !== undefined) {
            const { host, port, memoryIndex } = el
            super(memoryIndex, `http://${host.trim()}:${port}`, mapping, el)
        } else {
            Log.error("[ESLogClient] ElasticSearch connection information is not set in config file.")
        }
    }

    public putLog(log: LogType) {
        super.put(log)
    }

    public async searchLog(log: LogType): Promise<Array<LogType>> {
        return super.search(log)
    }
}