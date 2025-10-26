const { ethers } = require("hardhat");

async function main() {
  const CIRCLE_ADDR = process.env.CIRCLE_ADDR;
  const CLAIM_ID    = process.env.CLAIM_ID;
  const PRIV_KEY    = process.env.PRIVATE_KEY_VERIFIER; // pk de la cuenta verificador

  if (!CIRCLE_ADDR || !CLAIM_ID || !PRIV_KEY) {
    throw new Error("Define CIRCLE_ADDR, CLAIM_ID y PRIVATE_KEY_VERIFIER");
  }

  // crea signer desde PK
  const wallet = new ethers.Wallet(PRIV_KEY, ethers.provider);
  console.log("Using verifier:", wallet.address);

  const circle = new ethers.Contract(
    CIRCLE_ADDR,
    ["function externalApprove(uint256) external"],
    wallet
  );

  const tx = await circle.externalApprove(CLAIM_ID);
  const rc = await tx.wait();
  console.log("External approve done. Tx:", rc.transactionHash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
