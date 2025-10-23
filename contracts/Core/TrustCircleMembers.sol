// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TrustCircleBase.sol";

/**
 * @title TrustCircleMembers
 * @dev Gestión de miembros del círculo de confianza
 */
contract TrustCircleMembers is TrustCircleBase {
    event MemberJoined(address indexed member, uint256 amount);
    event ContributionMade(address indexed member, uint256 amount);
    event ZKIdentityRegistered(address indexed member, uint256 commitment);

    constructor(
        address _admin,
        address _asset,
        uint256 _policyEnd,
        uint256 _coPayBps,
        uint256 _perClaimCap,
        uint256 _coverageLimitTotal
    ) {
        _initialize(_admin, _asset, _policyEnd, _coPayBps, _perClaimCap, _coverageLimitTotal);
    }

    modifier onlyMember() {
        require(members[msg.sender].isActive, "Not member");
        _;
    }

    modifier policyActive() {
        require(block.timestamp < policyEnd, "Policy ended");
        _;
    }

    /**
     * @dev Unirse al círculo de confianza con contribución inicial
     */
    function join(uint256 amount, uint256 zkCommitment) external policyActive nonReentrant {
        require(!members[msg.sender].isActive, "Already member");
        require(amount > 0, "Amount must be > 0");
        
        require(asset.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        members[msg.sender] = Member(amount, block.timestamp, true, zkCommitment);
        memberList.push(msg.sender);
        totalContributions += amount;
        
        emit MemberJoined(msg.sender, amount);
        
        if (zkCommitment != 0) {
            emit ZKIdentityRegistered(msg.sender, zkCommitment);
        }
    }

    /**
     * @dev Contribuir fondos adicionales al círculo de confianza
     */
    function contribute(uint256 amount) external onlyMember policyActive nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        require(asset.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        members[msg.sender].totalContributed += amount;
        totalContributions += amount;
        
        emit ContributionMade(msg.sender, amount);
    }

    /**
     * @dev Registrar identidad ZK para votación anónima
     */
    function registerZKIdentity(uint256 zkCommitment) external onlyMember {
        require(zkCommitment != 0, "Invalid commitment");
        members[msg.sender].zkIdentityCommitment = zkCommitment;
        emit ZKIdentityRegistered(msg.sender, zkCommitment);
    }

    /**
     * @dev Obtener número total de miembros
     */
    function getMemberCount() external view returns (uint256) {
        return memberList.length;
    }
}