const { ethers } = require("hardhat");

async function main() {
  const REGISTRY_ADDR = process.env.REGISTRY_ADDR;
  const VERIFIER1     = process.env.VERIFIER1;
  const VERIFIER2     = process.env.VERIFIER2;

  if (!REGISTRY_ADDR) throw new Error("Define REGISTRY_ADDR");
  if (!VERIFIER1 && !VERIFIER2) throw new Error("Define al menos VERIFIER1");

  const reg = await ethers.getContractAt("VerifierRegistry", REGISTRY_ADDR);

  if (VERIFIER1) {
    console.log("Adding verifier 1:", VERIFIER1);
    let tx = await reg.addVerifier(VERIFIER1);
    await tx.wait();
  }
  if (VERIFIER2) {
    console.log("Adding verifier 2:", VERIFIER2);
    let tx = await reg.addVerifier(VERIFIER2);
    await tx.wait();
  }

  const total = await reg.totalVerifiers();
  console.log("Total verifiers now:", total.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
