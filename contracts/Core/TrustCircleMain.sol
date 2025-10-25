// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/ICrossCircleVerifiers.sol";

/**
 * @title TrustCircleMain
 * @dev Governanza básica y límites de miembros
 */
contract TrustCircleMain is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;

    // Límites de miembros
    uint256 public constant MIN_MEMBERS = 3;
    uint256 public constant MAX_MEMBERS = 10;

    struct Member {
        bool isActive;
        uint256 contribution;
        uint256 joinedAt;
        uint256 zkIdentityCommitment;
    }

    struct Claim {
        address claimant;
        uint256 amount;
        uint256 openedAt;
        uint8 status;
        uint256 votesFor;
        uint256 votesAgainst;
        string evidence;
        bool externalVerificationRequired;
    }

    // Variables 
    IERC20 public asset;
    uint256 public policyEnd;
    uint256 public coPayBps;
    uint256 public perClaimCap;
    uint256 public coverageLimitTotal;
    uint256 public minContribution = 100 * 10**6;

    // Governance 
    uint256 public quorumBps = 5000;  // 50%
    uint256 public approvalBps = 7000; // 70%
    ICrossCircleVerifiers public verifierPool;

    // Contadores
    Counters.Counter private _claimIds;
    mapping(address => Member) public members;
    mapping(uint256 => Claim) public claims;
    mapping(uint256 => bool) public usedNullifiers;
    address[] public memberList;

    uint256 public totalMembers;
    uint256 public totalPool;

    // Eventos
    event MemberJoined(address indexed member, uint256 amount, uint256 zkIdentityCommitment);
    event ClaimOpened(uint256 indexed claimId, address indexed claimant, uint256 amount);
    event ClaimVoted(uint256 indexed claimId, address indexed voter, bool approved);
    event ClaimProcessed(uint256 indexed claimId, uint8 status);

    // Modifiers
    modifier policyActive() {
        require(block.timestamp < policyEnd, "Policy expired");
        _;
    }

    modifier onlyMember() {
        require(members[msg.sender].isActive, "Not a member");
        _;
    }

    constructor(
        address _admin,
        address _asset,
        uint256 _policyEnd,
        uint256 _coPayBps,
        uint256 _perClaimCap,
        uint256 _coverageLimitTotal,
        address _verifierPool
    ) {
        asset = IERC20(_asset);
        policyEnd = _policyEnd;
        coPayBps = _coPayBps;
        perClaimCap = _perClaimCap;
        coverageLimitTotal = _coverageLimitTotal;
        verifierPool = ICrossCircleVerifiers(_verifierPool);
        _transferOwnership(_admin);
    }

    //  FUNCIONES ESENCIALES 

    function join(uint256 amount, uint256 zkCommitment) 
        public  
        policyActive 
        nonReentrant 
    {
        require(!members[msg.sender].isActive, "Already a member");
        require(amount >= minContribution, "Amount below minimum");
        require(totalMembers < MAX_MEMBERS, "Circle is full");

        bool success = asset.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        members[msg.sender] = Member({
            isActive: true,
            contribution: amount,
            joinedAt: block.timestamp,
            zkIdentityCommitment: zkCommitment
        });

        memberList.push(msg.sender);
        totalMembers++;
        totalPool += amount;

        emit MemberJoined(msg.sender, amount, zkCommitment);
    }

    function openClaim(uint256 amount, string memory evidence) 
        external 
        onlyMember 
        policyActive 
        returns (uint256) 
    {
        require(amount <= perClaimCap, "Exceeds per-claim cap");
        require(totalMembers >= MIN_MEMBERS, "Not enough members");

        _claimIds.increment();
        uint256 claimId = _claimIds.current();

        bool needsExternalVerification = amount > 100 * 10**6;

        claims[claimId] = Claim({
            claimant: msg.sender,
            amount: amount,
            openedAt: block.timestamp,
            status: 0,
            votesFor: 0,
            votesAgainst: 0,
            evidence: evidence,
            externalVerificationRequired: needsExternalVerification
        });

        if (needsExternalVerification && address(verifierPool) != address(0)) {
            verifierPool.assignVerifiers(claimId, amount, msg.sender);
        }

        emit ClaimOpened(claimId, msg.sender, amount);
        return claimId;
    }

    function voteClaim(uint256 claimId, bool approve) external onlyMember {
        Claim storage claim = claims[claimId];
        require(claim.status == 0, "Claim not pending");

        if (approve) {
            claim.votesFor++;
        } else {
            claim.votesAgainst++;
        }

        emit ClaimVoted(claimId, msg.sender, approve);
    }

    function processClaim(uint256 claimId) external onlyOwner nonReentrant {
        Claim storage claim = claims[claimId];
        require(claim.status == 0, "Claim already processed");

        // Verifica quorum básico
        uint256 totalVotes = claim.votesFor + claim.votesAgainst;
        require(totalVotes >= (totalMembers * quorumBps) / 10000, "No quorum");

        uint256 requiredApproval = (totalVotes * approvalBps) / 10000; 

        // Verifica aprobación
        require(claim.votesFor >= (totalVotes * approvalBps) / 10000, "Not approved");

        // Verificación externa 
        if (claim.externalVerificationRequired && address(verifierPool) != address(0)) {
            require(
                verifierPool.hasExternalVerification(claimId),
                "External verification required"
            );
        }

        // Procesa pago
        claim.status = 1;
        uint256 copayAmount = (claim.amount * coPayBps) / 10000;
        uint256 payoutAmount = claim.amount - copayAmount;

        bool success = asset.transfer(claim.claimant, payoutAmount);
        require(success, "Transfer failed");

        totalPool -= payoutAmount;

        emit ClaimProcessed(claimId, claim.status);
    }

    //  FUNCIONES DE GOVERNANCE 

    function updateGovernanceConfig(uint256 _quorumBps, uint256 _approvalBps) external onlyOwner {
        require(_quorumBps <= 10000, "Invalid quorum");
        require(_approvalBps <= 10000, "Invalid approval");
        quorumBps = _quorumBps;
        approvalBps = _approvalBps;
    }

    //  GETTERS ESENCIALES 

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return claims[claimId];
    }

    function getMember(address member) external view returns (Member memory) {
        return members[member];
    }

    function getActiveMembersCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint i = 0; i < memberList.length; i++) {
            if (members[memberList[i]].isActive) {
                count++;
            }
        }
        return count;
    }

    function getMembersLimit() external pure returns (uint256 min, uint256 max) {
        return (MIN_MEMBERS, MAX_MEMBERS);
    }

    function canAcceptNewMembers() external view returns (bool) {
        return totalMembers < MAX_MEMBERS;
    }

    function hasMinimumMembers() external view returns (bool) {
        return totalMembers >= MIN_MEMBERS;
    }
}