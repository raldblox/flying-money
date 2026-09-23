// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {FlyingMoney} from "../src/FlyingMoney.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice One script, every chain (BUILD_SPEC §7.5).
///   CHAIN_KEY     registry key (arbitrum-sepolia, …, anvil)
///   DEPLOYER_KEY  from env only; never printed
///   FM_CONFIRM_MAINNET must equal CHAIN_KEY to deploy to a mainnet (human approval, §0.1)
/// Reads chain id, USDC and both caps from packages/chains/registry/<key>.json (generated from the TS registry).
/// Stops if the chain id or USDC decimals don't match the registry (§0.1 stop-and-ask).
contract Deploy is Script {
    error RegistryMismatch(string what);
    error MainnetNotConfirmed();

    function run() external returns (FlyingMoney fm, address usdc) {
        string memory key = vm.envString("CHAIN_KEY");
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/../packages/chains/registry/", key, ".json"));

        uint256 chainId = vm.parseJsonUint(json, ".chainId");
        bool mainnet = vm.parseJsonBool(json, ".mainnet");
        uint128 maxFace = uint128(vm.parseJsonUint(json, ".maxFaceValue"));
        uint128 maxTotal = uint128(vm.parseJsonUint(json, ".maxTotalOutstanding"));
        usdc = vm.parseJsonAddress(json, ".usdc");

        if (block.chainid != chainId) revert RegistryMismatch("chainId");
        if (mainnet) {
            if (keccak256(bytes(vm.envOr("FM_CONFIRM_MAINNET", string("")))) != keccak256(bytes(key))) {
                revert MainnetNotConfirmed();
            }
            if (maxFace == 0 || maxTotal == 0) revert RegistryMismatch("mainnet caps must be non-zero");
        }

        uint256 pk = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(pk);
        if (chainId == 31337) {
            usdc = address(new MockUSDC()); // local anvil only (§7.3)
        } else {
            if (usdc.code.length == 0) revert RegistryMismatch("USDC has no code");
            if (IERC20Metadata(usdc).decimals() != 6) revert RegistryMismatch("USDC decimals");
        }
        fm = new FlyingMoney(IERC20(usdc), maxFace, maxTotal);
        vm.stopBroadcast();

        console.log("chain", key, chainId);
        console.log("FlyingMoney", address(fm));
        console.log("USDC", usdc);
        console.log("caps (per-cert, deployment-wide)", maxFace, maxTotal);

        string memory o = "deployment";
        vm.serializeString(o, "key", key);
        vm.serializeUint(o, "chainId", chainId);
        vm.serializeAddress(o, "usdc", usdc);
        vm.serializeUint(o, "maxFaceValue", maxFace);
        vm.serializeUint(o, "maxTotalOutstanding", maxTotal);
        string memory out = vm.serializeAddress(o, "flyingMoney", address(fm));
        vm.writeJson(out, string.concat(vm.projectRoot(), "/deployments/", key, ".json"));
    }
}
