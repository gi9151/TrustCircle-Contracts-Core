const { ethers } = require("hardhat");

async function main() {
  console.log("Desplegando TrustCircle con Semaphore...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Desplegando con:", deployer.address);

  // Configuración
  const useRealSemaphore = false; // Cambiamos a true para testnet
  
  let semaphoreAddress;
  if (useRealSemaphore) {
    // Para testnet / dirección de Semaphore en Scroll
    semaphoreAddress = "0x3889927F0B5Eb1a02C6E2C20b39a1B14A6a98F9b";
  } else {
    // Para local / deploya mock propio
    console.log("Desplegando SemaphoreMock para desarrollo...");
    const SemaphoreMock = await ethers.getContractFactory("SemaphoreMock");
    const semaphoreMock = await SemaphoreMock.deploy();
    await semaphoreMock.deployed();
    semaphoreAddress = semaphoreMock.address;
    console.log("SemaphoreMock:", semaphoreAddress);
  }

  // 1 Desplega MockUSDC
  console.log("\n1. Desplegando MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.deployed();
  console.log("MockUSDC:", usdc.address);

  // 2 Desplega Factory
  console.log("\n2. Desplegando TrustCircleFactory...");
  const TrustCircleFactory = await ethers.getContractFactory("TrustCircleFactory");
  const factory = await TrustCircleFactory.deploy(semaphoreAddress);
  await factory.deployed();
  console.log("TrustCircleFactory:", factory.address);

  // 3 Crea círculo
  console.log("\n3. Creando círculo con votación privada...");
  
  const policyEnd = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);
  
  const tx = await factory.createTrustCircle(
    deployer.address,
    usdc.address,
    policyEnd,
    1000, // coPayBps
    ethers.utils.parseUnits("1000", 6), // perClaimCap
    ethers.utils.parseUnits("10000", 6), // coverageLimitTotal
    useRealSemaphore // withSemaphore
  );
  
  const receipt = await tx.wait();
  const circleCreatedEvent = receipt.events.find(e => e.event === 'CircleCreated');
  const circleAddress = circleCreatedEvent.args.circleAddress;
  
  console.log("Círculo creado en:", circleAddress);
  console.log("Usando Semaphore real:", useRealSemaphore);

  // Inicializa grupo Semaphore
  console.log("\n4. Inicializando grupo Semaphore...");
  const trustCircle = await ethers.getContractAt("TrustCircleSemaphore", circleAddress);
  const initTx = await trustCircle.initializeSemaphoreGroup();
  await initTx.wait();
  console.log("Grupo Semaphore inicializado");

  // Guardar addresses
  const addresses = {
    mockUSDC: usdc.address,
    factory: factory.address,
    circle: circleAddress,
    semaphore: semaphoreAddress,
    useRealSemaphore: useRealSemaphore,
    deployer: deployer.address
  };
  
  console.log("\nDespliegue completado!");
  console.log("Resumen:", JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
