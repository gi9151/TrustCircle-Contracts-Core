const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log(" Iniciando despliegue de TrustCircle Core...");
  
  const [deployer] = await ethers.getSigners();
  console.log(" Desplegando con la cuenta:", deployer.address);
  console.log(" Balance:", ethers.utils.formatEther(await deployer.getBalance()));

  //  Desplegar MockUSDC //
  console.log("\n1.  Desplegando MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.deployed();
  console.log(" MockUSDC desplegado en:", usdc.address);

  // Desplegar TrustCircleFactory //
  console.log("\n2.  Desplegando TrustCircleFactory...");
  const TrustCircleFactory = await ethers.getContractFactory("TrustCircleFactory");
  const factory = await TrustCircleFactory.deploy();
  await factory.deployed();
  console.log(" TrustCircleFactory desplegado en:", factory.address);

  // Crear un círculo de ejemplo //
  console.log("\n3.  Creando círculo de ejemplo...");
  
  const policyEnd = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 días //
  const coPayBps = 1000; // 10% //
  const perClaimCap = ethers.utils.parseUnits("1000", 6); // $1000 //
  const coverageLimitTotal = ethers.utils.parseUnits("10000", 6); // $10,000 //
  
  const tx = await factory.createTrustCircle(
    deployer.address, // admin //
    usdc.address, // asset //
    policyEnd, // policyEnd //
    coPayBps, // coPayBps //
    perClaimCap, // perClaimCap //
    coverageLimitTotal // coverageLimitTotal //
  );
  
  const receipt = await tx.wait();
  const circleCreatedEvent = receipt.events.find(event => event.event === 'CircleCreated');
  const circleAddress = circleCreatedEvent.args.circleAddress;
  
  console.log(" Círculo de confianza creado en:", circleAddress);

  // Guardar addresses en archivo //
  const addresses = {
    mockUSDC: usdc.address,
    factory: factory.address,
    exampleCircle: circleAddress,
    deployer: deployer.address,
    network: (await ethers.provider.getNetwork()).name,
    timestamp: new Date().toISOString()
  };
  
  const deployDir = path.join(__dirname, "..", "deploy");
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deployDir, "addresses.json"), 
    JSON.stringify(addresses, null, 2)
  );
  
  console.log("\n ¡Despliegue completado!");
  console.log("");
  console.log(" MockUSDC:", usdc.address);
  console.log(" Factory:", factory.address);
  console.log(" Círculo Ejemplo:", circleAddress);
  console.log(" Deployer:", deployer.address);
  console.log("\n");
  
  return addresses;
}

main().catch((error) => {
  console.error("Error en el despliegue:", error);
  process.exitCode = 1;
});