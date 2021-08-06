import ConfigManager from "../utils/ConfigManager"
import { ESLogClient } from "./ESLogClient"

class ESLogger {
    private static client:ESLogClient
    private static clusterName:string
    
    public static async init (cm:ConfigManager) {
        ESLogger.client = new ESLogClient(cm)
        ESLogger.clusterName = cm.config.clusterName
    }
    public static info(nodeName:string, message:string) {
        ESLogger.client.putLog({logType:"Info", nodeName:nodeName, message:message, clusterName: ESLogger.clusterName })
    }
    public static error(nodeName:string, message:string) {
        ESLogger.client.putLog({logType:"Error", nodeName:nodeName, message:message, clusterName: ESLogger.clusterName })
    }
    public static warn(nodeName:string, message:string) {
        ESLogger.client.putLog({logType:"Warning", nodeName:nodeName, message:message, clusterName: ESLogger.clusterName })
    }
}

export default ESLogger;
