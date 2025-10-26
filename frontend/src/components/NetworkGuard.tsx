// src/components/NetworkGuard.tsx
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { CHAINS } from "../wagmi";

type Props = PropsWithChildren<{
  /** Si false (default): no bloquea cuando no hay wallet conectada */
  blockIfDisconnected?: boolean;
  /** Override opcional de chains permitidas (ids). Si no se pasa, toma de VITE_ALLOWED_CHAINS o CHAINS */
  allowedChainIds?: number[];
}>;

/** Lee allowedChainIds desde .env si existe, si no, usa CHAINS */
function readAllowedFromEnvOr(chains: number[]): number[] {
  const raw = import.meta.env.VITE_ALLOWED_CHAINS as string | undefined;
  if (!raw) return chains;
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

export default function NetworkGuard({
  children,
  blockIfDisconnected = false,
  allowedChainIds,
}: Props) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { chains: switchableChains, switchChain, isPending } = useSwitchChain();

  // Lista base de chains configuradas
  const baseChains = switchableChains?.length ? switchableChains : CHAINS;

  // Allowed finales (prop → env → default)
  const allowed = useMemo(
    () =>
      (allowedChainIds && allowedChainIds.length
        ? allowedChainIds
        : readAllowedFromEnvOr(CHAINS.map((c) => c.id))),
    [allowedChainIds]
  );

  // Ordena según la lista CHAINS
  const supportedChainsOrdered = useMemo(
    () => CHAINS.filter((c) => baseChains.some((x) => x.id === c.id) && allowed.includes(c.id)),
    [baseChains, allowed]
  );

  // Lógica de permiso:
  // - Si no hay wallet conectada y blockIfDisconnected = false → permitir
  // - Si hay wallet, debe estar en una allowed
  const ok =
    (!isConnected && !blockIfDisconnected) ||
    (typeof chainId === "number" && allowed.includes(chainId));

  if (ok) return <>{children}</>;

  return (
    <div className="container py-5">
      <div className="alert alert-warning">
        <h5 className="mb-2">Wrong network</h5>
        <p className="mb-3">
          Please switch to one of the supported testnets to continue:
        </p>

        <div className="d-flex flex-wrap gap-2">
          {supportedChainsOrdered.map((c) => {
            const same = chainId === c.id;
            return (
              <button
                key={c.id}
                className={`btn btn-sm ${same ? "btn-secondary" : "btn-outline-primary"}`}
                onClick={() => !same && switchChain?.({ chainId: c.id })}
                disabled={isPending || same || !switchChain}
                title={same ? "Already on this network" : ""}
              >
                {c.name} ({c.id})
              </button>
            );
          })}
          {supportedChainsOrdered.length === 0 && (
            <span className="text-muted small">
              No allowed chains configured. Check <code>VITE_ALLOWED_CHAINS</code> or your wagmi config.
            </span>
          )}
        </div>

        <p className="small text-muted mb-0 mt-3">
          Tip: If MetaMask doesn’t have the network, Wagmi will prompt to add it automatically.
        </p>
      </div>
    </div>
  );
}
