import { useState } from "react";
import { useWriteContract } from "wagmi";
import { ADDRS, factoryAbi } from "../services/contracts";
import { useTxToast } from "../services/blockscoutSdk";

/**
 * CreateCircle
 * - Llama a Factory.createCircle(token, name, quorumBps, endTime)
 * - Muestra toast de Blockscout con el tx hash
 *
 *  Qué ajustar cuando tengas contratos reales:
 *  - .env: VITE_FACTORY y VITE_TOKEN
 *  - factoryAbi (si cambian nombres/inputs)
 */
export default function CreateCircle() {
  const [name, setName] = useState("");
  const [quorumBps, setQuorumBps] = useState<number>(6000); // 6000 = 60%
  const [durationDays, setDurationDays] = useState<number>(7);
  const [tokenOverride, setTokenOverride] = useState<string>("");

  const { writeContractAsync, isPending } = useWriteContract();
  const toastTx = useTxToast();

  const FACTORY = ADDRS.FACTORY;
  const TOKEN = (tokenOverride || ADDRS.TOKEN) as `0x${string}` | undefined;

  const onCreate = async () => {
    if (!FACTORY) return alert("Configura .env: VITE_FACTORY");
    if (!TOKEN) return alert("Configura .env: VITE_TOKEN o escribe un token");

    if (!name.trim()) return alert("El nombre es requerido");
    if (quorumBps < 1 || quorumBps > 10000)
      return alert("quorumBps debe estar entre 1 y 10000");

    const endTime = Math.floor(Date.now() / 1000) + durationDays * 24 * 3600;

    try {
      const hash = await writeContractAsync({
        address: FACTORY,
        abi: factoryAbi,
        functionName: "createCircle",
        args: [TOKEN, name, BigInt(quorumBps), BigInt(endTime)],
      });
      await toastTx(hash);
      alert(
        "Circle creado (tx enviada). Revisa el toast y el popup de historial si quieres."
      );
      setName("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="card p-3">
      <h5 className="mb-3">Create Circle</h5>

      <div className="mb-2">
        <label className="form-label">Name</label>
        <input
          className="form-control"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Mascotas Rocky"
        />
      </div>

      <div className="row g-2">
        <div className="col">
          <label className="form-label">Quorum (bps)</label>
          <input
            type="number"
            className="form-control"
            value={quorumBps}
            onChange={(e) => setQuorumBps(Number(e.target.value))}
            placeholder="6000 = 60%"
            min={1}
            max={10000}
          />
        </div>
        <div className="col">
          <label className="form-label">Duration (days)</label>
          <input
            type="number"
            className="form-control"
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            min={1}
          />
        </div>
      </div>

      <div className="mt-2">
        <label className="form-label">Token (PYUSD) – opcional override</label>
        <input
          className="form-control"
          value={tokenOverride}
          onChange={(e) => setTokenOverride(e.target.value)}
          placeholder={ADDRS.TOKEN || "0xPYUSD..."}
        />
        <small className="text-muted">
          Si lo dejas vacío uso <code>VITE_TOKEN</code>:{" "}
          {ADDRS.TOKEN || "(no set)"}
        </small>
      </div>

      <button
        className="btn btn-success mt-3"
        disabled={isPending}
        onClick={onCreate}
      >
        {isPending ? "Creating..." : "Create Circle"}
      </button>
    </div>
  );
}
