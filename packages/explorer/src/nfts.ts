import { dataApi } from "./alchemy";
import { cached } from "./cache";
import { ExplorerError, type ExplorerErrorCode } from "./errors";
import { decodeCursor, encodeCursor } from "./format";
import type { ExplorerNetwork } from "./networks";

export type NftItem = {
  network: string;
  contract: string;
  tokenId: string;
  name: string;
  collection: string | null;
  image: string | null;
  tokenType: string;
  balance: string;
};

export type NftPage = {
  items: NftItem[];
  spamHidden: number;
  nextCursor: string | null;
  error: ExplorerErrorCode | null;
};

type RawNft = {
  tokenId: string;
  balance?: string;
  tokenType: string;
  name: string | null;
  image?: { thumbnailUrl?: string | null; cachedUrl?: string | null; pngUrl?: string | null } | null;
  collection?: { name: string | null } | null;
  contract: { address: string; name: string | null; isSpam?: boolean | null };
};

const WANT = 24;
const MAX_SCAN_PAGES = 5;

export function parseNft(network: ExplorerNetwork, n: RawNft): NftItem {
  return {
    network: network.slug,
    contract: n.contract.address,
    tokenId: n.tokenId,
    name: n.name || `${n.contract.name ?? "Token"} #${n.tokenId.length > 10 ? `${n.tokenId.slice(0, 8)}…` : n.tokenId}`,
    collection: n.collection?.name ?? n.contract.name ?? null,
    image: n.image?.thumbnailUrl ?? n.image?.cachedUrl ?? n.image?.pngUrl ?? null,
    tokenType: n.tokenType,
    balance: n.balance ?? "1",
  };
}

async function load(address: string, network: ExplorerNetwork, startKey?: string): Promise<NftPage> {
  const items: NftItem[] = [];
  let spamHidden = 0;
  let pageKey = startKey;
  let scanned = 0;
  do {
    const res = await dataApi<{ data: { ownedNfts: RawNft[]; pageKey?: string } }>("assets/nfts/by-address", {
      addresses: [{ address, networks: [network.alchemy] }],
      withMetadata: true,
      pageSize: 100,
      pageKey,
    });
    for (const n of res.data.ownedNfts) {
      if (n.contract.isSpam) spamHidden++;
      else items.push(parseNft(network, n));
    }
    pageKey = res.data.pageKey;
    scanned++;
  } while (pageKey && items.length < WANT && scanned < MAX_SCAN_PAGES);

  return { items, spamHidden, nextCursor: pageKey ? encodeCursor({ k: pageKey }) : null, error: null };
}

export async function getNfts(address: string, network: ExplorerNetwork, cursor?: string | null): Promise<NftPage> {
  const start = decodeCursor<{ k: string }>(cursor)?.k;
  try {
    return await cached(`nfts:${network.slug}:${address.toLowerCase()}:${start ?? "0"}`, 300, () => load(address, network, start));
  } catch (err) {
    return { items: [], spamHidden: 0, nextCursor: null, error: err instanceof ExplorerError ? err.code : "upstream" };
  }
}
