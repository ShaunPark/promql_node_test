import { parse } from "ts-command-line-args"
import ESLogger from "./elasticsearch/ESLogger";
import PrometheusDataCollector from "./dataCollector/PrometheusDataCollector";
import ConfigManager from "./utils/ConfigManager";
import { MemoryMonitor } from "./MemoryMonitor";
import SSH from "./excutor/SSH";

interface IArguments {
    configFile: string
}

const args = parse<IArguments>({
    configFile: { type: String, alias: 'f', defaultValue: "config.mem.yaml" }
})

const configManager = new ConfigManager(args.configFile);
const config = configManager.config
const esLogger = new ESLogger(config)
const dataCollector = new PrometheusDataCollector(config)
// dataCollector.getCacheMemory().then(r => console.log(r))
const executor = new SSH(config)
new MemoryMonitor(configManager, esLogger, executor).main(dataCollector)