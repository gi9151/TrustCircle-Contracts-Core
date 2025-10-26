import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { poolAbi as basePoolAbi } from "../services/contracts";
import { useTxToast } from "../services/blockscoutSdk";
import { parseUnits } from "viem";

/**
 * ClaimRequest
 * - submitClaim(amount, metadataURI)
 * - voteClaim(claimId, support)
 * - finalizeClaim(claimId)
 * - (Opcional UI) lista reclamos leyendo getClaim/claimsLength
 *
 * 🔧 Qué ajustar cuando tengas contratos reales:
 *  - poolAbi: si tus firmas/nombres difieren, actualiza el ABI en services/contracts.ts
 *
 * Nota: aquí extendemos el ABI de lectura localmente por si tu ABI base no incluye getters.
 * Si tu ABI oficial ya trae `getClaim` y `claimsLength`, borra `extendedAbi` y usa el de services.
 */

const readExtensions = [
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

const extendedAbi = [...basePoolAbi, ...readExtensions] as const;

type Props = {
  pool: `0x${string}`;
  tokenDecimals?: number; // por si quieres setearlo manualmente (fallback 18)
};

type ClaimView = {
  id: number;
  requester: string;
  amount: bigint;
  metadataURI: string;
  yesVotes: bigint;
  noVotes: bigint;
  finalized: boolean;
  approved: boolean;
};

export default function ClaimRequest({ pool, tokenDecimals = 18 }: Props) {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const toastTx = useTxToast();

  // Inputs para submitClaim
  const [amount, setAmount] = useState("5"); // unidades humanas (ej. 5.00 PYUSD)
  const [uri, setUri] = useState("");

  // Lectura de cantidad de reclamos
  const { data: rawLen, refetch: refetchLen } = useReadContract({
    address: pool,
    abi: extendedAbi,
    functionName: "claimsLength",
    query: { enabled: !!pool },
  });
  const claimsLen = Number(rawLen ?? 0n);

  // Cargar algunos reclamos (simple demo: los N primeros)
  const [claims, setClaims] = useState<ClaimView[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function loadClaims() {
      if (!claimsLen) {
        setClaims([]);
        return;
      }
      const list: ClaimView[] = [];
      // Nota: en producción, pagina esto si la lista crece
      for (let i = 0; i < claimsLen; i++) {
        try {
          const res = (await readClaim(pool, BigInt(i))) as any[];
          if (!res) continue;
          const c: ClaimView = {
            id: i,
            requester: res[0],
            amount: res[1],
            metadataURI: res[2],
            yesVotes: res[3],
            noVotes: res[4],
            finalized: res[5],
            approved: res[6],
          };
          list.push(c);
        } catch {}
      }
      if (!cancelled) setClaims(list);
    }
    loadClaims();
    return () => {
      cancelled = true;
    };
  }, [pool, claimsLen]);

  // Helper de lectura (usa wagmi hook ad-hoc por simplicidad)
  async function readClaim(addr: `0x${string}`, id: bigint) {
    // @ts-ignore – import dinámico para no romper tipado aquí
    const { readContract } = await import("@wagmi/core");
    // @ts-ignore – import de config si la usas (opcional). Si usas <WagmiConfig>, no hace falta aquí.
    // const { config } = await import("../wagmi");
    // return readContract(config, { address: addr, abi: extendedAbi, functionName: "getClaim", args: [id] });
    // Si usas solo hooks, hacemos una llamada directa de bajo nivel con viem (pero mantengamos simple):
    // Para mantenerlo portable aquí, mejor delega a un servicio propio si prefieres.
    return (window as any).__wagmiRead?.(addr, "getClaim", [id]) || null;
  }

  // Submit claim
  const onSubmitClaim = async () => {
    if (!address) return alert("Conecta tu wallet");
    if (!uri.trim()) return alert("Agrega una evidencia (IPFS URL)");

    const amountWei = parseHuman(amount, tokenDecimals);
    if (amountWei <= 0n) return alert("Amount inválido");

    try {
      const hash = await writeContractAsync({
        address: pool,
        abi: extendedAbi,
        functionName: "submitClaim",
        args: [amountWei, uri],
      });
      await toastTx(hash);
      setAmount("5");
      setUri("");
      await refetchLen();
    } catch (e) {
      console.error(e);
    }
  };

  // Vote
  const onVote = async (id: number, support: boolean) => {
    try {
      const hash = await writeContractAsync({
        address: pool,
        abi: extendedAbi,
        functionName: "voteClaim",
        args: [BigInt(id), support],
      });
      await toastTx(hash);
    } catch (e) {
      console.error(e);
    }
  };

  // Finalize
  const onFinalize = async (id: number) => {
    try {
      const hash = await writeContractAsync({
        address: pool,
        abi: extendedAbi,
        functionName: "finalizeClaim",
        args: [BigInt(id)],
      });
      await toastTx(hash);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="card p-3">
      <h5 className="mb-3">Claims</h5>

      <div className="mb-2">
        <label className="form-label">Amount (human)</label>
        <input
          className="form-control"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="5.00"
        />
      </div>
      <div className="mb-2">
        <label className="form-label">Evidence URI (IPFS / URL)</label>
        <input
          className="form-control"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="ipfs://..."
        />
      </div>
      <button
        className="btn btn-primary"
        disabled={isPending}
        onClick={onSubmitClaim}
      >
        {isPending ? "Submitting..." : "Submit Claim"}
      </button>

      <hr />

      <h6 className="mb-2">Existing claims ({claimsLen})</h6>
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
            <div className="small">Amount (wei): {c.amount.toString()}</div>
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
              Yes: {c.yesVotes.toString()} • No: {c.noVotes.toString()}
            </div>

            {!c.finalized && (
              <div className="mt-2 d-flex gap-2">
                <button
                  className="btn btn-outline-success btn-sm"
                  onClick={() => onVote(c.id, true)}
                >
                  Vote YES
                </button>
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => onVote(c.id, false)}
                >
                  Vote NO
                </button>
                <button
                  className="btn btn-outline-primary btn-sm ms-auto"
                  onClick={() => onFinalize(c.id)}
                >
                  Finalize
                </button>
              </div>
            )}
          </div>
        ))}
        {claimsLen === 0 && (
          <div className="list-group-item small text-muted">No claims yet.</div>
        )}
      </div>
    </div>
  );
}

function parseHuman(v: string, decimals: number) {
  try {
    return parseUnits(v || "0", decimals);
  } catch {
    return 0n;
  }
}

function short(a: string, n = 6) {
  return a ? `${a.slice(0, n)}…${a.slice(-n)}` : "";
}
