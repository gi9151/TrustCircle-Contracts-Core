const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TrustCircle Semaphore", function () {
  let trustCircle, factory, mockUSDC, semaphoreMock;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Desplegar SemaphoreMock
    const SemaphoreMock = await ethers.getContractFactory("SemaphoreMock");
    semaphoreMock = await SemaphoreMock.deploy();
    await semaphoreMock.deployed();

    // Desplegar MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();

    // Dar tokens a usuarios
    await mockUSDC.mint(user1.address, ethers.utils.parseUnits("1000", 6));
    await mockUSDC.mint(user2.address, ethers.utils.parseUnits("1000", 6));

    // Desplegar Factory
    const TrustCircleFactory = await ethers.getContractFactory("TrustCircleFactory");
    factory = await TrustCircleFactory.deploy(semaphoreMock.address);
    await factory.deployed();

    // Crear círculo con Semaphore
    const currentBlock = await ethers.provider.getBlock("latest");
    const policyEnd = currentBlock.timestamp + (24 * 60 * 60);

    const tx = await factory.createTrustCircle(
      owner.address,
      mockUSDC.address,
      policyEnd,
      1000,
      ethers.utils.parseUnits("1000", 6),
      ethers.utils.parseUnits("10000", 6),
      true // withSemaphore = true
    );
    
    const receipt = await tx.wait();
    const circleAddress = receipt.events.find(e => e.event === 'CircleCreated').args.circleAddress;
    
    trustCircle = await ethers.getContractAt("TrustCircleSemaphore", circleAddress);
  });

  describe("Semaphore Integration", function () {
    it("Should create circle with Semaphore support", async function () {
      expect(await trustCircle.semaphore()).to.equal(semaphoreMock.address);
      expect(await trustCircle.groupId()).to.be.gt(0);
    });

    it("Should allow joining with ZK identity", async function () {
      const identityCommitment = 123456789;
      
      await mockUSDC.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
      
      await expect(trustCircle.connect(user1).joinWithZKIdentity(
        ethers.utils.parseUnits("100", 6),
        identityCommitment
      )).to.emit(trustCircle, "MemberJoined");
      
      const member = await trustCircle.members(user1.address);
      expect(member.isActive).to.be.true;
    });

    it("Should allow anonymous ZK voting", async function () {
      // Preparar
      await mockUSDC.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
      await trustCircle.connect(user1).joinWithZKIdentity(
        ethers.utils.parseUnits("100", 6),
        123456789
      );

      // Abrir reclamo
      const tx = await trustCircle.connect(user1).openClaim(
        ethers.utils.parseUnits("500", 6),
        "ipfs://QmEvidenceHash"
      );
      const receipt = await tx.wait();
      const claimId = receipt.events.find(e => e.event === 'ClaimOpened').args.claimId;

      // Votar anónimamente - USANDO LA NUEVA ESTRUCTURA
      const nullifier = 987654321;
      const merkleTreeRoot = 555555555;
      const merkleTreeDepth = 20;
      const points = [1, 2, 3, 4, 5, 6, 7, 8];

      await expect(trustCircle.connect(user1).voteClaimZK(
        claimId,
        true,
        merkleTreeDepth,
        merkleTreeRoot,
        nullifier,
        points
      )).to.emit(trustCircle, "ZKVote");

      const claim = await trustCircle.claims(claimId);
      expect(claim.votesFor).to.equal(1);
      expect(await trustCircle.usedNullifiers(nullifier)).to.be.true;
    });

    it("Should prevent double voting with same nullifier", async function () {
      // Preparar
      await mockUSDC.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("100", 6));
      await trustCircle.connect(user1).joinWithZKIdentity(
        ethers.utils.parseUnits("100", 6),
        123456789
      );

      const tx = await trustCircle.connect(user1).openClaim(
        ethers.utils.parseUnits("500", 6),
        "ipfs://QmEvidenceHash"
      );
      const receipt = await tx.wait();
      const claimId = receipt.events.find(e => e.event === 'ClaimOpened').args.claimId;

      const nullifier = 987654321;
      const merkleTreeRoot = 555555555;
      const merkleTreeDepth = 20;
      const points = [1, 2, 3, 4, 5, 6, 7, 8];

      // Primer voto
      await trustCircle.connect(user1).voteClaimZK(
        claimId,
        true,
        merkleTreeDepth,
        merkleTreeRoot,
        nullifier,
        points
      );

      // Segundo voto - debe fallar
      await expect(
        trustCircle.connect(user1).voteClaimZK(
          claimId,
          false,
          merkleTreeDepth,
          merkleTreeRoot,
          nullifier,
          points
        )
      ).to.be.revertedWith("Nullifier already used");
    });

    it("Should return ZK statistics", async function () {
      const [zkVotes, totalNullifiers] = await trustCircle.getZKStats();
      expect(zkVotes).to.equal(0);
      expect(totalNullifiers).to.equal(0);
    });
  });
});