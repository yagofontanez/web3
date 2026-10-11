import "server-only";
import { cache } from "react";
import { getPortfolio, mainnets, resolveQuery } from "@w3s/explorer";

export const resolveAddress = cache((query: string) => resolveQuery(decodeURIComponent(query)));
export const portfolioFor = cache((address: string) => getPortfolio(address, mainnets));

export const ERROR_COPY: Record<string, string> = {
  network_disabled: "This network isn't enabled in your Alchemy app yet. Turn it on in the Alchemy dashboard under Networks.",
  rate_limited: "The data provider is rate limiting us. Try again in a few seconds.",
  plan_limit: "This data needs a paid Alchemy plan.",
  not_configured: "ALCHEMY_API_KEY is missing from the server environment.",
  upstream: "The data provider returned an error. Try again shortly.",
};
