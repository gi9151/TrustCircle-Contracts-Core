const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TrustCircle Core", function () {
  let trustCircle, factory, mockUSDC;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Desplegar MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();

    // Dar tokens a los usuarios de prueba
    await mockUSDC.mint(user1.address, ethers.utils.parseUnits("1000", 6));
    await mockUSDC.mint(user2.address, ethers.utils.parseUnits("1000", 6));

    // Desplegar Factory
    const TrustCircleFactory = await ethers.getContractFactory("TrustCircleFactory");
    factory = await TrustCircleFactory.deploy();
    await factory.deployed();

    // Usar timestamp del bloque actual
    const currentBlock = await ethers.provider.getBlock("latest");
    const policyEnd = currentBlock.timestamp + (24 * 60 * 60); // 24 horas en el futuro

    // Crear círculo
    const tx = await factory.createTrustCircle(
      owner.address,
      mockUSDC.address,
      policyEnd,
      1000, // 10% copay
      ethers.utils.parseUnits("1000", 6),
      ethers.utils.parseUnits("10000", 6)
    );
    
    const receipt = await tx.wait();
    const circleAddress = receipt.events.find(e => e.event === 'CircleCreated').args.circleAddress;
    
    trustCircle = await ethers.getContractAt("TrustCircleMain", circleAddress);
  });

  describe("Factory", function () {
    it("Should deploy factory and create circle", async function () {
      expect(await factory.getCircleCount()).to.equal(1);
    });

    it("Should return deployed circles", async function () {
      const circles = await factory.getDeployedCircles();
      expect(circles).to.have.lengthOf(1);
    });
  });

  describe("Circle Membership", function () {
    it("Should allow users to join", async function () {
      await mockUSDC.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
      
      await expect(trustCircle.connect(user1).join(ethers.utils.parseUnits("100", 6), 0))
        .to.emit(trustCircle, "MemberJoined");
      
      expect(await trustCircle.getMemberCount()).to.equal(1);

      const member = await trustCircle.members(user1.address);
      expect(member.isActive).to.be.true;
      expect(member.contribution).to.equal(ethers.utils.parseUnits("100", 6));

      const finalBalance = await mockUSDC.balanceOf(user1.address);
      expect(finalBalance).to.equal(ethers.utils.parseUnits("900", 6));
    });

    it("Should not allow duplicate membership", async function () {
      await mockUSDC.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
      await trustCircle.connect(user1).join(ethers.utils.parseUnits("100", 6), 0);
      
      await expect(
        trustCircle.connect(user1).join(ethers.utils.parseUnits("50", 6), 0)
      ).to.be.revertedWith("Already a member");
    });

    it("Should allow additional contributions", async function () {
      await mockUSDC.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("150", 6));
      await trustCircle.connect(user1).join(ethers.utils.parseUnits("100", 6), 0);
      
      await expect(trustCircle.connect(user1).contribute(ethers.utils.parseUnits("50", 6)))
        .to.emit(trustCircle, "ContributionMade");
      
      const member = await trustCircle.members(user1.address);
      expect(member.contribution).to.equal(ethers.utils.parseUnits("150", 6));
    });

    it("Should register ZK identity", async function () {
      await mockUSDC.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
      await trustCircle.connect(user1).join(ethers.utils.parseUnits("100", 6), 0);
      
      const zkCommitment = 123456789;
      await expect(trustCircle.connect(user1).registerZKIdentity(zkCommitment))
        .to.emit(trustCircle, "ZKIdentityRegistered");
      
      const member = await trustCircle.members(user1.address);
      expect(member.zkIdentityCommitment).to.equal(zkCommitment);
    });
  });

  describe("Claims Management", function () {
    beforeEach(async function () {
      await mockUSDC.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
      await mockUSDC.connect(user2).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
      await trustCircle.connect(user1).join(ethers.utils.parseUnits("100", 6), 0);
      await trustCircle.connect(user2).join(ethers.utils.parseUnits("100", 6), 0);
    });

    it("Should allow opening a claim", async function () {
      await expect(trustCircle.connect(user1).openClaim(
        ethers.utils.parseUnits("50", 6),
        "ipfs://QmEvidenceHash"
      )).to.emit(trustCircle, "ClaimOpened");
    });

    it("Should allow voting on claims", async function () {
      const tx = await trustCircle.connect(user1).openClaim(
        ethers.utils.parseUnits("50", 6),
        "ipfs://QmEvidenceHash"
      );
      const receipt = await tx.wait();
      const claimId = receipt.events.find(e => e.event === 'ClaimOpened').args.claimId;

      await expect(trustCircle.connect(user2).voteClaim(claimId, true))
        .to.emit(trustCircle, "ClaimVoted");
    });
  });
});
