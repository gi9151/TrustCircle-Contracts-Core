import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export default function WalletButtons() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const [isConnecting, setIsConnecting] = useState(false);

  if (isConnected)
    return (
      <div className="d-flex align-items-center gap-2">
        <span className="small text-muted">
          Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button
          className="btn btn-sm btn-outline-danger"
          onClick={() => disconnect()}
        >
          Disconnect
        </button>
      </div>
    );

  return (
    <button
      className="btn btn-sm btn-primary"
      disabled={isConnecting}
      onClick={async () => {
        try {
          setIsConnecting(true);
          await connect({ connector: injected() });
        } finally {
          setIsConnecting(false);
        }
      }}
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
