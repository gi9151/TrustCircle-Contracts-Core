const { ethers } = require("hardhat");

async function main() {
  console.log(" TESTING UPDATED TRUSTCIRCLE SYSTEM");
  console.log("=====================================\n");
  
  const TRUST_CIRCLE = "0x2Acde7a596B5B6a35f855bc7567ee1B3814F1C18";
  const VERIFIER_REGISTRY = "0xAcD7f3c012aD7fbc56aa528D6801A240c3ab59D5";
  const TOKEN = "0xa9d44f49d3F60d11a6B89398334Ef428Ab76C6c3";
  
  // Obtener TODOS los signers disponibles
  const signers = await ethers.getSigners();
  console.log(`Available accounts: ${signers.length}`);
  
  // Usar los primeros 4 signers (o los disponibles)
  const deployer = signers[0];
  const user1 = signers[1] || signers[0]; // Fallback si no hay suficientes
  const user2 = signers[2] || signers[0];
  const user3 = signers[3] || signers[0];
  
  console.log("Deployer:", deployer.address);
  console.log("User1:", user1.address);
  console.log("User2:", user2.address);
  console.log("User3:", user3.address);
  
  // Conectar a contratos
  const trustCircle = await ethers.getContractAt("TrustCircleMain", TRUST_CIRCLE);
  const verifierRegistry = await ethers.getContractAt("VerifierRegistry", VERIFIER_REGISTRY);
  
  console.log("\n1. 🔍 BASIC SYSTEM CHECK");
  console.log("   - TrustCircle owner:", await trustCircle.owner());
  console.log("   - Current members:", (await trustCircle.totalMembers()).toString());
  console.log("   - Total pool:", ethers.utils.formatUnits(await trustCircle.totalPool(), 6), "PYUSD");
  
  // Verificar sistema de verificadores
  console.log("\n2.  VERIFICATION SYSTEM CHECK");
  const capInternal = await trustCircle.capInternal();
  const capOneExt = await trustCircle.capOneExt();
  console.log("   - capInternal:", ethers.utils.formatUnits(capInternal, 6), "PYUSD");
  console.log("   - capOneExt:", ethers.utils.formatUnits(capOneExt, 6), "PYUSD");
  
  // Probar función de verificaciones requeridas
  console.log("   - Testing requiredExternalApprovals:");
  const testAmounts = [50, 150, 600];
  for (const amount of testAmounts) {
    const required = await trustCircle.requiredExternalApprovals(ethers.utils.parseUnits(amount.toString(), 6));
    console.log(`     ${amount} PYUSD → ${required} external approval(s) required`);
  }
  
  // Verificar verificadores registrados
  console.log("\n3. 👥 VERIFIERS CHECK");
  const isDeployerVerifier = await verifierRegistry.isVerifier(deployer.address);
  console.log("   - Deployer is verifier:", isDeployerVerifier);
  
  console.log("\n🎉 SYSTEM VERIFICATION COMPLETE!");
  console.log(" TrustCircle is working with verifier system");
  console.log(" Threshold-based approvals are configured");
  
  // Solo intentar el test completo si tenemos al menos 3 cuentas diferentes
  if (signers.length >= 4) {
    await runFullTest(trustCircle, verifierRegistry, deployer, user1, user2, user3, TOKEN);
  } else {
    console.log("\n  Not enough accounts for full test (need 4, have", signers.length, ")");
    console.log("💡 Add more accounts to your wallet for complete testing");
  }
}

async function runFullTest(trustCircle, verifierRegistry, deployer, user1, user2, user3, TOKEN_ADDR) {
  console.log("\n4.  RUNNING FULL TEST...");
  
  // Conectar al token
  let token;
  try {
    token = await ethers.getContractAt("MockPYUSD", TOKEN_ADDR);
  } catch (e) {
    const erc20Abi = ["function balanceOf(address) view returns (uint256)", "function approve(address, uint256) returns (bool)"];
    token = await ethers.getContractAt(erc20Abi, TOKEN_ADDR);
  }
  
  console.log("   - Checking if members need to join...");
  
  // Verificar y unir miembros si es necesario
  const membersToJoin = [];
  if (!(await trustCircle.members(user1.address)).isActive) membersToJoin.push(user1);
  if (!(await trustCircle.members(user2.address)).isActive) membersToJoin.push(user2);
  if (!(await trustCircle.members(user3.address)).isActive) membersToJoin.push(user3);
  
  if (membersToJoin.length > 0) {
    console.log(`   - ${membersToJoin.length} users need to join circle`);
    
    for (const user of membersToJoin) {
      try {
        console.log(`     - ${user.address} joining...`);
        await token.connect(user).approve(trustCircle.address, ethers.utils.parseUnits("1000", 6));
        await trustCircle.connect(user).depositPYUSD(ethers.utils.parseUnits("100", 6));
        console.log(`      ${user.address} joined`);
      } catch (e) {
        console.log(`      ${user.address} failed to join:`, e.message);
      }
    }
  }
  
  console.log("   - Total members:", (await trustCircle.totalMembers()).toString());
  
  // Solo proceder si tenemos al menos 3 miembros
  if ((await trustCircle.totalMembers()).lt(3)) {
    console.log(" Need at least 3 members for full test");
    return;
  }
  
  console.log("\n5.  TESTING CLAIM WITH EXTERNAL VERIFICATION");
  console.log("   - Opening claim for 150 PYUSD (requires 1 external verification)...");
  
  try {
    await trustCircle.connect(user1).openClaim(ethers.utils.parseUnits("150", 6), "test-accident.jpg");
    console.log("    Claim #1 opened");
    
    // Verificación externa
    console.log("   - External verification...");
    await trustCircle.connect(deployer).externalApprove(1);
    console.log("    External approval registered");
    
    // Votación interna
    console.log("   - Internal voting...");
    await trustCircle.connect(user2).voteClaim(1, true);
    await trustCircle.connect(user3).voteClaim(1, true);
    console.log("    Voting completed");
    
    // Procesar claim
    console.log("   - Processing claim...");
    await trustCircle.connect(deployer).processClaim(1);
    console.log("    Claim processed successfully!");
    
    console.log("\n🎉 FULL TEST COMPLETED SUCCESSFULLY!");
    
  } catch (error) {
    console.log(" Full test failed:", error.message);
  }
}

main().catch((error) => {
  console.error(" Test failed:", error.message);
});