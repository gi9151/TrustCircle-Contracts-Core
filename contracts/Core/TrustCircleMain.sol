// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/ICrossCircleVerifiers.sol";

/**
 * @title TrustCircleMain
 * @dev Gobernanza básica, límites de miembros y verificaciones externas por umbrales.
 *
 * Reglas de aprobaciones externas (asumiendo token con 6 decimales, p.ej. mPYUSD):
 *  - amount <= capInternal  (por defecto 100e6)  -> 0 verificaciones externas
 *  - amount <= capOneExt    (por defecto 500e6)  -> 1 verificación externa
 *  - amount >  capOneExt                         -> 2 verificaciones externas
 */
interface IVerifierRegistry {
    function isVerifier(address who) external view returns (bool);
}

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
        uint8 status; // 0=PENDING, 1=PAID/FINALIZED, 2=REJECTED
        uint256 votesFor;
        uint256 votesAgainst;
        string evidence; // IPFS CID u otro
        bool externalVerificationRequired; // compatibilidad con flujo previo
        uint8 extApprovals; //  aprobaciones externas acumuladas
    }

    // Variables
    IERC20 public asset;
    uint256 public policyEnd;
    uint256 public coPayBps;
    uint256 public perClaimCap;
    uint256 public coverageLimitTotal;
    uint256 public minContribution = 100 * 10**6; // 100 con 6 decimales

    // Governance
    uint256 public quorumBps = 5000;   // 50%
    uint256 public approvalBps = 7000; // 70%

    // Pool de verificación externa (existente, opcional)
    ICrossCircleVerifiers public verifierPool;

    //  Registro simple de verificadores externos (lista blanca)
    IVerifierRegistry public verifierRegistry;

    //  Umbrales (6 decimales)
    uint256 public capInternal = 100 * 10**6; // <=100 → 0 externas
    uint256 public capOneExt  = 500 * 10**6;  // <=500 → 1 externa; >500 → 2

    // Contadores y storage
    Counters.Counter private _claimIds;
    mapping(address => Member) public members;
    mapping(uint256 => Claim) public claims;
    mapping(uint256 => bool) public usedNullifiers;
    address[] public memberList;

    uint256 public totalMembers;
    uint256 public totalPool;

    // Seguimiento de aprobaciones externas por claimId y verificador
    mapping(uint256 => mapping(address => bool)) public extApprovedBy;

    // Eventos
    event MemberJoined(address indexed member, uint256 amount, uint256 zkIdentityCommitment);
    event ClaimOpened(uint256 indexed claimId, address indexed claimant, uint256 amount);
    event ClaimVoted(uint256 indexed claimId, address indexed voter, bool approved);
    event ClaimProcessed(uint256 indexed claimId, uint8 status);
    event ExternalApproved(uint256 indexed claimId, address indexed verifier, uint8 totalExtApprovals);

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

    
    //        JOIN / MEMBER
    
    function join(uint256 amount, uint256 zkCommitment)
        public
        policyActive
        nonReentrant
    {
        require(!members[msg.sender].isActive, "Already a member");
        require(amount >= 1 * 10**6, "Amount below minimum");
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

    
    //         CLAIMS
    
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

        bool needsExternal = (amount > capInternal);

        claims[claimId] = Claim({
            claimant: msg.sender,
            amount: amount,
            openedAt: block.timestamp,
            status: 0,
            votesFor: 0,
            votesAgainst: 0,
            evidence: evidence,
            externalVerificationRequired: needsExternal,
            extApprovals: 0
        });

        // Compatibilidad con asignación externa previa (opcional)
        if (needsExternal && address(verifierPool) != address(0)) {
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

    
    //  EXTERNAL VERIFICATIONS
    

    /// @notice Devuelve cuántas aprobaciones externas requiere un monto.
    function requiredExternalApprovals(uint256 amount) public view returns (uint8) {
        if (amount <= capInternal) return 0;
        if (amount <= capOneExt)   return 1;
        return 2;
    }

    /// @notice Un verificador externo aprueba un claim específico.
    function externalApprove(uint256 claimId) external {
        Claim storage c = claims[claimId];
        require(c.status == 0, "Claim not pending");
        require(address(verifierRegistry) != address(0), "no registry");
        require(verifierRegistry.isVerifier(msg.sender), "not verifier");
        require(!extApprovedBy[claimId][msg.sender], "already approved");

        extApprovedBy[claimId][msg.sender] = true;
        c.extApprovals += 1;

        emit ExternalApproved(claimId, msg.sender, c.extApprovals);
    }

    
    //     PROCESS / PAYOUT
    
    function processClaim(uint256 claimId) external onlyOwner nonReentrant {
        Claim storage claim = claims[claimId];
        require(claim.status == 0, "Claim already processed");

        // 1) Verifica quorum básico
        uint256 totalVotes = claim.votesFor + claim.votesAgainst;
        require(totalVotes >= (totalMembers * quorumBps) / 10000, "No quorum");

        // 2) Verifica aprobación interna
        require(claim.votesFor >= (totalVotes * approvalBps) / 10000, "Not approved");

        // 3) Verificación externa por umbral
        uint8 need = requiredExternalApprovals(claim.amount);

        // Compatibilidad: si usas un pool externo que marca verificación “global”
        if (claim.externalVerificationRequired && address(verifierPool) != address(0)) {
            require(verifierPool.hasExternalVerification(claimId), "External verification required");
        }

        // Requisito de conteo propio (independiente del pool)
        require(claim.extApprovals >= need, "Need more external approvals");

        // 4) Payout con copago
        claim.status = 1;
        uint256 copayAmount = (claim.amount * coPayBps) / 10000;
        uint256 payoutAmount = claim.amount - copayAmount;

        bool success = asset.transfer(claim.claimant, payoutAmount);
        require(success, "Transfer failed");

        totalPool -= payoutAmount;

        emit ClaimProcessed(claimId, claim.status);
    }

    
    //        GOVERNANCE
    
    function updateGovernanceConfig(uint256 _quorumBps, uint256 _approvalBps) external onlyOwner {
        require(_quorumBps <= 10000, "Invalid quorum");
        require(_approvalBps <= 10000, "Invalid approval");
        quorumBps = _quorumBps;
        approvalBps = _approvalBps;
    }

    //  setear registro de verificadores
    function setVerifierRegistry(address reg) external onlyOwner {
        verifierRegistry = IVerifierRegistry(reg);
    }

    //  setear caps/umbrales
    function setCaps(uint256 _capInternal, uint256 _capOneExt) external onlyOwner {
        require(_capInternal < _capOneExt, "caps order");
        capInternal = _capInternal;
        capOneExt   = _capOneExt;
    }

    
    //          GETTERS
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
