const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("\nDeploying MockPYUSD...");
  const MockPYUSD = await ethers.getContractFactory("MockPYUSD");
  const token = await MockPYUSD.deploy();
  await token.deployed();

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("MockPYUSD deployed to:", token.address);
  console.log("Network:", network.name, `(${network.chainId})`);
  console.log("Deployer:", deployer.address);

  // Verificación rápida
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  console.log(` Token info: ${name} (${symbol}) — ${decimals} decimals`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
