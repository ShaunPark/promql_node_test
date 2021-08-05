import { readFileSync } from 'fs';
import { Client } from 'ssh2';
import IConfig from '../types/Type';
import Log from './Logger'

class SSH {

    constructor(private config: IConfig) { }

    public exec(ipAddress: string, command:string) {
        try {
            const sshFile = this.config.ssh.sshPemFile;
            const sshUser = this.config.ssh.sshUser;
            const conn = new Client();

            if (sshFile) {
                conn
                    .on('error', (err) => { Log.error(err) })
                    .on('end', () => { Log.info("[SSH.exec] Connection ended") })
                    .on('close', () => { Log.info("[SSH.exec] Connection closed") })
                    .on('ready', () => {
                        Log.debug('[SSH.exec] SShClient ready');
                        try {
                            conn.exec(command, (err: any, stream: any) => {
                                if (err !== undefined) {
                                    Log.error(`[SSH.exec] ${err}`)
                                }
                                stream.on('close', (code: any, signal: any) => {
                                    conn.end();
                                });
                            });
                        } catch (err) {
                            Log.error(`[SSH.exec] ${err}-`)
                        }
                    })
                    .connect({
                        host: ipAddress,
                        port: 22,
                        username: sshUser,
                        privateKey: readFileSync(sshFile)
                    });

            } else {
                Log.info(`[SSH.exec]cert file for ssh path is not defined in config file.`)
            }
        } catch (err) {
            console.error(`[SSH.exec]Fail to exec ${ipAddress} - ${command}.`, err)
            throw err
        }
    }
}

export default SSH;