// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

/**
 * @title SemaphoreMock
 * @dev Mock de Semaphore v4 para testing
 */
contract SemaphoreMock is ISemaphore {
    mapping(uint256 => bool) public groups;
    uint256 public currentGroupCounter;
    
    event GroupCreated(uint256 indexed groupId, address admin);
    event MemberAdded(uint256 indexed groupId, uint256 identityCommitment);
    event ProofValidatedMock(uint256 indexed groupId, uint256 nullifier); // ← CAMBIÉ EL NOMBRE

    function groupCounter() external view override returns (uint256) {
        return currentGroupCounter;
    }

    function createGroup() external override returns (uint256) {
        return _createGroup(msg.sender);
    }

    function createGroup(address admin) external override returns (uint256) {
        return _createGroup(admin);
    }

    function createGroup(address admin, uint256) external override returns (uint256) {
        return _createGroup(admin);
    }

    function _createGroup(address admin) internal returns (uint256) {
        currentGroupCounter++;
        groups[currentGroupCounter] = true;
        emit GroupCreated(currentGroupCounter, admin);
        return currentGroupCounter;
    }

    function updateGroupAdmin(uint256, address) external override {
        // Mock implementation
    }

    function acceptGroupAdmin(uint256) external override {
        // Mock implementation
    }

    function updateGroupMerkleTreeDuration(uint256, uint256) external override {
        // Mock implementation
    }

    function addMember(uint256 groupId, uint256 identityCommitment) external override {
        require(groups[groupId], "Group does not exist");
        emit MemberAdded(groupId, identityCommitment);
    }

    function addMembers(uint256, uint256[] calldata) external override {
        // Mock implementation
    }

    function updateMember(uint256, uint256, uint256, uint256[] calldata) external override {
        // Mock implementation
    }

    function removeMember(uint256, uint256, uint256[] calldata) external override {
        // Mock implementation
    }

    function validateProof(uint256 groupId, SemaphoreProof calldata proof) external override {
        require(groups[groupId], "Group does not exist");
        emit ProofValidatedMock(groupId, proof.nullifier); // ← USAR NUEVO NOMBRE
    }

    function verifyProof(uint256 groupId, SemaphoreProof calldata) external view override returns (bool) {
        return groups[groupId];
    }
}