import { PrometheusDriver } from "prometheus-query";
import { DataCollector } from "../dataCollector/DateCollector";
import { MemoryCache } from "../types/Type";

class DummyDataCollector implements DataCollector {
    getCacheMemory = async (nodes: Map<string, MemoryCache>) => {
        return Promise.resolve()
    }
    getTotalMemory = async (nodes: Map<string, MemoryCache>) =>{
        return Promise.resolve()
    }
}