import { PrometheusDriver } from "prometheus-query";
import { MemoryCache } from "../types/Type";

export interface DataCollector {
    getCacheMemory: (nodes: Map<string, MemoryCache>) => Promise<void>
    getTotalMemory: (nodes: Map<string, MemoryCache>) => Promise<void>
}