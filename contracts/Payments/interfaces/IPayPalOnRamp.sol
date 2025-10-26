// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

// Para simulación de PayPal On-Ramp
interface IPayPalOnRamp {
    function verifyPayPalTransaction(string memory transactionId, uint256 amount, string memory email) external view returns (bool);
    function simulatePayPalDeposit(address user, uint256 amount, string memory transactionId) external returns (bool);
}


