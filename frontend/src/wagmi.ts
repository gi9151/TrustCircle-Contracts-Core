// src/wagmi.ts
import { http, createConfig } from "wagmi";
import { baseSepolia, arbitrumSepolia, optimismSepolia } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

const WC_ID = import.meta.env.VITE_WC_PROJECT_ID || "demo";

// Redes testnets para el hack
export const CHAINS = [baseSepolia, arbitrumSepolia, optimismSepolia] as const;

export const config = createConfig({
  chains: CHAINS,
  transports: {
    [baseSepolia.id]: http(), // se puede pasar RPC propio (opcional)
    [arbitrumSepolia.id]: http(),
    [optimismSepolia.id]: http(),
  },
  connectors: [
    injected({ target: "metaMask" }),
    walletConnect({ projectId: WC_ID }),
    coinbaseWallet({ appName: "Trust Circles" }),
  ],
});

// Helpers útiles
export const SUPPORTED_CHAIN_IDS = new Set<number>(CHAINS.map((c) => c.id));
export function isSupportedChainId(id?: number) {
  return typeof id === "number" && SUPPORTED_CHAIN_IDS.has(id);
}
