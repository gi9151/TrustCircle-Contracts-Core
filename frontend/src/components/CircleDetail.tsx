import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import { useTransactionPopup } from "@blockscout/app-sdk";
import { erc20Abi, poolAbi as basePoolAbi } from "../services/contracts";

// 🔧 Extensiones de ABI de lectura (si tu ABI final ya trae estos getters, puedes eliminarlas)
const readExtensions = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "quorumBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "endTime",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalShares",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "shares",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimsLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getClaim",
    stateMutability: "view",
    inputs: [{ name: "claimId", type: "uint256" }],
    outputs: [
      { type: "address" }, // requester
      { type: "uint256" }, // amount
      { type: "string" }, // metadataURI
      { type: "uint256" }, // yesVotes
      { type: "uint256" }, // noVotes
      { type: "bool" }, // finalized
      { type: "bool" }, // approved
    ],
  },
] as const;

const poolAbi = [...basePoolAbi, ...readExtensions] as const;

type ClaimView = {
  id: number;
  requester: Address;
  amount: bigint;
  metadataURI: string;
  yesVotes: bigint;
  noVotes: bigint;
  finalized: boolean;
  approved: boolean;
};

type Props = {
  pool: Address; // dirección del pool (0x...)
  tokenDecimalsFallback?: number; // fallback por si no se puede leer decimals (default 18)
  pageSize?: number; // cuántos claims mostrar por página
};

