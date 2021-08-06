import ConfigManager from "../utils/ConfigManager"
import SSH from "../utils/SSH"

class Test {
    run = () => {
        const cmg = new ConfigManager("./config.prom.yaml")
        const s = new SSH(cmg.config)

        s.exec("54.180.196.105", "export A=`date`; echo $A >> /home/ubuntu/a.out")
    }
}


const t = new Test()
t.run()