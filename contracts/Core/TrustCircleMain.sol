// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title TrustCircle
 * @dev Contrato  para gestión de miembros y reclamos
 */
contract TrustCircleMain is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;

    // Estructuras
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
        uint8 status; // 0 = pending, 1 = approved, 2 = rejected
        uint256 votesFor;
        uint256 votesAgainst;
        string evidence;
    }

    // Variables básicas
    IERC20 public asset;
    uint256 public policyEnd;
    uint256 public coPayBps;
    uint256 public perClaimCap;
    uint256 public coverageLimitTotal;
    uint256 public minContribution = 100 * 10**6;

    // Contadores
    Counters.Counter private _claimIds;
    mapping(address => Member) public members;
    mapping(uint256 => Claim) public claims;
    mapping(uint256 => bool) public usedNullifiers;
    address[] public memberList;

    uint256 public totalMembers;
    uint256 public totalPool;
    uint256 public totalContributions;
    uint256 public zkVoteCounter;

    // Eventos
    event MemberJoined(address indexed member, uint256 amount, uint256 zkIdentityCommitment);
    event ContributionMade(address indexed member, uint256 amount);
    event ClaimOpened(uint256 indexed claimId, address indexed claimant, uint256 amount);
    event ClaimVoted(uint256 indexed claimId, address indexed voter, bool approved);
    event ClaimProcessed(uint256 indexed claimId, uint8 status);
    event ZKIdentityRegistered(address indexed member, uint256 commitment);

    // Modifiers
    modifier policyActive() {
        require(block.timestamp < policyEnd, "Policy expired");
        _;
    }

    modifier onlyMember() {
        require(members[msg.sender].isActive, "Not a member");
        _;
    }

 
    // Constructor
    constructor(
        address _admin,
        address _asset,
        uint256 _policyEnd,
        uint256 _coPayBps,
        uint256 _perClaimCap,
        uint256 _coverageLimitTotal
    ) {
        asset = IERC20(_asset);
        policyEnd = _policyEnd;
        coPayBps = _coPayBps;
        perClaimCap = _perClaimCap;
        coverageLimitTotal = _coverageLimitTotal;
        _transferOwnership(_admin);
    }

    // Funciones de miembros
    function join(uint256 amount, uint256 zkCommitment) 
        external 
        policyActive 
        nonReentrant 
    {
        require(!members[msg.sender].isActive, "Already a member");
        require(amount >= minContribution, "Amount below minimum");

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
        totalContributions += amount;

        emit MemberJoined(msg.sender, amount, zkCommitment);

        if (zkCommitment != 0) {
            emit ZKIdentityRegistered(msg.sender, zkCommitment);
        }
    }

    function contribute(uint256 amount) 
        external 
        onlyMember 
        policyActive 
        nonReentrant 
    {
        require(amount > 0, "Amount must be > 0");

        bool success = asset.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        members[msg.sender].contribution += amount;
        totalPool += amount;
        totalContributions += amount;

        emit ContributionMade(msg.sender, amount);
    }

    function registerZKIdentity(uint256 zkCommitment) external onlyMember {
        require(zkCommitment != 0, "Invalid commitment");
        members[msg.sender].zkIdentityCommitment = zkCommitment;
        emit ZKIdentityRegistered(msg.sender, zkCommitment);
    }

    function getMemberCount() external view returns (uint256) {
        return memberList.length;
    }

    function getMember(address member) external view returns (Member memory) {
        return members[member];
    }

    // Funciones de reclamos
    function openClaim(uint256 amount, string memory evidence) 
        external 
        onlyMember 
        policyActive 
        returns (uint256) 
    {
        require(amount <= perClaimCap, "Exceeds per-claim cap");

        _claimIds.increment();
        uint256 claimId = _claimIds.current();

        claims[claimId] = Claim({
            claimant: msg.sender,
            amount: amount,
            openedAt: block.timestamp,
            status: 0,
            votesFor: 0,
            votesAgainst: 0,
            evidence: evidence
        });

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

        if (claim.votesFor > claim.votesAgainst) {
            claim.status = 1;
            uint256 copayAmount = (claim.amount * coPayBps) / 10000;
            uint256 payoutAmount = claim.amount - copayAmount;

            bool success = asset.transfer(claim.claimant, payoutAmount);
            require(success, "Transfer failed");

            totalPool -= payoutAmount;
        } else {
            claim.status = 2;
        }

        emit ClaimProcessed(claimId, claim.status);
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return claims[claimId];
    }
}
