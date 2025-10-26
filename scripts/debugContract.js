const { ethers } = require("hardhat");

async function main() {
  const CIRCLE_ADDR = "0x7Ca938e60A3FAfE8dc875EbfE37B56976711885e";
  
  console.log(" Debugging Contract at:", CIRCLE_ADDR);
  
  // Conectar al contrato con ABI mínima
  const abi = [
    "function owner() view returns (address)",
    "function asset() view returns (address)",
    "function totalMembers() view returns (uint256)",
    "function policyEnd() view returns (uint256)",
    "function minContribution() view returns (uint256)",
    "function perClaimCap() view returns (uint256)"
  ];
  
  const contract = await ethers.getContractAt(abi, CIRCLE_ADDR);
  
  // Verificar funciones básicas
  console.log("\n Basic Info:");
  try {
    const owner = await contract.owner();
    console.log("Owner:", owner);
  } catch (e) { console.log("Owner: Error -", e.message); }
  
  try {
    const asset = await contract.asset();
    console.log("Asset:", asset);
  } catch (e) { console.log("Asset: Error -", e.message); }
  
  try {
    const totalMembers = await contract.totalMembers();
    console.log("Total Members:", totalMembers.toString());
  } catch (e) { console.log("Total Members: Error -", e.message); }
  
  // Intentar detectar funciones de verificación
  console.log("\n Checking for verification functions...");
  
  // Lista de funciones a verificar
  const functionsToCheck = [
    "setVerifierRegistry",
    "verifierRegistry", 
    "setCaps",
    "capInternal",
    "capOneExt",
    "externalApprove",
    "requiredExternalApprovals"
  ];
  
  for (const funcName of functionsToCheck) {
    try {
      const contractWithFunc = await ethers.getContractAt([`function ${funcName}()`], CIRCLE_ADDR);
      await contractWithFunc[funcName]();
      console.log(` ${funcName}: EXISTS`);
    } catch (e) {
      console.log(` ${funcName}: NOT FOUND or ERROR`);
    }
  }
  
  // Verificar el código del contrato
  console.log("\n Contract Code Analysis:");
  const code = await ethers.provider.getCode(CIRCLE_ADDR);
  console.log("Contract has code:", code !== "0x");
  console.log("Code length:", code.length, "bytes");
}

main().catch(console.error);