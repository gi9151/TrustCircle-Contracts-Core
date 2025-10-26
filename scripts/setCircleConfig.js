const { ethers } = require("hardhat");

async function main() {
  console.log(" Configuring TrustCircle with Verifier Registry...");
  
  const CIRCLE_ADDR = process.env.CIRCLE_ADDR;
  const REGISTRY_ADDR = process.env.REGISTRY_ADDR;
  
  if (!CIRCLE_ADDR || !REGISTRY_ADDR) {
    console.log("  Missing environment variables:");
    console.log("   CIRCLE_ADDR:", CIRCLE_ADDR);
    console.log("   REGISTRY_ADDR:", REGISTRY_ADDR);
    console.log("   Usage: CIRCLE_ADDR=0x... REGISTRY_ADDR=0x... npx hardhat run scripts/setCircleConfig.js --network baseSepolia");
    return;
  }
  
  console.log("TrustCircle Address:", CIRCLE_ADDR);
  console.log("Registry Address:", REGISTRY_ADDR);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  try {
    // Connect to the TrustCircle contract - USA TrustCircleMain, no VerifierRegistry
    const TrustCircle = await ethers.getContractFactory("TrustCircleMain");
    const trustCircle = TrustCircle.attach(CIRCLE_ADDR);
    
    console.log(" Checking current configuration...");
    
    // Check if we're the owner
    const owner = await trustCircle.owner();
    console.log("Contract Owner:", owner);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log(" You are not the owner of this contract");
      return;
    }
    
    // Check current verifier registry
    try {
      const currentRegistry = await trustCircle.verifierRegistry();
      console.log("Current Registry:", currentRegistry);
    } catch (e) {
      console.log("  Current registry not available or not set");
    }
    
    console.log(" Setting verifier registry in TrustCircle...");
    
    // Call setVerifierRegistry on the TrustCircle contract
    const tx = await trustCircle.setVerifierRegistry(REGISTRY_ADDR);
    console.log(" Transaction sent:", tx.hash);
    
    console.log(" Waiting for confirmation...");
    await tx.wait();
    
    console.log(" Verifier registry set successfully in TrustCircle!");
    
    // Verify the configuration
    const newRegistry = await trustCircle.verifierRegistry();
    console.log(" New registry address in TrustCircle:", newRegistry);
    
    // Test the caps configuration
    const capInternal = await trustCircle.capInternal();
    const capOneExt = await trustCircle.capOneExt();
    console.log(" Current caps:");
    console.log("   - Internal cap (0 external verifications):", ethers.utils.formatUnits(capInternal, 6), "PYUSD");
    console.log("   - One external cap (1 external verification):", ethers.utils.formatUnits(capOneExt, 6), "PYUSD");
    
  } catch (error) {
    console.log(" Configuration failed:", error.message);
    
    // Detailed error analysis
    if (error.message.includes("only owner")) {
      console.log(" Solution: You need to be the owner of the TrustCircle contract");
    } else if (error.message.includes("execution reverted")) {
      console.log(" The transaction reverted. Possible reasons:");
      console.log("   - Contract doesn't have setVerifierRegistry function");
      console.log("   - Invalid registry address");
      console.log("   - Contract is paused or in wrong state");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});