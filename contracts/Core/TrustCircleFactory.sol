// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./TrustCircleMain.sol";
import "../Semaphore/TrustCircleSemaphore.sol";

contract TrustCircleFactory {
    address public semaphoreAddress;
    address[] public deployedCircles;
    
    event CircleCreated(address indexed circleAddress, address indexed admin, address asset, bool withSemaphore);
    
    constructor(address _semaphoreAddress) {
        semaphoreAddress = _semaphoreAddress;
    }
    
    function createTrustCircle(
        address _admin,
        address _asset,
        uint256 _policyEnd,
        uint256 _coPayBps,
        uint256 _perClaimCap,
        uint256 _coverageLimitTotal,
        bool _withSemaphore
    ) external returns (address) {
        address circle;
        
        if (_withSemaphore && semaphoreAddress != address(0)) {
            // Crear círculo con Semaphore
            circle = address(new TrustCircleSemaphore(
                semaphoreAddress,
                _admin,
                _asset,
                _policyEnd,
                _coPayBps,
                _perClaimCap,
                _coverageLimitTotal
            ));
        } else {
            // Crear círculo básico
            circle = address(new TrustCircleMain(
                _admin,
                _asset,
                _policyEnd,
                _coPayBps,
                _perClaimCap,
                _coverageLimitTotal
            ));
        }
        
        deployedCircles.push(circle);
        emit CircleCreated(circle, _admin, _asset, _withSemaphore);
        
        return circle;
    }
    
    function getDeployedCircles() external view returns (address[] memory) {
        return deployedCircles;
    }
    
    function getCircleCount() external view returns (uint256) {
        return deployedCircles.length;
    }
}