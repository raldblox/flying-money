// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC — "Test money" for LOCAL ANVIL ONLY (BUILD_SPEC §7.3)
/// @notice 6 decimals. `faucet()` mints 100 mUSDC to the caller, at most once per hour per address.
///         There is no owner mint. Never deployed to a public chain (testnets use Circle's official USDC).
contract MockUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 100e6;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public nextFaucetAt;

    error FaucetCooldown();

    constructor() ERC20("Mock USD Coin", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        if (block.timestamp < nextFaucetAt[msg.sender]) revert FaucetCooldown();
        nextFaucetAt[msg.sender] = block.timestamp + FAUCET_COOLDOWN;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
