// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

contract TrustCircleBase is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    address public admin;
    IERC20 public asset;
    uint256 public policyEnd;
    uint256 public coPayBps;
    uint256 public perClaimCap;
    uint256 public coverageLimitTotal;
    
    uint256 public totalCovered;
    uint256 public totalContributions;
    
    struct Member {
        uint256 totalContributed;
        uint256 joinedAt;
        bool isActive;
        uint256 zkIdentityCommitment;
    }
    
    struct Claim {
        address beneficiary;
        uint256 amount;
        string evidenceURI;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 createdAt;
        uint8 status;
        uint8 tier;
        bytes32 zkNullifier;
    }
    
    mapping(address => Member) public members;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    address[] public memberList;
    mapping(uint256 => Claim) public claims;
    uint256 public claimCounter;

    constructor() {}
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    function _initialize(
        address _admin,
        address _asset,
        uint256 _policyEnd,
        uint256 _coPayBps,
        uint256 _perClaimCap,
        uint256 _coverageLimitTotal
    ) internal {
        require(_coPayBps <= 10000, "Invalid copay");
        admin = _admin;
        asset = IERC20(_asset);
        policyEnd = _policyEnd;
        coPayBps = _coPayBps;
        perClaimCap = _perClaimCap;
        coverageLimitTotal = _coverageLimitTotal;
    }
}