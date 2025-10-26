const { ethers } = require("hardhat");

async function main() {
  console.log(" Deploying with REAL PYUSD for ETHGlobal...");
  
  const [deployer] = await ethers.getSigners();
  
  
  const PYUSD_REAL = "0x6c3ea9036406852006290770bedfcaba0e23a0e8"; 
  
  console.log("Using PYUSD at:", PYUSD_REAL);
  console.log("Deployer:", deployer.address);
  
  // 1 Deploy PayPal Integration 
  const PayPalIntegration = await ethers.getContractFactory("PayPalIntegration");
  const paypalIntegration = await PayPalIntegration.deploy(PYUSD_REAL);
  console.log(" PayPalIntegration deployed to:", await paypalIntegration.getAddress());
  
  // 2 Deploy PYUSD Factory
  const PYUSDFactory = await ethers.getContractFactory("PYUSDFactory");
  const pyusdFactory = await PYUSDFactory.deploy(PYUSD_REAL);
  console.log(" PYUSDFactory deployed to:", await pyusdFactory.getAddress());
  
  // 3 Crear TrustCircle
  const futureTimestamp = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
  await pyusdFactory.createPYUSDTrustCircle(
    deployer.address,
    futureTimestamp,
    1000, // 10% copay
    1 * 10**6, // 1 USDC per claim
    10 * 10**6, // 10 USDC total coverage
    ethers.ZeroAddress
  );
  
  const circles = await pyusdFactory.getAllPYUSDCircles();
  console.log(" TrustCircle deployed to:", circles[0]);
  
  console.log("\n ¡Sistema listo para ETHGlobal!");
  console.log(" Usa el faucet de ETHGlobal para obtener PYUSD de test");
  console.log(" Configura tu wallet con la network que te indicaron");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});