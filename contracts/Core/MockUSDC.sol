// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @dev Token mock de USDC para testing
 */
contract MockUSDC is ERC20 {
    uint8 private _decimals;

    constructor() ERC20("Mock USDC", "mUSDC") {
        _decimals = 6;
        _mint(msg.sender, 1000000 * 10**6); // 1 millón de USDC //
    }

    /**
     * @dev Mintear tokens para testing
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @dev Faucet para obtener tokens gratis
     */
    function faucet() external {
        _mint(msg.sender, 1000 * 10**6); // 1000 USDC //
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}