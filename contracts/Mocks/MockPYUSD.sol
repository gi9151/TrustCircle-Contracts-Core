// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockPYUSD
 * @dev Mock de PYUSD para desarrollo y testing
 */
contract MockPYUSD is ERC20 {
    constructor() ERC20("Mock PayPal USD", "mPYUSD") {
        _mint(msg.sender, 100000 * 10**6); // 100000 PYUSD para testing
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
    
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}