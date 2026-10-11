import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@w3s/db";
import { networks } from "@w3s/explorer";
import { listChannels } from "@/lib/monitoring";

export async function formData(organizationId: string) {
  const [channels, saved] = await Promise.all([
    listChannels(organizationId),
    db
      .select({ address: schema.savedAddress.address, label: schema.savedAddress.label, ensName: schema.savedAddress.ensName })
      .from(schema.savedAddress)
      .where(eq(schema.savedAddress.organizationId, organizationId))
      .orderBy(desc(schema.savedAddress.createdAt)),
  ]);
  return {
    networks: networks.map((n) => ({ slug: n.slug, name: n.name, testnet: n.testnet })),
    channels: channels.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
    saved,
  };
}
