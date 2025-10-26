const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("\nDeploying SemaphoreStub...");
  const Stub = await ethers.getContractFactory("SemaphoreStub");
  const stub = await Stub.deploy();
  await stub.deployed();

  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();

  console.log("SemaphoreStub deployed to:", stub.address);
  console.log("Network:", net.name, `(${net.chainId})`);
  console.log("Deployer:", deployer.address);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
