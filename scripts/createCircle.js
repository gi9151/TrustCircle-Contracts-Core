// scripts/createCircle.js
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const FACTORY = process.env.FACTORY_ADDR || "0x5Af6F533DBbE1881a2c141F89a095ea150801A51";
  const TOKEN   = process.env.TEST_ERC20   || "0xa9d44f49d3F60d11a6B89398334Ef428Ab76C6c3";
  if (!ethers.utils.isAddress(FACTORY)) throw new Error("FACTORY_ADDR inválida");
  if (!ethers.utils.isAddress(TOKEN)) throw new Error("TEST_ERC20 inválida");

  const factory = await ethers.getContractAt("TrustCircleFactory", FACTORY);
  const [deployer] = await ethers.getSigners();
  const admin = deployer.address;

  // Importante: mPYUSD tiene 6 decimales 
  const policyEnd = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90; // 90 días
  const coPayBps = 1000; // 10%
  const perClaimCap = ethers.utils.parseUnits("50", 6);       // 50 mPYUSD
  const coverageLimitTotal = ethers.utils.parseUnits("2000", 6); // 2000 mPYUSD
  const withSemaphore = false; // pon true luego si quieres círculo con ZK

  console.log("Creating Trust Circle...");
  const tx = await factory.createTrustCircle(
    admin,
    TOKEN,
    policyEnd,
    coPayBps,
    perClaimCap,
    coverageLimitTotal,
    withSemaphore
  );
  const receipt = await tx.wait();

  const ev = receipt.events?.find((e) => e.event === "CircleCreated");
  if (ev) {
    console.log("New Circle deployed at:", ev.args.circleAddress);
  } else {
    console.log("Circle created. Revisa los logs de la tx.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