export default function CircleDetail({
  pool,
  tokenDecimalsFallback = 18,
  pageSize = 10,
}: Props) {
  const { address: user } = useAccount();
  const publicClient = usePublicClient();
  const { openPopup } = useTransactionPopup();
  const CHAIN_ID = String(import.meta.env.VITE_BLOCKSCOUT_CHAIN_ID || "84532");

  // ===== Lecturas básicas del pool =====
  const { data: name } = useReadContract({
    address: pool,
    abi: poolAbi,
    functionName: "name",
    query: { enabled: !!pool },
  });

  const { data: tokenAddr } = useReadContract({
    address: pool,
    abi: poolAbi,
    functionName: "token",
    query: { enabled: !!pool },
  });
  const token = tokenAddr as Address | undefined;

  const { data: quorumBps } = useReadContract({
    address: pool,
    abi: poolAbi,
    functionName: "quorumBps",
    query: { enabled: !!pool },
  });

  const { data: endTime } = useReadContract({
    address: pool,
    abi: poolAbi,
    functionName: "endTime",
    query: { enabled: !!pool },
  });

  const { data: totalShares } = useReadContract({
    address: pool,
    abi: poolAbi,
    functionName: "totalShares",
    query: { enabled: !!pool },
  });

  const { data: myShares } = useReadContract({
    address: pool,
    abi: poolAbi,
    functionName: "shares",
    args: user ? [user] : undefined,
    query: { enabled: !!pool && !!user },
  });

  // ===== Token info / balance del pool =====
  const { data: decimals } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!token },
  });

  const { data: poolTokenBalance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [pool],
    query: { enabled: !!token },
  });

  const d = typeof decimals === "number" ? decimals : tokenDecimalsFallback;

  const totalSharesFmt = useMemo(
    () => (typeof totalShares === "bigint" ? formatUnits(totalShares, d) : "0"),
    [totalShares, d]
  );

  const poolBalFmt = useMemo(
    () =>
      typeof poolTokenBalance === "bigint"
        ? formatUnits(poolTokenBalance, d)
        : "0",
    [poolTokenBalance, d]
  );

  const mySharePct = useMemo(() => {
    if (
      typeof myShares !== "bigint" ||
      typeof totalShares !== "bigint" ||
      totalShares === 0n
    )
      return "0%";
    const pct = Number((myShares * 10000n) / totalShares) / 100; // 2 decimales
    return `${pct.toFixed(2)}%`;
  }, [myShares, totalShares]);

  const timeLeft = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const end = Number(endTime ?? 0n);
    const diff = Math.max(0, end - now);
    if (!end) return "—";
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    return diff > 0 ? `${days}d ${hours}h` : "ended";
  }, [endTime]);

  // ===== Claims: paginado simple con multicall =====
  const { data: rawLen } = useReadContract({
    address: pool,
    abi: poolAbi,
    functionName: "claimsLength",
    query: { enabled: !!pool },
  });
  const claimsLen = Number(rawLen ?? 0n);

  const [page, setPage] = useState(0);
  const pages = Math.ceil(claimsLen / pageSize);

  const [claims, setClaims] = useState<ClaimView[]>([]);

  useEffect(() => {
    if (!publicClient || !pool || claimsLen === 0) {
      setClaims([]);
      return;
    }
    const start = page * pageSize;
    const end = Math.min(claimsLen, start + pageSize);

    async function loadPage() {
      // narrow publicClient into a local constant so TypeScript understands it's checked
      const pc = publicClient;
      if (!pc) {
        setClaims([]);
        return;
      }
      const calls = [];
      for (let i = start; i < end; i++) {
        calls.push({
          address: pool,
          abi: poolAbi,
          functionName: "getClaim" as const,
          args: [BigInt(i)],
        });
      }
      try {
        const res = await pc.multicall({ contracts: calls });
        const list: ClaimView[] = res.map((r, idx) => {
          const id = start + idx;
          if (r.status !== "success" || !Array.isArray(r.result)) {
            return {
              id,
              requester: "0x0000000000000000000000000000000000000000",
              amount: 0n,
              metadataURI: "",
              yesVotes: 0n,
              noVotes: 0n,
              finalized: false,
              approved: false,
            };
          }
          const arr = r.result as any[];
          return {
            id,
            requester: arr[0] as Address,
            amount: arr[1] as bigint,
            metadataURI: arr[2] as string,
            yesVotes: arr[3] as bigint,
            noVotes: arr[4] as bigint,
            finalized: arr[5] as boolean,
            approved: arr[6] as boolean,
          };
        });
        setClaims(list);
      } catch (e) {
        console.error("multicall getClaim page failed", e);
        setClaims([]);
      }
    }
    loadPage();
  }, [publicClient, pool, claimsLen, page, pageSize]);

  // ===== UI helpers =====
  const tokenLabel = token ? short(token) : "—";
  const quorumLabel =
    typeof quorumBps === "bigint" ? `${Number(quorumBps) / 100}%` : "—";

  return (
    <div className="card p-3">
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <h4 className="mb-1">{name || "Trust Circle"}</h4>
          <div className="text-muted small">
            {short(pool)} • Token: {tokenLabel}
          </div>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => openPopup({ chainId: CHAIN_ID, address: pool })}
          >
            View Pool History
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => openPopup({ chainId: CHAIN_ID })}
          >
            View Chain History
          </button>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-sm-6 col-lg-3">
          <div className="p-3 border rounded-3">
            <div className="text-muted small">Quorum</div>
            <div className="fs-5">{quorumLabel}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="p-3 border rounded-3">
            <div className="text-muted small">Time left</div>
            <div className="fs-5">{timeLeft}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="p-3 border rounded-3">
            <div className="text-muted small">Pool balance</div>
            <div className="fs-5">{poolBalFmt}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="p-3 border rounded-3">
            <div className="text-muted small">Total shares</div>
            <div className="fs-5">{totalSharesFmt}</div>
            <div className="text-muted small">Your share: {mySharePct}</div>
          </div>
        </div>
      </div>

      <hr />

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0">Claims</h5>
        <span className="text-muted small">Total: {claimsLen}</span>
      </div>

      <div className="list-group">
        {claims.map((c) => (
          <div key={c.id} className="list-group-item">
            <div className="d-flex justify-content-between">
              <strong>Claim #{c.id}</strong>
              <span
                className={`badge ${
                  c.finalized
                    ? c.approved
                      ? "text-bg-success"
                      : "text-bg-danger"
                    : "text-bg-secondary"
                }`}
              >
                {c.finalized
                  ? c.approved
                    ? "APPROVED"
                    : "REJECTED"
                  : "PENDING"}
              </span>
            </div>
            <div className="small text-muted">
              Requester: {short(c.requester)}
            </div>
            <div className="small">Amount: {formatUnitsSafe(c.amount, d)}</div>
            <div className="small">
              Evidence:{" "}
              {c.metadataURI ? (
                <a href={c.metadataURI} target="_blank" rel="noreferrer">
                  {c.metadataURI}
                </a>
              ) : (
                "(none)"
              )}
            </div>
            <div className="small mt-1">
              Yes: {formatUnitsSafe(c.yesVotes, d)} • No:{" "}
              {formatUnitsSafe(c.noVotes, d)}
            </div>
          </div>
        ))}
        {claimsLen === 0 && (
          <div className="list-group-item small text-muted">No claims yet.</div>
        )}
      </div>

      {pages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <div className="small text-muted">
            Page {page + 1} / {pages}
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

// ===== helpers =====
function short(a?: string, n = 6) {
  if (!a) return "—";
  return `${a.slice(0, n)}…${a.slice(-n)}`;
}

function formatUnitsSafe(v: bigint, d: number) {
  try {
    return formatUnits(v, d);
  } catch {
    return v.toString();
  }
}
