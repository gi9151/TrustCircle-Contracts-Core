const { ethers } = require("hardhat");

async function main() {
  console.log(" Running Demo Test...");
  
  const trustCircle = await ethers.getContractAt("PYUSDTrustCircle", "0x8dAF17A20c9DBA35f005b6324F493785D239719d");
  const mockPYUSD = await ethers.getContractAt("MockPYUSD", "0x0165878A594ca255338adfa4d48449f69242Eb8F");
  const [deployer, user1, user2, user3] = await ethers.getSigners();

  console.log("1. Approving TrustCircle to spend PYUSD...");
  await mockPYUSD.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
  
  console.log("2. Depositing 10 PYUSD...");
  await trustCircle.connect(user1).depositPYUSD(ethers.utils.parseUnits("10", 6));
  
  console.log("3. Adding members...");
  await trustCircle.connect(deployer).addMember(user2.address);
  await trustCircle.connect(deployer).addMember(user3.address);
  
  console.log("4. Opening claim for 1 PYUSD...");
  await trustCircle.connect(user1).openClaim(ethers.utils.parseUnits("1", 6), "demo-accident.jpg");
  
  console.log("5. Voting on claim...");
  await trustCircle.connect(deployer).voteClaim(1, true);
  await trustCircle.connect(user2).voteClaim(1, true);
  await trustCircle.connect(user3).voteClaim(1, true);
  
  console.log("6. Processing claim...");
  await trustCircle.connect(deployer).processPYUSDClaim(1);
  
  console.log(" DEMO COMPLETED!");
  console.log("Final User1 PYUSD Balance:", ethers.utils.formatUnits(await mockPYUSD.balanceOf(user1.address), 6));
  console.log("Final Pool Balance:", ethers.utils.formatUnits(await trustCircle.totalPool(), 6));
}

main().catch(console.error);