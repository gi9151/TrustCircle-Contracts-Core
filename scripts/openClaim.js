const { ethers } = require("hardhat");

async function main() {
  const CIRCLE_ADDR = process.env.CIRCLE_ADDR;
  const AMOUNT      = process.env.AMOUNT || "200"; // en mPYUSD (enteros), 6 decimales
  const EVIDENCE    = process.env.EVIDENCE || "ipfs://<cid>";

  if (!CIRCLE_ADDR) throw new Error("Define CIRCLE_ADDR");

  const amount6 = ethers.BigNumber.from(AMOUNT).mul(ethers.BigNumber.from(10).pow(6));
  const circle = await ethers.getContractAt(
    ["function openClaim(uint256,string) external returns (uint256)"],
    CIRCLE_ADDR
  );

  const tx = await circle.openClaim(amount6, EVIDENCE);
  const rc = await tx.wait();

  const ev = rc.events?.find((e) => e.event === "ClaimOpened");
  if (ev) {
    console.log("ClaimOpened id:", ev.args.claimId.toString());
  } else {
    console.log("Claim opened. Tx:", rc.transactionHash);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
