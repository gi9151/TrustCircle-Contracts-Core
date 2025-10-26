const { ethers } = require("hardhat");

async function main() {
  console.log(" Testing on Local Network...");
  
  const [deployer, user1, user2, user3] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("User1:", user1.address);
  console.log("User2:", user2.address);
  
  // 1. Deploy MockPYUSD
  console.log(" Deploying MockPYUSD...");
  const MockPYUSD = await ethers.getContractFactory("MockPYUSD");
  const mockPYUSD = await MockPYUSD.deploy();
  console.log(" MockPYUSD:", mockPYUSD.address);
  
  // 2. Dar PYUSD a usuarios
  console.log("💰 Funding test accounts...");
  await mockPYUSD.mint(deployer.address, ethers.utils.parseUnits("1000", 6));
  await mockPYUSD.mint(user1.address, ethers.utils.parseUnits("1000", 6));
  await mockPYUSD.mint(user2.address, ethers.utils.parseUnits("1000", 6));
  await mockPYUSD.mint(user3.address, ethers.utils.parseUnits("1000", 6));
  console.log(" All users funded with 1000 mock PYUSD");
  
  // 3. Deploy Factory
  console.log(" Deploying PYUSDFactory...");
  const PYUSDFactory = await ethers.getContractFactory("PYUSDFactory");
  const pyusdFactory = await PYUSDFactory.deploy(mockPYUSD.address);
  console.log(" PYUSDFactory:", pyusdFactory.address);
  
  // 4. Crear TrustCircle
  console.log(" Creating TrustCircle...");
  const futureTimestamp = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
  await pyusdFactory.createPYUSDTrustCircle(
    deployer.address,
    futureTimestamp,
    100, // 1% copay
    1 * 10**6, // 1 PYUSD per claim
    10 * 10**6, // 10 PYUSD total coverage
    ethers.constants.AddressZero 
  );
  
  const circles = await pyusdFactory.getAllPYUSDCircles();
  const trustCircle = await ethers.getContractAt("PYUSDTrustCircle", circles[0]);
  console.log(" TrustCircle:", trustCircle.address);
  
  console.log("\n ¡SISTEMA LISTO PARA PRUEBAS LOCALES!");
  console.log("");
  console.log(" Comandos para probar:");
  console.log("1. trustCircle.depositPYUSD(1000000) - Depositar 1 PYUSD");
  console.log("2. trustCircle.openClaim(100000, 'test.jpg') - Claim 0.1 PYUSD");
  console.log("3. trustCircle.voteClaim(1, true) - Votar claim");
  console.log("4. trustCircle.processPYUSDClaim(1) - Procesar claim");
  console.log("5. trustCircle.withdrawPYUSD(500000) - Retirar 0.5 PYUSD");
  
  console.log("\n Cuentas de prueba disponibles:");
  console.log("Deployer:", deployer.address);
  console.log("User1:", user1.address); 
  console.log("User2:", user2.address);
  console.log("User3:", user3.address);
  
  console.log("\n Puedes usar Hardhat Console para interactuar:");
  console.log("npx hardhat console --network localhost");
  
  // Guardar addresses para uso fácil
  console.log("\n Addresses para copiar:");
  console.log("MockPYUSD:", mockPYUSD.address);
  console.log("PYUSDFactory:", pyusdFactory.address);
  console.log("TrustCircle:", trustCircle.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});