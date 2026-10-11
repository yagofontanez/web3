export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = (message = "Send your API key in the Authorization header as `Bearer w3s_live_…`.") =>
  new HttpError(401, "unauthorized", message);
export const badRequest = (message: string) => new HttpError(400, "bad_request", message);
export const notFound = (message: string) => new HttpError(404, "not_found", message);
export const upstream = (code: string, message: string) => new HttpError(code === "rate_limited" ? 503 : 502, `upstream_${code}`, message);
