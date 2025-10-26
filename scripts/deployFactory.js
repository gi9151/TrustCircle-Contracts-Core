// scripts/deployFactory.js
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("\nDeploying TrustCircleFactory...\n");

  // Lee la dirección desde la env 
  const semaphoreAddress =
    process.env.SEMAPHORE_ADDR ||
    "0x0000000000000000000000000000000000000001";

  if (!ethers.utils.isAddress(semaphoreAddress)) {
    throw new Error(`SEMAPHORE_ADDR inválida: ${semaphoreAddress}`);
  }
  console.log("Semaphore Address:", semaphoreAddress);

  const Factory = await ethers.getContractFactory("TrustCircleFactory");
  const factory = await Factory.deploy(semaphoreAddress);
  await factory.deployed();

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("TrustCircleFactory deployed to:", factory.address);
  console.log("Network:", network.name, `(${network.chainId})`);
  console.log("Deployer:", deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
