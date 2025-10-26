// src/components/NavBar.tsx
import { useMemo } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { CHAINS } from "../wagmi";
import WalletButtons from "./WalletButtons";

export default function NavBar() {
  const chainId = useChainId();
  const { chains, switchChain, isPending: isSwitching } = useSwitchChain();

  // Ordena según tu lista CHAINS
  const orderedChains = useMemo(
    () => CHAINS.filter((c) => chains.some((x) => x.id === c.id)),
    [chains]
  );

  const currentChainName =
    orderedChains.find((c) => c.id === chainId)?.name ?? "Unknown";

  return (
    <nav className="border-bottom bg-white">
      <div className="container d-flex align-items-center justify-content-between py-2">
        <div className="d-flex align-items-center gap-2">
          <span className="fw-bold">Trust Circles</span>
          <span className="badge text-bg-light">{currentChainName}</span>
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* Selector de red */}
          <select
            className="form-select form-select-sm"
            style={{ width: 200 }}
            value={String(chainId)}
            onChange={(e) => {
              const id = Number(e.target.value);
              const target = chains.find((c) => c.id === id);
              if (target) switchChain({ chainId: target.id });
            }}
            disabled={isSwitching}
          >
            {orderedChains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>

          {/* Tu botón reutilizable */}
          <WalletButtons />
        </div>
      </div>
    </nav>
  );
}
