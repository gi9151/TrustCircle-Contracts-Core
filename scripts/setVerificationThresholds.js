const { ethers } = require("hardhat");

async function main() {
  const CIRCLE_ADDR = process.env.CIRCLE_ADDR;
  
  if (!CIRCLE_ADDR) {
    console.log(" Missing CIRCLE_ADDR environment variable");
    return;
  }
  
  const [deployer] = await ethers.getSigners();
  console.log("Configuring verification thresholds...");
  console.log("TrustCircle:", CIRCLE_ADDR);
  console.log("Deployer:", deployer.address);
  
  const trustCircle = await ethers.getContractAt("TrustCircleMain", CIRCLE_ADDR);
  
  // Verificar que somos el owner
  const owner = await trustCircle.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log(" Not the owner of this TrustCircle");
    return;
  }
  
  // Configurar umbrales (en unidades de 6 decimales, como PYUSD)
  const capInternal = ethers.utils.parseUnits("100", 6);   // ≤100 PYUSD: 0 verificaciones externas
  const capOneExt = ethers.utils.parseUnits("500", 6);     // ≤500 PYUSD: 1 verificación; >500: 2 verificaciones
  
  console.log(" Setting verification thresholds:");
  console.log("   - capInternal:", ethers.utils.formatUnits(capInternal, 6), "PYUSD (0 external verifications)");
  console.log("   - capOneExt:", ethers.utils.formatUnits(capOneExt, 6), "PYUSD (1 external verification)");
  
  const tx = await trustCircle.setCaps(capInternal, capOneExt);
  console.log(" Transaction sent:", tx.hash);
  
  await tx.wait();
  console.log(" Verification thresholds set successfully!");
  
  // Verificar la configuración
  const newCapInternal = await trustCircle.capInternal();
  const newCapOneExt = await trustCircle.capOneExt();
  
  console.log("🔍 New thresholds verified:");
  console.log("   - capInternal:", ethers.utils.formatUnits(newCapInternal, 6), "PYUSD");
  console.log("   - capOneExt:", ethers.utils.formatUnits(newCapOneExt, 6), "PYUSD");
}

main().catch(console.error);