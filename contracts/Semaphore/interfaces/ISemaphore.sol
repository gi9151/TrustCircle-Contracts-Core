// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISemaphore {
    function createGroup(
        uint256 groupId,
        uint8 depth,
        address admin
    ) external;
    
    function addMember(uint256 groupId, uint256 identityCommitment) external;
    
    function verifyProof(
        uint256 groupId,
        uint256 merkleTreeRoot,
        uint256 signal,
        uint256 nullifierHash,
        uint256 externalNullifier,
        uint256[8] calldata proof
    ) external;
}