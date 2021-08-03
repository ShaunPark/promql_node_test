import { PrometheusDriver } from "prometheus-query"

class PromTest {
    private prom
    constructor() {
        this.prom = new PrometheusDriver({
            endpoint: "http://10.0.0.8:30003",
            baseURL: "/api/v1" // default value
        })
    }

    run = async () => {
        const q = 'node_memory_Cached_bytes{instance="10.0.0.8:9100", job="server-info"}'
        const { result, resultType } = await this.prom.instantQuery(q)
        console.log(JSON.stringify(result))
        console.log(JSON.stringify(resultType))

    }

    run2 = async () => {
        const q = 'node_memory_Cached_bytes{instance="10.0.0.8:9100", job="server-info"}'

        const now = Date.now()
        const start = now - 60 * 60 * 1000
        const end = now
        const step = 60
        const result = await (await this.prom.rangeQuery(q, start, end, step)).result as range[]

        result.forEach( r => {
            r.values.forEach( v => {
                console.log(JSON.stringify(v))
            })
        })
    }
}

type range = {
    metric:object,
    values:Array<{time:Date, value:number}>
}

new PromTest().run2()