const hre = require("hardhat");
const { ethers, artifacts } = hre;

async function tryCall(contract, fn, args = []) {
  try {
    if (typeof contract[fn] !== "function") throw new Error("no method");
    const v = await contract[fn](...args);
    return v;
  } catch {
    return undefined;
  }
}

async function getContractWithBestAbi(addr) {
  // Intenta con artefactos reales 
  const candidates = ["TrustCircleMain", "TrustCircleSemaphore"];
  for (const name of candidates) {
    try {
      const c = await ethers.getContractAt(name, addr);
      // prueba una función que seguro exista en tus pools
      const maybeAsset = await tryCall(c, "asset");
      if (maybeAsset !== undefined) return c;
    } catch {}
  }

  // Fallback: ABI mínima con funciones típicas
  const fallbackAbi = [
    // propietarios / admin
    "function admin() view returns (address)",
    "function owner() view returns (address)",
    "function getAdmin() view returns (address)",
    // configuración
    "function asset() view returns (address)",
    "function policyEnd() view returns (uint256)",
    "function coPayBps() view returns (uint256)",
    "function perClaimCap() view returns (uint256)",
    "function coverageLimitTotal() view returns (uint256)",
    // miembros
    "function membersLength() view returns (uint256)",
    "function members(uint256) view returns (address)",
    "function getMembersCount() view returns (uint256)"
  ];
  return ethers.getContractAt(fallbackAbi, addr);
}

function fmtAmount(v, decimals = 6) {
  try {
    return Number(v) / 10 ** decimals;
  } catch {
    return String(v);
  }
}

async function main() {
  const FACTORY_ADDR = process.env.FACTORY_ADDR;
  const CIRCLE_ADDR = process.env.CIRCLE_ADDR;

  if (!FACTORY_ADDR || !CIRCLE_ADDR) {
    throw new Error("Debes definir FACTORY_ADDR y CIRCLE_ADDR");
  }

  const code = await ethers.provider.getCode(CIRCLE_ADDR);
  if (!code || code === "0x") {
    throw new Error(`En ${CIRCLE_ADDR} no hay contrato (bytecode vacío). Revisa la dirección.`);
  }

  console.log("\nVerificando Trust Circle");
  console.log("Factory:", FACTORY_ADDR);
  console.log("Circle: ", CIRCLE_ADDR);

  const circle = await getContractWithBestAbi(CIRCLE_ADDR);

  // admin / owner
  const admin =
    (await tryCall(circle, "admin")) ||
    (await tryCall(circle, "owner")) ||
    (await tryCall(circle, "getAdmin"));

  // asset + decimals (si es ERC20 estándar)
  const asset = await tryCall(circle, "asset");
  let decimals = 6;
  if (asset) {
    const erc20 = await ethers.getContractAt(
      [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
      ],
      asset
    );
    const d = await tryCall(erc20, "decimals");
    if (typeof d === "number") decimals = d;
  }

  const policyEnd = await tryCall(circle, "policyEnd");
  const coPayBps = await tryCall(circle, "coPayBps");
  const perClaimCap = await tryCall(circle, "perClaimCap");
  const coverageLimitTotal = await tryCall(circle, "coverageLimitTotal");

  // members count: prueba varios nombres
  let membersLen =
    (await tryCall(circle, "membersLength")) ||
    (await tryCall(circle, "getMembersCount")) ||
    0;

  if (membersLen && membersLen.toNumber) membersLen = membersLen.toNumber();

  console.log("\nParámetros");
  console.log("Admin/Owner:       ", admin ?? "no disponible");
  console.log("Asset (token):     ", asset ?? "no disponible");
  console.log(
    "Policy End:        ",
    policyEnd ? new Date(Number(policyEnd) * 1000).toISOString() : "no disponible"
  );
  console.log("CoPay (bps):       ", coPayBps !== undefined ? Number(coPayBps) : "no disponible");
  console.log(
    "Per Claim Cap:     ",
    perClaimCap !== undefined ? fmtAmount(perClaimCap, decimals) : "no disponible"
  );
  console.log(
    "Coverage Limit:    ",
    coverageLimitTotal !== undefined ? fmtAmount(coverageLimitTotal, decimals) : "no disponible"
  );

  console.log("Miembros (count):  ", membersLen);

  if (membersLen && asset) {
    const erc20 = await ethers.getContractAt(
      ["function balanceOf(address) view returns (uint256)"],
      asset
    );
    console.log("\nMiembros:");
    for (let i = 0; i < membersLen; i++) {
      let memberAddr;
      try {
        memberAddr = await circle.members(i);
      } catch {
        // si no existe members(i), salimos
        break;
      }
      const bal = await erc20.balanceOf(memberAddr);
      console.log(
        ` - ${i + 1}: ${memberAddr} | bal: ${fmtAmount(bal, decimals)}`
      );
    }
  }

  console.log("\nOK.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
