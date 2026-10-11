export type ExplorerErrorCode = "network_disabled" | "rate_limited" | "plan_limit" | "upstream" | "not_configured";

export class ExplorerError extends Error {
  constructor(
    readonly code: ExplorerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ExplorerError";
  }
}

export function classifyUpstream(status: number, body: string): ExplorerError {
  if (/is not enabled for this app/i.test(body)) return new ExplorerError("network_disabled", "This network is not enabled for the Alchemy app.");
  if (status === 429 || /rate limit|compute units/i.test(body)) return new ExplorerError("rate_limited", "The data provider is rate limiting requests.");
  if (/upgrade|payg|plan/i.test(body)) return new ExplorerError("plan_limit", "This request needs a paid data provider plan.");
  return new ExplorerError("upstream", `Data provider error (${status}).`);
}
