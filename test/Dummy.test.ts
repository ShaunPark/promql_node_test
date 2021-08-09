import { Executor } from "../excutor/Excutor"
import { MemoryMonitor } from "../MemoryMonitor"
import ConfigManager from "../utils/ConfigManager"
import { DummyDataCollector, DummyLogger } from "./DummyDataCollector"

class DummyExecutor implements Executor {
    exec = (ipAddress: string, command: string) => {
        console.log( `${ipAddress} - ${command}`)
    }
    
}
new MemoryMonitor(
    new ConfigManager("./config.prom.yaml"),
    new DummyLogger(),
    new DummyExecutor(),
).main(new DummyDataCollector())