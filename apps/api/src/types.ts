import type { ActivityPage, ExplorerNetwork, NetworkHoldings, NftPage, ResolveResult } from "@w3s/explorer";

export type ApiKeyRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  rateLimitPerMinute: number;
  revoked: boolean;
};

export type KeyStore = {
  findByHash(hash: string): Promise<ApiKeyRecord | null>;
};

export type ExplorerService = {
  resolve(query: string): Promise<ResolveResult>;
  portfolio(address: string, networks: ExplorerNetwork[]): Promise<{ byNetwork: NetworkHoldings[]; totalUsd: number }>;
  nfts(address: string, network: ExplorerNetwork, cursor?: string | null): Promise<NftPage>;
  activity(address: string, network: ExplorerNetwork, cursor?: string | null): Promise<ActivityPage>;
};

export type RequestLogEntry = {
  organizationId: string;
  projectId: string;
  apiKeyId: string;
  method: string;
  route: string;
  path: string;
  status: number;
  durationMs: number;
  errorCode: string | null;
  ip: string | null;
  createdAt: Date;
};

export type QuotaResult = { used: number; limit: number; plan: string; resetsAt: Date };

export type QuotaStore = {
  consume(organizationId: string): Promise<QuotaResult | null>;
};

export type LogSink = {
  push(entry: RequestLogEntry): void;
};

declare module "fastify" {
  interface FastifyRequest {
    apiKey?: ApiKeyRecord;
    errorCode?: string;
  }
}
