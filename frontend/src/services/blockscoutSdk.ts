// src/services/blockscoutSdk.ts
import { useChainId } from "wagmi";
import { useNotification, useTransactionPopup } from "@blockscout/app-sdk";

/** Obtiene el chainId como string, con fallback a .env o 84532 */
function getChainIdString(active?: number): string {
  const fallback = import.meta.env.VITE_BLOCKSCOUT_CHAIN_ID || "84532";
  return String(typeof active === "number" ? active : fallback);
}

/** Toast sincronizado con la red activa (wagmi). */
export function useTxToastSynced(overrideChainId?: number | string) {
  const active = useChainId();
  const chainId = String(overrideChainId ?? getChainIdString(active));
  const { openTxToast } = useNotification();

  return async (hash: `0x${string}`) => {
    // Validación suave 
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      console.warn("[useTxToastSynced] Invalid tx hash:", hash);
      return;
    }
    await openTxToast(chainId, hash);
  };
}

/** Alias para compatibilidad con tu código existente. */
export function useTxToast() {
  return useTxToastSynced();
}

/** Popup de historial sincronizado con la red activa (wagmi). */
export function useHistoryPopupSynced(overrideChainId?: number | string) {
  const active = useChainId();
  const chainId = String(overrideChainId ?? getChainIdString(active));
  const { openPopup } = useTransactionPopup();

  return {
    openAddressHistory: (address: `0x${string}`) => {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        console.warn("[useHistoryPopupSynced] Invalid address:", address);
        return;
      }
      return openPopup({ chainId, address });
    },
    openChainHistory: () => openPopup({ chainId }),
  };
}

/** Alias corto opcional. */
export function useHistoryPopup() {
  return useHistoryPopupSynced();
}
