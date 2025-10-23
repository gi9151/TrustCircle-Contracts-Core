// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TrustCircleMembers.sol";

/**
 * @title TrustCircleMain
 * @dev Contrato principal para círculos de confianza
 */
contract TrustCircleMain is TrustCircleMembers {
    // Eventos
    event ClaimOpened(uint256 indexed claimId, address indexed beneficiary, uint256 amount, uint8 tier);
    event ClaimVoted(uint256 indexed claimId, address indexed voter, bool approve);
    event ClaimFinalized(uint256 indexed claimId, uint8 status);
    event ClaimPaid(uint256 indexed claimId, address indexed beneficiary, uint256 amount);
    event RefundIssued(address indexed member, uint256 amount);

    // Umbrales para niveles de riesgo //
    uint256 public constant LOW_TIER_THRESHOLD = 100 * 10**6;
    uint256 public constant MEDIUM_TIER_THRESHOLD = 500 * 10**6;

    mapping(uint256 => bool) public usedNullifiers;
    uint256 public zkVoteCounter;

    // Parámetros de votación por nivel de riesgo //
    struct TierParams {
        uint256 quorumBps;
        uint256 approvalBps;
    }
    
    mapping(uint8 => TierParams) public tierParams;

    constructor(
        address _admin,
        address _asset,
        uint256 _policyEnd,
        uint256 _coPayBps,
        uint256 _perClaimCap,
        uint256 _coverageLimitTotal
    ) TrustCircleMembers(_admin, _asset, _policyEnd, _coPayBps, _perClaimCap, _coverageLimitTotal) {
        // Configurar parámetros de votación //
        tierParams[0] = TierParams(6000, 7000);   // Low: 60% quorum, 70% approval //
        tierParams[1] = TierParams(7000, 8000);   // Medium: 70% quorum, 80% approval // 
        tierParams[2] = TierParams(8000, 8000);   // High: 80% quorum, 80% approval //
    }

    function openClaim(uint256 amount, string calldata evidenceURI) external onlyMember policyActive returns (uint256) {
        require(amount > 0 && amount <= perClaimCap, "Invalid amount");
        require(totalCovered + amount <= coverageLimitTotal, "Exceeds total limit");
        
        uint256 claimId = claimCounter++;
        Claim storage newClaim = claims[claimId];
        
        newClaim.beneficiary = msg.sender;
        newClaim.amount = amount;
        newClaim.evidenceURI = evidenceURI;
        newClaim.createdAt = block.timestamp;
        newClaim.status = 0; // Pending
        newClaim.tier = _determineRiskTier(amount);
        
        emit ClaimOpened(claimId, msg.sender, amount, newClaim.tier);
        return claimId;
    }

    function voteClaim(uint256 claimId, bool approve) external onlyMember {
        Claim storage claim = claims[claimId];
        require(claim.status == 0, "Claim not pending");
        require(!hasVoted[claimId][msg.sender], "Already voted");
        require(claim.beneficiary != msg.sender, "Cannot vote own claim");
        
        hasVoted[claimId][msg.sender] = true;
        
        if (approve) {
            claim.votesFor++;
        } else {
            claim.votesAgainst++;
        }
        
        emit ClaimVoted(claimId, msg.sender, approve);
    }

    function finalizeClaim(uint256 claimId) external nonReentrant {
        Claim storage claim = claims[claimId];
        require(claim.status == 0, "Claim not pending");
        
        uint256 totalVotes = claim.votesFor + claim.votesAgainst;
        uint256 totalMembers = memberList.length;
        
        TierParams memory params = tierParams[claim.tier];
        uint256 quorumNeeded = (totalMembers * params.quorumBps) / 10000;
        require(totalVotes >= quorumNeeded, "Quorum not reached");
        
        uint256 approvalNeeded = (totalVotes * params.approvalBps) / 10000;
        
        if (claim.votesFor >= approvalNeeded) {
            claim.status = 1; // Approved
            _payClaim(claimId);
        } else {
            claim.status = 2; // Rejected
        }
        
        emit ClaimFinalized(claimId, claim.status);
    }

    function _payClaim(uint256 claimId) internal {
        Claim storage claim = claims[claimId];
        require(claim.status == 1, "Claim not approved");
        
        uint256 amount = claim.amount;
        uint256 copay = 0;

        if (coPayBps > 0) {
            copay = (amount * coPayBps) / 10000;
            amount -= copay;
        }
        
        require(asset.balanceOf(address(this)) >= amount, "Insufficient funds");
        
        claim.status = 3; // Paid
        totalCovered += amount;
        
        require(asset.transfer(claim.beneficiary, amount), "Payment failed");
        emit ClaimPaid(claimId, claim.beneficiary, amount);
    }

    function refundProRata() external onlyMember nonReentrant {
        require(block.timestamp >= policyEnd, "Policy active");
        
        Member storage member = members[msg.sender];
        require(member.totalContributed > 0, "No contributions");
        
        uint256 remainingFunds = asset.balanceOf(address(this));
        uint256 memberShare = (remainingFunds * member.totalContributed) / totalContributions;
        
        member.totalContributed = 0;
        
        if (memberShare > 0) {
            require(asset.transfer(msg.sender, memberShare), "Refund failed");
            emit RefundIssued(msg.sender, memberShare);
        }
    }

    function _determineRiskTier(uint256 amount) internal pure returns (uint8) {
        if (amount < LOW_TIER_THRESHOLD) return 0;
        else if (amount < MEDIUM_TIER_THRESHOLD) return 1;
        else return 2;
    }

    function getCircleBalance() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}