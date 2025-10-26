import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { erc20Abi, poolAbi, ADDRS } from "../services/contracts";
import { parseUnits } from "viem";
import { useTxToast } from "../services/blockscoutSdk";

type Props = { pool: `0x${string}` };

export default function JoinCircle({ pool }: Props) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("10"); // monto en unidades humanas
  const toastTx = useTxToast();
  const { writeContractAsync, isPending } = useWriteContract();

  // 1) Descubre el token del pool (PYUSD) si no pasaste VITE_TOKEN
  const { data: tokenAddr } = useReadContract({
    address: pool,
    abi: poolAbi,
    functionName: "token",
    query: { enabled: !!pool },
  });

  const TOKEN = (ADDRS.TOKEN ?? (tokenAddr as `0x${string}`)) as `0x${string}`;

  // 2) Lee decimals para parsear correctamente
  const { data: decimals } = useReadContract({
    address: TOKEN,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!TOKEN },
  });

  const amountWei = useMemo(() => {
    const d = typeof decimals === "number" ? decimals : 18; // fallback 18
    try {
      return parseUnits(amount || "0", d);
    } catch {
      return 0n;
    }
  }, [amount, decimals]);

  // 3) Consulta allowance actual
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && pool ? [address, pool] : undefined,
    query: { enabled: !!address && !!pool && !!TOKEN },
  });

  const needsApprove = useMemo(() => {
    const a = typeof allowance === "bigint" ? allowance : 0n;
    return amountWei > a;
  }, [allowance, amountWei]);

  // 4) approve (si hace falta) y contribute
  const handleContribute = async () => {
    if (!address) return alert("Conecta tu wallet");
    if (!TOKEN) return alert("Token no configurado");

    try {
      if (needsApprove) {
        const hashApprove = await writeContractAsync({
          address: TOKEN,
          abi: erc20Abi,
          functionName: "approve",
          args: [pool, amountWei],
        });
        await toastTx(hashApprove);
        await refetchAllowance();
      }

      const hashContrib = await writeContractAsync({
        address: pool,
        abi: poolAbi,
        functionName: "contribute",
        args: [amountWei],
      });
      await toastTx(hashContrib);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="card p-3">
      <h5 className="mb-2">Contribute (PYUSD)</h5>
      <div className="d-flex gap-2">
        <input
          className="form-control"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          className="btn btn-primary"
          disabled={isPending || amountWei === 0n}
          onClick={handleContribute}
        >
          {needsApprove ? "Approve + Contribute" : "Contribute"}
        </button>
      </div>
      <small className="text-muted">
        Token: {TOKEN ?? "(descubriendo…)"}
        {typeof decimals === "number" ? ` • Decimals: ${decimals}` : ""}
      </small>
    </div>
  );
}
