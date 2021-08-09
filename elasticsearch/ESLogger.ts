import IConfig from "../types/Type";
import { ESLogClient } from "./ESLogClient"
import { ExLogger } from "../interfaces/ExLogger"

class ESLogger implements ExLogger {
    private clusterName: string;
    private client:ESLogClient

    constructor( config: IConfig){
        this.client = new ESLogClient(config)
        this.clusterName = config.clusterName
    }

    public info(nodeName: string, message: string) {
        this.client.putLog({ logType: "Info", nodeName: nodeName, message: message, clusterName: this.clusterName })
    }
    public error(nodeName: string, message: string) {
        this.client.putLog({ logType: "Error", nodeName: nodeName, message: message, clusterName: this.clusterName })
    }
    public warn(nodeName: string, message: string) {
        this.client.putLog({ logType: "Warning", nodeName: nodeName, message: message, clusterName: this.clusterName })
    }
}

export default ESLogger;
