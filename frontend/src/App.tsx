import { useState } from "react";
import "./App.css";

//  Providers del Blockscout App SDK
import {
  NotificationProvider,
  TransactionPopupProvider,
  useNotification,
  useTransactionPopup,
} from "@blockscout/app-sdk";

//  Componentes principales
import NavBar from "./components/NavBar";
import NetworkGuard from "./components/NetworkGuard";
import CirclePage from "./components/CirclePage";

/* ===========================
    Demo de Blockscout
   =========================== */
function BlockscoutDemo() {
  const [chainId, setChainId] = useState<string>("84532"); // Base Sepolia por defecto
  const [txHash, setTxHash] = useState<string>("");
  const [address, setAddress] = useState<string>("");

  const { openTxToast } = useNotification();
  const { openPopup } = useTransactionPopup();

  return (
    <div className="container py-4">
      <div className="card" style={{ marginTop: 12 }}>
        <h2 className="mb-3">Blockscout SDK demo</h2>

        <div className="row" style={{ gap: 12 }}>
          <div className="col">
            <label className="form-label">Chain ID (string)</label>
            <input
              className="form-control"
              value={chainId}
              onChange={(e) => setChainId(e.target.value)}
              placeholder='Ej: "84532" (Base Sepolia) • "421614" (Arbitrum Sepolia) • "11155420" (Optimism Sepolia)'
            />
          </div>
        </div>

        <hr />

        <div className="row" style={{ gap: 12 }}>
          <div className="col">
            <label className="form-label">Tx Hash</label>
            <input
              className="form-control"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x... (pega un hash real de esa chain)"
            />
          </div>
          <div className="col-auto d-flex align-items-end">
            <button
              className="btn btn-primary"
              onClick={() => openTxToast(chainId, txHash as `0x${string}`)}
            >
              Abrir Toast
            </button>
          </div>
        </div>

        <div className="row" style={{ gap: 12, marginTop: 12 }}>
          <div className="col">
            <label className="form-label">Address (opcional)</label>
            <input
              className="form-control"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x... (address o contrato)"
            />
          </div>
          <div className="col-auto d-flex align-items-end" style={{ gap: 8 }}>
            <button
              className="btn btn-outline-secondary"
              onClick={() => openPopup({ chainId, address })}
            >
              Ver Historial Address
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => openPopup({ chainId })}
            >
              Ver Historial Chain
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Contenedor con selector de vistas
   =========================== */
function Shell() {
  const [view, setView] = useState<"circles" | "demo">("circles");

  return (
    <>
      <NavBar />

      {/* Exige estar en una red soportada (Base/Arbitrum/Optimism Sepolia) */}
      <NetworkGuard>
        {view === "circles" ? <CirclePage /> : <BlockscoutDemo />}
      </NetworkGuard>

      {/* Switch flotante para alternar vistas */}
      <div
        className="position-fixed"
        style={{ right: 12, bottom: 12, zIndex: 10 }}
      >
        <div className="btn-group">
          <button
            className={`btn btn-sm ${
              view === "circles" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => setView("circles")}
          >
            Circles
          </button>
          <button
            className={`btn btn-sm ${
              view === "demo" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => setView("demo")}
          >
            Blockscout Demo
          </button>
        </div>
      </div>
    </>
  );
}

/* ===========================
   App principal
   =========================== */
export default function App() {
  return (
    <NotificationProvider>
      <TransactionPopupProvider>
        <Shell />
      </TransactionPopupProvider>
    </NotificationProvider>
  );
}
