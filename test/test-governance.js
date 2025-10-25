const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TrustCircle Governance & CCVP System", function () {
  let trustCircle, verifierPool, mockUSDC, factory;
  let owner, user1, user2, user3, user4, user5, user6, user7, user8, user9, user10;

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, user6, user7, user8, user9, user10] = await ethers.getSigners();

    // Desplegar MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();

    // Desplegar CrossCircleVerifiers
    const CrossCircleVerifiers = await ethers.getContractFactory("CrossCircleVerifiers");
    verifierPool = await CrossCircleVerifiers.deploy(mockUSDC.address);
    await verifierPool.deployed();

    // Desplegar TrustCircleFactory
    const TrustCircleFactory = await ethers.getContractFactory("TrustCircleFactory");
    factory = await TrustCircleFactory.deploy(verifierPool.address);
    await factory.deployed();

    // Crear círculo con governance
    const currentBlock = await ethers.provider.getBlock("latest");
    const policyEnd = currentBlock.timestamp + (90 * 24 * 60 * 60);

    const tx = await factory.createTrustCircle(
      owner.address,
      mockUSDC.address,
      policyEnd,
      1000,
      ethers.utils.parseUnits("1000", 6),
      ethers.utils.parseUnits("10000", 6),
      false
    );
    
    const receipt = await tx.wait();
    const circleAddress = receipt.events.find(e => e.event === 'CircleCreated').args.circleAddress;
    
    trustCircle = await ethers.getContractAt("TrustCircleMain", circleAddress);

    // Transferir ownership del VerifierPool al TrustCircle
    await verifierPool.transferOwnership(trustCircle.address);

    // Dar tokens a TODOS los usuarios para testing
    const allUsers = [user1, user2, user3, user4, user5, user6, user7, user8, user9, user10];
    for (let user of allUsers) {
      await mockUSDC.mint(user.address, ethers.utils.parseUnits("10000", 6));
    }
  });

  describe("Governance Parameters", function () {
    it("Should have correct default governance parameters", async function () {
      expect(await trustCircle.quorumBps()).to.equal(5000);
      expect(await trustCircle.approvalBps()).to.equal(7000);
    });

    it("Should allow owner to update governance parameters", async function () {
      await trustCircle.updateGovernanceConfig(6000, 8000);
      expect(await trustCircle.quorumBps()).to.equal(6000);
      expect(await trustCircle.approvalBps()).to.equal(8000);
    });

    it("Should prevent non-owners from updating governance", async function () {
      await expect(
        trustCircle.connect(user1).updateGovernanceConfig(6000, 8000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Member Limits", function () {
    it("Should enforce minimum members requirement for claims", async function () {
      // Unir solo 2 miembros (menos del mínimo de 3)
      await mockUSDC.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("500", 6));
      await trustCircle.connect(user1).join(ethers.utils.parseUnits("500", 6), 0);
      
      await mockUSDC.connect(user2).approve(trustCircle.address, ethers.utils.parseUnits("500", 6));
      await trustCircle.connect(user2).join(ethers.utils.parseUnits("500", 6), 0);

      await expect(
        trustCircle.connect(user1).openClaim(ethers.utils.parseUnits("100", 6), "ipfs://test")
      ).to.be.revertedWith("Not enough members");
    });

    it("Should enforce maximum members limit", async function () {
      // Llenar el círculo hasta el máximo (10 miembros)
      const users = [user1, user2, user3, user4, user5, user6, user7, user8, user9, user10];
      for (let user of users) {
        await mockUSDC.connect(user).approve(trustCircle.address, ethers.utils.parseUnits("500", 6));
        await trustCircle.connect(user).join(ethers.utils.parseUnits("500", 6), 0);
      }

      // Intentar agregar miembro 11 debería fallar
      const user11 = (await ethers.getSigners())[11];
      await mockUSDC.mint(user11.address, ethers.utils.parseUnits("5000", 6));
      await mockUSDC.connect(user11).approve(trustCircle.address, ethers.utils.parseUnits("500", 6));
      
      await expect(
        trustCircle.connect(user11).join(ethers.utils.parseUnits("500", 6), 0)
      ).to.be.revertedWith("Circle is full");
    });

    it("Should return correct member limits", async function () {
      const [min, max] = await trustCircle.getMembersLimit();
      expect(min).to.equal(3);
      expect(max).to.equal(10);
    });
  });

  describe("Quorum Validation", function () {
    beforeEach(async function () {
      // Unir 5 miembros al círculo para testing de quorum
      const users = [user1, user2, user3, user4, user5];
      for (let user of users) {
        await mockUSDC.connect(user).approve(trustCircle.address, ethers.utils.parseUnits("500", 6));
        await trustCircle.connect(user).join(ethers.utils.parseUnits("500", 6), 0);
      }
    });

    it("Should reject claim without quorum", async function () {
      // User1 abre claim PEQUEÑO (no requiere verificadores externos)
      const tx = await trustCircle.connect(user1).openClaim(
        ethers.utils.parseUnits("50", 6), // <= 100 USDC - no requiere verificadores
        "ipfs://test-evidence"
      );
      const receipt = await tx.wait();
      const claimId = receipt.events.find(e => e.event === 'ClaimOpened').args.claimId;

      // Solo 1 voto (20% - menos del 50% quorum con 5 miembros)
      await trustCircle.connect(user1).voteClaim(claimId, true);

      // Debería fallar por falta de quorum
      await expect(trustCircle.processClaim(claimId))
        .to.be.revertedWith("No quorum");
    });

    it("Should approve claim with sufficient quorum and approval", async function () {
      // User1 abre claim PEQUEÑO
      const tx = await trustCircle.connect(user1).openClaim(
        ethers.utils.parseUnits("50", 6), // <= 100 USDC
        "ipfs://test-evidence"
      );
      const receipt = await tx.wait();
      const claimId = receipt.events.find(e => e.event === 'ClaimOpened').args.claimId;

      // 3 votos a favor (60% participación - cumple quorum 50%)
      await trustCircle.connect(user1).voteClaim(claimId, true);
      await trustCircle.connect(user2).voteClaim(claimId, true);
      await trustCircle.connect(user3).voteClaim(claimId, true);

      // Debería procesarse exitosamente
      await expect(trustCircle.processClaim(claimId))
        .to.emit(trustCircle, "ClaimProcessed")
        .withArgs(claimId, 1);
    });

    it("Should reject claim without sufficient approval", async function () {
      const tx = await trustCircle.connect(user1).openClaim(
        ethers.utils.parseUnits("50", 6), // <= 100 USDC
        "ipfs://test-evidence"
      );
      const receipt = await tx.wait();
      const claimId = receipt.events.find(e => e.event === 'ClaimOpened').args.claimId;

      // 5 votos: 2 a favor, 3 en contra
      // 5/5 participación (100% - cumple quorum)
      // 2/5  aprueban (40% - NO cumple 70%)
      await trustCircle.connect(user1).voteClaim(claimId, true);
      await trustCircle.connect(user2).voteClaim(claimId, true);
      await trustCircle.connect(user3).voteClaim(claimId, false);
      await trustCircle.connect(user4).voteClaim(claimId, false);
      await trustCircle.connect(user5).voteClaim(claimId, false);

      await expect(trustCircle.processClaim(claimId))
        .to.be.revertedWith("Not approved");
    });
  });

  describe("Cross-Circle Verifier Pool Integration", function () {
    beforeEach(async function () {
      // Agregar verificadores al pool (usuarios diferentes a los miembros)
      const verifierUsers = [user6, user7, user8];
      for (let user of verifierUsers) {
        await mockUSDC.connect(user).approve(verifierPool.address, ethers.utils.parseUnits("30", 6));
        await verifierPool.connect(user).stakeAsVerifier(ethers.utils.parseUnits("30", 6));
      }

      // Agregar mínimo de miembros al círculo
      const memberUsers = [user1, user2, user3];
      for (let user of memberUsers) {
        await mockUSDC.connect(user).approve(trustCircle.address, ethers.utils.parseUnits("500", 6));
        await trustCircle.connect(user).join(ethers.utils.parseUnits("500", 6), 0);
      }
    });

    it("Should require external verification for large claims (>100 USDC)", async function () {
      const tx = await trustCircle.connect(user1).openClaim(
        ethers.utils.parseUnits("200", 6), // > 100 USDC
        "ipfs://large-claim"
      );
      const receipt = await tx.wait();
      const claimId = receipt.events.find(e => e.event === 'ClaimOpened').args.claimId;

      const claim = await trustCircle.getClaim(claimId);
      expect(claim.externalVerificationRequired).to.be.true;
    });

    it("Should NOT require external verification for small claims (<=100 USDC)", async function () {
      const tx = await trustCircle.connect(user1).openClaim(
        ethers.utils.parseUnits("50", 6), // <= 100 USDC
        "ipfs://small-claim"
      );
      const receipt = await tx.wait();
      const claimId = receipt.events.find(e => e.event === 'ClaimOpened').args.claimId;

      const claim = await trustCircle.getClaim(claimId);
      expect(claim.externalVerificationRequired).to.be.false;
    });
  });

  describe("Verifier Pool Functionality", function () {
    it("Should allow users to become verifiers with stake", async function () {
      // Usar user9 que no ha sido usado antes
      await mockUSDC.connect(user9).approve(verifierPool.address, ethers.utils.parseUnits("30", 6));
      
      await expect(verifierPool.connect(user9).stakeAsVerifier(ethers.utils.parseUnits("30", 6)))
        .to.emit(verifierPool, "VerifierStaked")
        .withArgs(user9.address, ethers.utils.parseUnits("30", 6));

      expect(await verifierPool.getVerifierStake(user9.address)).to.equal(ethers.utils.parseUnits("30", 6));
    });

    it("Should reject stake below minimum", async function () {
      await mockUSDC.connect(user10).approve(verifierPool.address, ethers.utils.parseUnits("10", 6));
      
      await expect(
        verifierPool.connect(user10).stakeAsVerifier(ethers.utils.parseUnits("10", 6))
      ).to.be.revertedWith("Stake below minimum");
    });

    it("Should allow verifiers to unstake", async function () {
      // Convertirse en verificador con user9
      await mockUSDC.connect(user9).approve(verifierPool.address, ethers.utils.parseUnits("30", 6));
      await verifierPool.connect(user9).stakeAsVerifier(ethers.utils.parseUnits("30", 6));

      // Esperar un poco para evitar "Recent verification pending"
      await ethers.provider.send("evm_increaseTime", [86401]); // +1 día
      await ethers.provider.send("evm_mine", []);

      // Intentar retirar stake
      await expect(verifierPool.connect(user9).unstakeVerifier())
        .to.not.be.reverted;

      expect(await verifierPool.getVerifierStake(user9.address)).to.equal(0);
    });
  });

  describe("Member Management", function () {
    it("Should calculate active members correctly", async function () {
      // Unir miembros
      await mockUSDC.connect(user1).approve(trustCircle.address, ethers.utils.parseUnits("500", 6));
      await trustCircle.connect(user1).join(ethers.utils.parseUnits("500", 6), 0);
      
      await mockUSDC.connect(user2).approve(trustCircle.address, ethers.utils.parseUnits("500", 6));
      await trustCircle.connect(user2).join(ethers.utils.parseUnits("500", 6), 0);

      expect(await trustCircle.getActiveMembersCount()).to.equal(2);
      expect(await trustCircle.totalMembers()).to.equal(2);
    });
  });
});