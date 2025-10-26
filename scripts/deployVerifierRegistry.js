const { ethers } = require("hardhat");

async function main() {
  console.log("\nDeploying VerifierRegistry...");
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Registry = await ethers.getContractFactory("VerifierRegistry");
  const reg = await Registry.deploy();
  await reg.deployed();

  console.log("VerifierRegistry deployed to:", reg.address);
  console.log("Owner:", await reg.owner());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
