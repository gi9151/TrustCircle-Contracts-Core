// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TrustCircleMain.sol";

contract TrustCircleFactory {
    address[] public deployedCircles;
    
    event CircleCreated(address indexed circleAddress, address indexed admin, address asset);
    
    function createTrustCircle(
        address _admin,
        address _asset,
        uint256 _policyEnd,
        uint256 _coPayBps,
        uint256 _perClaimCap,
        uint256 _coverageLimitTotal
    ) external returns (address) {
        TrustCircleMain circle = new TrustCircleMain(
            _admin,
            _asset,
            _policyEnd,
            _coPayBps,
            _perClaimCap,
            _coverageLimitTotal
        );
        
        deployedCircles.push(address(circle));
        emit CircleCreated(address(circle), _admin, _asset);
        
        return address(circle);
    }
    
    function getDeployedCircles() external view returns (address[] memory) {
        return deployedCircles;
    }
    
    function getCircleCount() external view returns (uint256) {
        return deployedCircles.length;
    }
}