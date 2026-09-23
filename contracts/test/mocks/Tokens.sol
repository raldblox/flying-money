// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Plain 6-decimal token with open mint, for tests only.
contract TestUSDC is ERC20 {
    constructor() ERC20("Test USDC", "tUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Fee-on-transfer fixture (§7.4 #2): burns 1% of every transfer.
contract FeeOnTransferToken is TestUSDC {
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

/// @dev Malicious token (§7.4 #12): on transfer it re-enters the target with arbitrary calldata.
contract ReentrantToken is TestUSDC {
    address public target;
    bytes public payload;
    bool public armed;

    function arm(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
        armed = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (armed && from != address(0) && to != address(0)) {
            armed = false;
            (bool ok, bytes memory ret) = target.call(payload);
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
    }
}

/// @dev Code etched onto the spender address (§7.4 #9): accepts garbage via ERC-1271, rejects everything else.
contract GarbageAccepting1271 {
    bytes32 public constant GARBAGE = keccak256("garbage");

    function isValidSignature(bytes32, bytes calldata sig) external pure returns (bytes4) {
        return keccak256(sig) == GARBAGE ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }
}
