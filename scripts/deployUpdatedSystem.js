// scripts/deployUpdatedSystem.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying UPDATED TrustCircle System...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  // 1. Deploy nuevo VerifierRegistry
  console.log("📦 Deploying VerifierRegistry...");
  const VerifierRegistry = await ethers.getContractFactory("VerifierRegistry");
  const verifierRegistry = await VerifierRegistry.deploy();
  await verifierRegistry.deployed();
  console.log("✅ VerifierRegistry:", verifierRegistry.address);
  
  // 2. Deploy nuevo TrustCircle actualizado (DIRECTO, sin factory)
  console.log("📦 Deploying Updated TrustCircleMain...");
  const TrustCircleMain = await ethers.getContractFactory("TrustCircleMain");
  
  const TOKEN_ADDRESS = "0xa9d44f49d3F60d11a6B89398334Ef428Ab76C6c3"; // mPYUSD en baseSepolia
  const policyEnd = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 días
  
  const trustCircle = await TrustCircleMain.deploy(
    deployer.address,                    // admin
    TOKEN_ADDRESS,                       // asset (mPYUSD)
    policyEnd,                           // policyEnd
    1000,                                // 10% copay
    ethers.utils.parseUnits("500", 6),   // 500 PYUSD per claim
    ethers.utils.parseUnits("10000", 6), // 10,000 PYUSD total coverage
    ethers.constants.AddressZero         // verifierPool (vacío por ahora)
  );
  
  await trustCircle.deployed();
  console.log("✅ Updated TrustCircle:", trustCircle.address);
  
  // 3. Configurar el VerifierRegistry en el TrustCircle
  console.log("🔧 Configuring VerifierRegistry...");
  const setRegistryTx = await trustCircle.setVerifierRegistry(verifierRegistry.address);
  await setRegistryTx.wait();
  console.log("✅ VerifierRegistry configured");
  
  // 4. Configurar los umbrales de verificación
  console.log("🔧 Setting verification thresholds...");
  const setCapsTx = await trustCircle.setCaps(
    ethers.utils.parseUnits("100", 6),   // ≤100 PYUSD: 0 verificaciones
    ethers.utils.parseUnits("500", 6)    // ≤500 PYUSD: 1 verificación; >500: 2
  );
  await setCapsTx.wait();
  console.log("✅ Verification thresholds set");
  
  // 5. Agregar algunos verificadores de prueba
  console.log("👥 Adding test verifiers...");
  const verifier1 = deployer.address; // El deployer como verificador
  const verifier2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Hardhat account #1
  
  await verifierRegistry.addVerifier(verifier1);
  await verifierRegistry.addVerifier(verifier2);
  console.log("✅ Test verifiers added");
  
  // 6. Verificar la configuración completa
  console.log("\n🔍 Verifying configuration...");
  
  const currentRegistry = await trustCircle.verifierRegistry();
  console.log("TrustCircle registry:", currentRegistry);
  
  const capInternal = await trustCircle.capInternal();
  const capOneExt = await trustCircle.capOneExt();
  console.log("Verification thresholds:");
  console.log("  - capInternal:", ethers.utils.formatUnits(capInternal, 6), "PYUSD");
  console.log("  - capOneExt:", ethers.utils.formatUnits(capOneExt, 6), "PYUSD");
  
  const isVerifier1 = await verifierRegistry.isVerifier(verifier1);
  const isVerifier2 = await verifierRegistry.isVerifier(verifier2);
  console.log("Verifiers status:");
  console.log("  -", verifier1, ":", isVerifier1 ? "✅ VERIFIER" : "❌ NOT VERIFIER");
  console.log("  -", verifier2, ":", isVerifier2 ? "✅ VERIFIER" : "❌ NOT VERIFIER");
  
  // Probar la función de verificaciones requeridas
  console.log("\n🧪 Testing requiredExternalApprovals:");
  const testAmounts = [
    ethers.utils.parseUnits("50", 6),   // 50 PYUSD
    ethers.utils.parseUnits("150", 6),  // 150 PYUSD  
    ethers.utils.parseUnits("600", 6)   // 600 PYUSD
  ];
  
  for (const amount of testAmounts) {
    const required = await trustCircle.requiredExternalApprovals(amount);
    console.log(`  - ${ethers.utils.formatUnits(amount, 6)} PYUSD → ${required} external approval(s) required`);
  }
  
  console.log("\n🎉 UPDATED SYSTEM DEPLOYED SUCCESSFULLY!");
  console.log("=========================================");
  console.log("📋 Contract Addresses:");
  console.log("TrustCircle (Updated):", trustCircle.address);
  console.log("VerifierRegistry:", verifierRegistry.address);
  console.log("Asset (mPYUSD):", TOKEN_ADDRESS);
  
  console.log("\n🚀 Next steps:");
  console.log("1. Use new TrustCircle address for frontend");
  console.log("2. Test the verification system with claims");
  console.log("3. Update environment variables");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});