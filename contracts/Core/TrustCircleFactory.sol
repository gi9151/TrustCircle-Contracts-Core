// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./TrustCircleMain.sol";
import "../Semaphore/TrustCircleSemaphore.sol";

contract TrustCircleFactory {
    address public semaphoreAddress;
    address[] public allCircles;
    
    event CircleCreated(address indexed circleAddress, bool withSemaphore);

    constructor(address _semaphoreAddress) {
        semaphoreAddress = _semaphoreAddress;
    }

    function createTrustCircle(
        address admin,
        address asset,
        uint256 policyEnd,
        uint256 coPayBps,
        uint256 perClaimCap,
        uint256 coverageLimitTotal,
        bool withSemaphore
    ) external returns (address) {
        address circle;
        
        if (withSemaphore) {
            circle = address(new TrustCircleSemaphore(
                semaphoreAddress,    // _semaphoreAddress
                admin,              // _admin
                asset,              // _asset  
                policyEnd,          // _policyEnd
                coPayBps,           // _coPayBps
                perClaimCap,        // _perClaimCap
                coverageLimitTotal, // _coverageLimitTotal
                false               // _useRealSemaphore
            ));
        } else {
            circle = address(new TrustCircleMain(
                admin,
                asset,
                policyEnd,
                coPayBps,
                perClaimCap,
                coverageLimitTotal,
                semaphoreAddress    
            ));
        }
        
        allCircles.push(circle);
        emit CircleCreated(circle, withSemaphore);
        return circle;
    }

    function getCirclesCount() external view returns (uint256) {
        return allCircles.length;
    }
}