// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import "../Core/TrustCircleMain.sol";

contract TrustCircleSemaphore is TrustCircleMain {
    ISemaphore public semaphore;
    uint256 public groupId;
    bool public useRealSemaphore;

    uint256 public zkVoteCounter;

    event MemberAddedToGroup(uint256 identityCommitment);
    event ZKVote(uint256 indexed claimId, uint256 nullifierHash, bool approved);
    event SemaphoreInitialized(bool useRealSemaphore, uint256 groupId);

    constructor(
        address _semaphoreAddress,
        address _admin,
        address _asset,
        uint256 _policyEnd,
        uint256 _coPayBps,
        uint256 _perClaimCap,
        uint256 _coverageLimitTotal,
        bool _useRealSemaphore
    ) TrustCircleMain(_admin, _asset, _policyEnd, _coPayBps, _perClaimCap, _coverageLimitTotal, _semaphoreAddress) {
        semaphore = ISemaphore(_semaphoreAddress);
        useRealSemaphore = _useRealSemaphore;
        
        // Crea ID único para el grupo de este círculo
        groupId = uint256(keccak256(abi.encodePacked(_admin, block.timestamp, _asset)));
        
        emit SemaphoreInitialized(_useRealSemaphore, groupId);
    }

    function initializeSemaphoreGroup() external onlyOwner returns (uint256) {
        if (useRealSemaphore) {
            // Semaphore obtiene ID real
            uint256 realGroupId = semaphore.createGroup(address(this));
            groupId = realGroupId;
            return realGroupId;
        } else {
            // Para mock, mantiene el ID temporal
            return groupId;
        }
    }

    function joinWithZKIdentity(uint256 amount, uint256 identityCommitment) external policyActive {
        join(amount, identityCommitment);
        
        if (useRealSemaphore) {
            semaphore.addMember(groupId, identityCommitment);
        }
        
        emit MemberAddedToGroup(identityCommitment);
    }

    function voteClaimZK(
        uint256 claimId,
        bool approve,
        uint256 merkleTreeDepth,
        uint256 merkleTreeRoot,
        uint256 nullifier,
        uint256[8] calldata points
    ) external {
        Claim storage claim = claims[claimId];
        require(claim.status == 0, "Claim not pending");
        require(!usedNullifiers[nullifier], "Nullifier already used");

     
        uint256 message = approve ? 1 : 0;
        
        // External nullifier = claimId
        uint256 scope = claimId;

        if (useRealSemaphore) {
            // Semaphore 
            ISemaphore.SemaphoreProof memory proof = ISemaphore.SemaphoreProof({
                merkleTreeDepth: merkleTreeDepth,
                merkleTreeRoot: merkleTreeRoot,
                nullifier: nullifier,
                message: message,
                scope: scope,
                points: points
            });

            semaphore.validateProof(groupId, proof);
        }
        // Para mock (no necesita verificación real)

        usedNullifiers[nullifier] = true;
        zkVoteCounter++; 

        if (approve) {
            claim.votesFor++;
        } else {
            claim.votesAgainst++;
        }

        emit ZKVote(claimId, nullifier, approve);
    }

    // Para verificar proof sin validar
    function verifyProofZK(
        uint256 claimId,
        bool approve,
        uint256 merkleTreeDepth,
        uint256 merkleTreeRoot,
        uint256 nullifier,
        uint256[8] calldata points
    ) external view returns (bool) {
        if (!useRealSemaphore) {
            return true; // Mock siempre retorna true
        }

        uint256 message = approve ? 1 : 0;
        uint256 scope = claimId;

        ISemaphore.SemaphoreProof memory proof = ISemaphore.SemaphoreProof({
            merkleTreeDepth: merkleTreeDepth,
            merkleTreeRoot: merkleTreeRoot,
            nullifier: nullifier,
            message: message,
            scope: scope,
            points: points
        });

        return semaphore.verifyProof(groupId, proof);
    }

    function getZKStats() external view returns (uint256 zkVotes, uint256 totalNullifiers) {
        return (zkVoteCounter, zkVoteCounter); 
    }
    
    function switchToRealSemaphore(address newSemaphoreAddress) external onlyOwner {
        semaphore = ISemaphore(newSemaphoreAddress);
        useRealSemaphore = true;
    }

   
    function getSemaphoreGroupId() external view returns (uint256) {
        return groupId;
    }
}