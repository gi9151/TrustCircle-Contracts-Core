import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
} from "wagmi";
import type { Address } from "viem";
import { ADDRS, factoryAbi } from "../services/contracts";

// Componentes principales
import CreateCircle from "./CreateCircle";
import JoinCircle from "./JoinCircle";
import ClaimRequest from "./ClaimRequest";
import CircleDetail from "./CircleDetail";

// Blockscout history popup
import { useHistoryPopup } from "../services/blockscoutSdk";

/* ============================================================
   Utils locales
   ============================================================ */
const LS_KEY = "tc_last_pool";

// Debouncer simple para inputs
function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function short(a?: string, n = 6) {
  if (!a) return "—";
  return `${a.slice(0, n)}…${a.slice(-n)}`;
}
function isAddress(v?: string): v is string {
  return /^0x[a-fA-F0-9]{40}$/.test(v || "");
}

/* ============================================================
   Explorador de Factory (lista de pools)
   ============================================================ */
function FactoryExplorer({ onSelect }: { onSelect: (addr: Address) => void }) {
  const FACTORY = ADDRS.FACTORY;
  const {
    data: len,
    isLoading: lenLoading,
    error: lenError,
  } = useReadContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "circlesLength",
    query: { enabled: Boolean(FACTORY) },
  });

  const count = Number(len ?? 0n);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const pages = Math.ceil(count / pageSize) || 1;

  const publicClient = usePublicClient();
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reset de página si cambia el total
  useEffect(() => {
    setPage(0);
  }, [count]);

  useEffect(() => {
    if (!publicClient || !FACTORY || !count) {
      setItems([]);
      return;
    }
    const start = page * pageSize;
    const end = Math.min(count, start + pageSize);
    const client = publicClient;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const calls = Array.from({ length: end - start }, (_, i) => ({
          address: FACTORY as Address,
          abi: factoryAbi,
          functionName: "circles" as const,
          args: [BigInt(start + i)],
        }));

        const res = await client.multicall({ contracts: calls });
        const list: Address[] = res
          .map((r) => (r.status === "success" ? (r.result as Address) : undefined))
          .filter(Boolean) as Address[];
        setItems(list);
      } catch (e) {
        console.error("multicall circles[] failed", e);
        setLoadError("Failed to load pools from Factory");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [publicClient, FACTORY, count, page]);

  if (!FACTORY)
    return (
      <div className="alert alert-warning">
        Configura <code>VITE_FACTORY</code> para listar pools desde la Factory.
      </div>
    );

  if (lenError) {
    return (
      <div className="alert alert-danger">
        Error reading <code>circlesLength</code>.
      </div>
    );
  }

  return (
    <div className="card p-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">Factory Pools</h6>
        <span className="text-muted small">
          {lenLoading ? "Loading…" : `Total: ${count}`}
        </span>
      </div>

      <div className="list-group">
        {loading && <div className="list-group-item small">Loading…</div>}
        {loadError && (
          <div className="list-group-item small text-danger">{loadError}</div>
        )}

        {!loading &&
          !loadError &&
          items.map((addr) => (
            <button
              key={addr}
              className="list-group-item list-group-item-action text-start"
              onClick={() => onSelect(addr)}
            >
              {short(addr)}
            </button>
          ))}

        {!loading && !loadError && count === 0 && (
          <div className="list-group-item small text-muted">No circles yet.</div>
        )}
      </div>

      {pages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <div className="small text-muted">
            Page {Math.min(page + 1, pages)} / {pages}
          </div>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Página principal de Circles
   ============================================================ */
export default function CirclePage() {
  const { address: user } = useAccount();
  const history = useHistoryPopup();

  // Carga inicial: env (ADDRS.POOL) o último pool local
  const initial = ADDRS.POOL || localStorage.getItem(LS_KEY) || "";
  const [poolInput, setPoolInput] = useState<string>(initial);
  const debouncedPool = useDebounced(poolInput, 200);

  const currentPool = useMemo(
    () => (isAddress(debouncedPool) ? (debouncedPool as Address) : undefined),
    [debouncedPool]
  );

  // Persistir último pool válido
  useEffect(() => {
    if (currentPool) localStorage.setItem(LS_KEY, currentPool);
  }, [currentPool]);

  return (
    <div className="container py-4">
      <header className="mb-4 d-flex align-items-center justify-content-between">
        <div>
          <h2>Trust Circles</h2>
          <p className="text-muted mb-0">
            Create, explore and manage collaborative insurance pools.
          </p>
        </div>

        {currentPool && (
          <div className="d-flex gap-2">
            {/* Link directo (ajusta dominio del explorer si quieres otro) */}
            <a
              className="btn btn-sm btn-outline-secondary"
              href={`https://blockscout.com/address/${currentPool}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Blockscout
            </a>
            {/* Popup del SDK */}
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => history.openAddressHistory(currentPool)}
            >
              Tx History
            </button>
          </div>
        )}
      </header>

      <div className="row g-4">
        {/* Lado izquierdo: crear + seleccionar */}
        <div className="col-lg-4">
          <CreateCircle />

          <div className="card p-3 mt-3">
            <h6 className="mb-2">Select Circle</h6>
            <input
              className="form-control"
              value={poolInput}
              onChange={(e) => setPoolInput(e.target.value.trim())}
              placeholder={ADDRS.POOL || "0xPoolAddress..."}
            />
            <small className="text-muted">
              Paste a pool address or pick one from the Factory (below).
            </small>
          </div>

          <div className="mt-3">
            <FactoryExplorer onSelect={(addr) => setPoolInput(addr)} />
          </div>
        </div>

        {/* Lado derecho: detalle + acciones */}
        <div className="col-lg-8">
          {!currentPool ? (
            <div className="alert alert-info">
              Choose a <strong>pool</strong> (valid address) to view details.
            </div>
          ) : (
            <>
              <CircleDetail pool={currentPool} />
              <div className="row g-3 mt-3">
                <div className="col-md-6">
                  <JoinCircle pool={currentPool} />
                </div>
                <div className="col-md-6">
                  <ClaimRequest pool={currentPool} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="mt-4 text-center text-muted small">
        {user ? (
          <>Connected as {short(user)} · Ready to collaborate</>
        ) : (
          <>Connect your wallet to create or join a Trust Circle</>
        )}
      </footer>
    </div>
  );
}
