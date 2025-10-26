const { ethers } = require("hardhat");

async function demo() {
  console.log(" TRUSTCIRCLE DEMO - ETHGlobal Hackathon");
  console.log("=========================================\n");
  
  // Setup
  const trustCircle = await ethers.getContractAt("PYUSDTrustCircle", "0x8dAF17A20c9DBA35f005b6324F493785D239719d");
  const mockPYUSD = await ethers.getContractAt("MockPYUSD", "0x0165878A594ca255338adfa4d48449f69242Eb8F");
  const [deployer, user1, user2, user3] = await ethers.getSigners();

  console.log(" Configuración del TrustCircle:");
  console.log("   - Mínimo contribución: 100.0 PYUSD");
  console.log("   - Límite por claim: 1.0 PYUSD");
  console.log("   - Miembros máximos: 10\n");

  console.log(" CREANDO CIRCULO DE CONFIANZA...");
  console.log("   - 4 miembros");
  console.log("   - Cada uno contribuye 100 PYUSD (mínimo requerido)");
  console.log("   - Pool total: 400 PYUSD\n");
  
  // Primero aprueba y luego usa join() para cada usuario
  
  console.log("   - User1 se une al circle...");
  await mockPYUSD.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
  await trustCircle.connect(user1).depositPYUSD(ethers.utils.parseUnits("100", 6));
  
  console.log("   - User2 se une al circle...");
  await mockPYUSD.connect(user2).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
  await trustCircle.connect(user2).depositPYUSD(ethers.utils.parseUnits("100", 6));
  
  console.log("   - User3 se une al circle...");
  await mockPYUSD.connect(user3).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
  await trustCircle.connect(user3).depositPYUSD(ethers.utils.parseUnits("100", 6));
  
  console.log("   - Deployer se une al circle...");
  await mockPYUSD.connect(deployer).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
  await trustCircle.connect(deployer).depositPYUSD(ethers.utils.parseUnits("100", 6));
  
  console.log("   -  Circle creado con", (await trustCircle.totalMembers()).toString(), "miembros\n");

  console.log(" SIMULANDO ACCIDENTE...");
  console.log("   - User1 tiene accidente con su moto");
  console.log("   - Abre claim por 1 PYUSD (dentro del límite)\n");
  
  
  await trustCircle.connect(user1).openClaim(ethers.utils.parseUnits("1", 6), "motorcycle-accident.jpg");
  
  console.log(" VOTACIÓN DEMOCRÁTICA...");
  console.log("   - Miembros votan el claim");
  console.log("   - 3/4 aprueban (75% > 70% requerido)\n");
  
  await trustCircle.connect(deployer).voteClaim(1, true);
  await trustCircle.connect(user2).voteClaim(1, true); 
  await trustCircle.connect(user3).voteClaim(1, true);
  
  console.log(" PAGO AUTOMÁTICO...");
  console.log("   - Claim aprobado!");
  
  const initialBalance = await mockPYUSD.balanceOf(user1.address);
  await trustCircle.connect(deployer).processPYUSDClaim(1);
  const finalBalance = await mockPYUSD.balanceOf(user1.address);
  
  const payout = finalBalance.sub(initialBalance);
  console.log("   - Pago recibido:", ethers.utils.formatUnits(payout, 6), "PYUSD");
  
  console.log("\n DEMO COMPLETADO EXITOSAMENTE!");
  console.log(" TRUSTCIRCLE: Insurance colaborativo con PYUSD!");
  
  // Mostrar balances finales
  console.log("\n BALANCES FINALES:");
  console.log("   - User1 PYUSD:", ethers.utils.formatUnits(finalBalance, 6));
  console.log("   - Pool total:", ethers.utils.formatUnits(await trustCircle.totalPool(), 6));
  console.log("   - Miembros activos:", await trustCircle.totalMembers());
}

demo().catch(console.error);