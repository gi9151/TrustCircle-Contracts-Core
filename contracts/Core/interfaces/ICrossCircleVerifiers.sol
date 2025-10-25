// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface ICrossCircleVerifiers {
    event VerifierStaked(address indexed verifier, uint256 amount);
    event VerifierAssigned(uint256 indexed claimId, address indexed verifier);
    event VerificationCompleted(uint256 indexed claimId, bool approved);
    event VerifierSlashed(address indexed verifier, uint256 amount);
    
    function stakeAsVerifier(uint256 amount) external;
    function unstakeVerifier() external;
    function assignVerifiers(uint256 claimId, uint256 claimAmount, address beneficiary) external returns (address[] memory);
    function submitVerification(uint256 claimId, bool approved) external;
    function getVerifierStake(address verifier) external view returns (uint256);
    function getVerifierReputation(address verifier) external view returns (uint256);
    function hasExternalVerification(uint256 claimId) external view returns (bool);
    function getActiveVerifiersCount() external view returns (uint256);
}