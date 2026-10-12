import { rpc } from "./alchemy";
import { cached } from "./cache";
import { networkBySlug } from "./networks";

export async function getHeadBlock(slug: string): Promise<number | null> {
  const net = networkBySlug(slug);
  if (!net) return null;
  try {
    return await cached(`head:${slug}`, 8, async () => Number.parseInt(await rpc<string>(net.alchemy, "eth_blockNumber", []), 16));
  } catch {
    return null;
  }
}
