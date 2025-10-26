const { ethers } = require("hardhat");

async function main() {
  console.log(" Deploying Simple PYUSD TrustCircle...");
  
  const [deployer, user1, user2] = await ethers.getSigners();
  
  // PYUSD en Sepolia
  const PYUSD_SEPOLIA = "0x05B3e60D51c5eDD49DE869bF74038c1323e2cA65";
  
  console.log("Deployer:", deployer.address);
  console.log("Using PYUSD:", PYUSD_SEPOLIA);
  
  // Verificar balances
  const pyusd = await ethers.getContractAt("IPYUSD", PYUSD_SEPOLIA);
  const deployerBalance = await pyusd.balanceOf(deployer.address);
  console.log("Deployer PYUSD Balance:", ethers.formatUnits(deployerBalance, 6));
  
  // 1 Deploy PYUSD Factory
  const PYUSDFactory = await ethers.getContractFactory("PYUSDFactory");
  const pyusdFactory = await PYUSDFactory.deploy(PYUSD_SEPOLIA);
  console.log(" PYUSDFactory:", await pyusdFactory.getAddress());
  
  // 2 Crear TrustCircle
  const futureTimestamp = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
  await pyusdFactory.createPYUSDTrustCircle(
    deployer.address,
    futureTimestamp,
    1000, // 10% copay
    1 * 10**6, // 1 PYUSD per claim
    10 * 10**6, // 10 PYUSD total coverage
    ethers.ZeroAddress
  );
  
  const circles = await pyusdFactory.getAllPYUSDCircles();
  const trustCircle = await ethers.getContractAt("PYUSDTrustCircle", circles[0]);
  console.log(" TrustCircle:", await trustCircle.getAddress());
  
  console.log("\n ¡Sistema PYUSD Simple listo!");
  console.log(" Comandos para demo:");
  console.log("1. depositPYUSD(1000000) - Depositar 1 PYUSD");
  console.log("2. openClaim(100000, 'accident.jpg') - Abrir claim de 0.1 PYUSD");
  console.log("3. voteClaim(1, true) - Votar claim");
  console.log("4. processPYUSDClaim(1) - Procesar claim");
  console.log("5. withdrawPYUSD(500000) - Retirar 0.5 PYUSD");
  
  console.log("\n Para el demo:");
  console.log("- Muestra transacciones reales con PYUSD en Etherscan");
  console.log("- Enseña el flujo completo de insurance con stablecoin real");
  console.log("- Destaca la integración con PYUSD oficial de PayPal");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});