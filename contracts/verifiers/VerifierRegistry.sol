// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice registro simple de verificadores externos.
/// - El owner los da de alta/baja.
/// - Luego, los círculos consultan "isVerifier(addr)".
contract VerifierRegistry {
    address public owner;
    mapping(address => bool) public isVerifier;

    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    modifier onlyOwner() {
        require(msg.sender == owner, "onlyOwner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function addVerifier(address v) external onlyOwner {
        isVerifier[v] = true;
        emit VerifierAdded(v);
    }

    function removeVerifier(address v) external onlyOwner {
        isVerifier[v] = false;
        emit VerifierRemoved(v);
    }
}
