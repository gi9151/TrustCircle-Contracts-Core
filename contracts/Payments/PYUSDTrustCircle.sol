// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../Core/TrustCircleMain.sol";
import "./interfaces/IPYUSD.sol";

/**
 * @title PYUSDTrustCircle
 * @dev TrustCircle especializado para PYUSD 
 */
contract PYUSDTrustCircle is TrustCircleMain {
    IPYUSD public pyusd;
    
    event PYUSDDeposited(address indexed user, uint256 amount);
    event PYUSDWithdrawn(address indexed user, uint256 amount);
    
    constructor(
        address _pyusdAddress,
        address _admin,
        uint256 _policyEnd,
        uint256 _coPayBps,
        uint256 _perClaimCap,
        uint256 _coverageLimitTotal,
        address _verifierPool
    ) TrustCircleMain(
        _admin,
        _pyusdAddress,
        _policyEnd,
        _coPayBps,
        _perClaimCap,
        _coverageLimitTotal,
        _verifierPool
    ) {
        pyusd = IPYUSD(_pyusdAddress);
    }
    
    /**
     * @dev Depositar PYUSD al circle
     */
    function depositPYUSD(uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        
        // Transferir PYUSD al contrato
        require(pyusd.transferFrom(msg.sender, address(this), amount), "PYUSD transfer failed");
        
        // Agregar como miembro automáticamente si no existe
        if (!members[msg.sender].isActive) {
            _joinAsPYUSDUser(amount);
        } else {
            // Si ya es miembro, solo agregar fondos
            totalPool += amount;
            members[msg.sender].contribution += amount;
            emit FundsAdded(msg.sender, amount);
        }
        
        emit PYUSDDeposited(msg.sender, amount);
    }
    
    /**
     * @dev Retirar PYUSD del circle
     */
    function withdrawPYUSD(uint256 amount) external onlyMember nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(totalPool >= amount, "Insufficient pool balance");
        require(members[msg.sender].contribution >= amount, "Insufficient user balance");
        
        // Transfiere PYUSD al usuario
        require(pyusd.transfer(msg.sender, amount), "PYUSD transfer failed");
        
        // Actualiza balances
        totalPool -= amount;
        members[msg.sender].contribution -= amount;
        
        emit FundsWithdrawn(msg.sender, amount);
        emit PYUSDWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Función interna para unir usuario con PYUSD
     */
    function _joinAsPYUSDUser(uint256 amount) internal {
        require(!members[msg.sender].isActive, "Already a member");
        require(amount >= 1 * 10**6, "Amount below minimum");
        require(totalMembers < MAX_MEMBERS, "Circle is full");

        members[msg.sender] = Member({
            isActive: true,
            contribution: amount,
            joinedAt: block.timestamp,
            zkIdentityCommitment: 0
        });

        memberList.push(msg.sender);
        totalMembers++;
        totalPool += amount;

        emit MemberJoined(msg.sender, amount, 0);
    }
    
    /**
     * @dev Procesa claim con PYUSD
     */
    function processPYUSDClaim(uint256 claimId) external onlyOwner nonReentrant {
        Claim storage claim = claims[claimId];
        require(claim.status == 0, "Claim already processed");

        uint256 totalVotes = claim.votesFor + claim.votesAgainst;
        require(totalVotes >= (totalMembers * quorumBps) / 10000, "No quorum");
        require(claim.votesFor >= (totalVotes * approvalBps) / 10000, "Not approved");

        if (claim.externalVerificationRequired && address(verifierPool) != address(0)) {
            require(verifierPool.hasExternalVerification(claimId), "External verification required");
        }

        claim.status = 1;
        uint256 copayAmount = (claim.amount * coPayBps) / 10000;
        uint256 payoutAmount = claim.amount - copayAmount;

        bool success = pyusd.transfer(claim.claimant, payoutAmount);
        require(success, "PYUSD payout failed");

        totalPool -= payoutAmount;
        emit ClaimProcessed(claimId, claim.status);
    }
    
    /**
     * @dev Obtiene información del pool PYUSD
     */
    function getPYUSDInfo() external view returns (uint256 poolBalance, uint256 contractBalance) {
        return (totalPool, pyusd.balanceOf(address(this)));
    }
    
    // Eventos 
    event FundsAdded(address indexed user, uint256 amount);
    event FundsWithdrawn(address indexed user, uint256 amount);
} 