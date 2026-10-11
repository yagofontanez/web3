export type EndpointDoc = {
  id: string;
  method: "GET";
  path: string;
  summary: string;
  params: { name: string; in: "path" | "query"; required?: boolean; description: string }[];
  example: string;
  response: string;
};

export const endpoints: EndpointDoc[] = [
  {
    id: "portfolio",
    method: "GET",
    path: "/v1/addresses/{address}/portfolio",
    summary: "Total value of a wallet and how it splits across networks.",
    params: [
      { name: "address", in: "path", required: true, description: "A 0x address or an ENS name like vitalik.eth." },
      { name: "networks", in: "query", description: "Comma-separated network slugs. Defaults to every mainnet." },
    ],
    example: "/v1/addresses/vitalik.eth/portfolio",
    response: `{
  "data": {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "ens": "vitalik.eth",
    "totalUsd": 24175.33,
    "networks": [
      { "network": "ethereum", "totalUsd": 14544.44, "tokenCount": 321, "pricedTokenCount": 15, "error": null }
    ]
  }
}`,
  },
  {
    id: "tokens",
    method: "GET",
    path: "/v1/addresses/{address}/tokens",
    summary: "Token balances on one network, priced in USD. Unpriced tokens are hidden unless you ask for them.",
    params: [
      { name: "address", in: "path", required: true, description: "A 0x address or an ENS name." },
      { name: "network", in: "query", description: "Network slug. Defaults to ethereum." },
      { name: "includeUnpriced", in: "query", description: "Set to true to include tokens without a market price." },
    ],
    example: "/v1/addresses/vitalik.eth/tokens?network=base",
    response: `{
  "data": [
    { "contract": null, "symbol": "ETH", "name": "Base native token", "decimals": 18,
      "balance": "3.1288", "priceUsd": 2497.12, "valueUsd": 7813.04, "logo": null }
  ],
  "meta": { "address": "0xd8dA…6045", "network": "base", "totalUsd": 7883.95, "truncated": true, "unpricedHidden": 379 }
}`,
  },
  {
    id: "nfts",
    method: "GET",
    path: "/v1/addresses/{address}/nfts",
    summary: "NFTs held on one network, with spam filtered out. Paginate with the returned cursor.",
    params: [
      { name: "address", in: "path", required: true, description: "A 0x address or an ENS name." },
      { name: "network", in: "query", description: "Network slug. Defaults to ethereum." },
      { name: "cursor", in: "query", description: "The nextCursor from the previous page." },
    ],
    example: "/v1/addresses/brantly.eth/nfts?network=ethereum",
    response: `{
  "data": [
    { "contract": "0x57f1…5d4c", "tokenId": "1234", "name": "brantly.eth", "collection": "ENS",
      "image": "https://…", "tokenType": "ERC721", "balance": "1" }
  ],
  "meta": { "network": "ethereum", "spamHidden": 12, "nextCursor": "eyJrIjoi…" }
}`,
  },
  {
    id: "activity",
    method: "GET",
    path: "/v1/addresses/{address}/activity",
    summary: "Incoming and outgoing transfers on one network, newest first.",
    params: [
      { name: "address", in: "path", required: true, description: "A 0x address or an ENS name." },
      { name: "network", in: "query", description: "Network slug. Defaults to ethereum." },
      { name: "cursor", in: "query", description: "The nextCursor from the previous page." },
    ],
    example: "/v1/addresses/vitalik.eth/activity?network=base",
    response: `{
  "data": [
    { "hash": "0x39a9…", "blockNumber": 26149582, "timestamp": "2026-10-10T13:02:59.000Z",
      "direction": "in", "category": "erc20", "asset": "USDC", "value": 250, "counterparty": "0x80e4…6372", "verified": true }
  ],
  "meta": { "network": "base", "nextCursor": "eyJpbiI6…" }
}`,
  },
  {
    id: "resolve",
    method: "GET",
    path: "/v1/resolve/{name}",
    summary: "Resolve an ENS name, including Base names, to an address.",
    params: [{ name: "name", in: "path", required: true, description: "An ENS name like jesse.base.eth." }],
    example: "/v1/resolve/jesse.base.eth",
    response: `{ "data": { "name": "jesse.base.eth", "address": "0x2211d1D0020DAEA8039E46Cf1367962070d77DA9" } }`,
  },
  {
    id: "networks",
    method: "GET",
    path: "/v1/networks",
    summary: "Networks the API can read, with the slugs to use in other calls.",
    params: [],
    example: "/v1/networks",
    response: `{ "data": [ { "slug": "base", "name": "Base", "chainId": 8453, "testnet": false, "nativeSymbol": "ETH" } ] }`,
  },
];

export const errors = [
  { status: 400, code: "bad_request", meaning: "A parameter is missing or invalid. The message says which." },
  { status: 401, code: "unauthorized", meaning: "The key is missing, malformed, unknown or revoked." },
  { status: 404, code: "not_found", meaning: "The route or the ENS name doesn't exist." },
  { status: 429, code: "rate_limited", meaning: "The key went over its per-minute limit. Wait for Retry-After seconds." },
  { status: 502, code: "upstream_*", meaning: "The blockchain data provider failed. Safe to retry with backoff." },
];
