// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./PYUSDTrustCircle.sol";

/**
 * @title PYUSDFactory
 * @dev Factory para crear círculos de confianza con PYUSD
 */
contract PYUSDFactory {
    address[] public allPYUSDCircles;
    address public immutable pyusdAddress;
    
    event PYUSDCircleCreated(address indexed circle, address indexed creator);
    
    constructor(address _pyusdAddress) {
        pyusdAddress = _pyusdAddress;
    }
    
    function createPYUSDTrustCircle(
        address admin,
        uint256 policyEnd,
        uint256 coPayBps,
        uint256 perClaimCap,
        uint256 coverageLimitTotal,
        address verifierPool
    ) external returns (address) {
        PYUSDTrustCircle circle = new PYUSDTrustCircle(
            pyusdAddress,
            admin,
            policyEnd,
            coPayBps,
            perClaimCap,
            coverageLimitTotal,
            verifierPool
        );
        
        allPYUSDCircles.push(address(circle));
        emit PYUSDCircleCreated(address(circle), msg.sender);
        
        return address(circle);
    }
    
    function getAllPYUSDCircles() external view returns (address[] memory) {
        return allPYUSDCircles;
    }
    
    function getPYUSDCirclesCount() external view returns (uint256) {
        return allPYUSDCircles.length;
    }
} 