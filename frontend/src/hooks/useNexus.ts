import { NexusSDK } from "@avail-project/nexus-core";

export async function getNexus(provider: any) {
  const sdk = new NexusSDK({
    network: import.meta.env.VITE_NEXUS_NETWORK || "testnet",
  });
  await sdk.initialize(provider);
  return sdk;
}
