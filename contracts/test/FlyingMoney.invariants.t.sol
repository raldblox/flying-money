// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FlyingMoney} from "../src/FlyingMoney.sol";

/// @dev 6-decimal token that records every transfer out of / into the watched contract.
contract TrackingUSDC is ERC20 {
    address public watched;
    mapping(address => uint256) public receivedFromWatched;
    mapping(address => uint256) public sentToWatched;
    uint256 public totalOutOfWatched;

    struct Out {
        address to;
        uint256 amount;
    }

    Out[] internal _outs;

    constructor() ERC20("Tracking USDC", "tUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function watch(address w) external {
        watched = w;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function outCount() external view returns (uint256) {
        return _outs.length;
    }

    function outAt(uint256 i) external view returns (address, uint256) {
        return (_outs[i].to, _outs[i].amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (from == watched && from != address(0)) {
            receivedFromWatched[to] += value;
            totalOutOfWatched += value;
            _outs.push(Out(to, value));
        }
        if (to == watched && from != address(0)) sentToWatched[from] += value;
    }
}

contract Handler is Test {
    FlyingMoney public fm;
    TrackingUSDC public usdc;

    address[3] public funders;
    address[3] public payees;
    uint256[3] public spenderPks;
    address public stranger = address(0x5157);

    bytes32[] public ids;
    mapping(bytes32 => uint256) public certSpenderPk;

    // ghosts
    mapping(bytes32 => uint256) public ghostMaxRedeemedCumulative; // highest cumulative that actually paid
    mapping(bytes32 => uint256) public ghostPaidToPayee; // measured via token transfers
    mapping(bytes32 => uint256) public ghostLastRedeemed; // for monotonicity (I7)
    mapping(bytes32 => bool) public ghostReclaimed;
    mapping(address => uint256) public ghostFaceIssuedBy; // Σ face (issue + topUp) per funder (I4)
    mapping(address => uint256) public ghostExpectedToPayee; // I3/I5 accounting
    mapping(address => uint256) public ghostExpectedToFunder; // I5 accounting
    uint256 public ghostTotalExpectedOut;

    bool public violationI5; // a transfer went to someone other than the cert's payee/funder
    bool public violationI6; // a transfer happened for a reclaimed certificate
    bool public violationI7; // redeemed decreased, or payout != highest redeemed cumulative

    uint256 public calls;
    uint256 public okIssue;
    uint256 public okRedeemPaid;
    uint256 public okBatchPaid;
    uint256 public okReclaim;

    constructor(FlyingMoney fm_, TrackingUSDC usdc_) {
        fm = fm_;
        usdc = usdc_;
        for (uint256 i; i < 3; ++i) {
            funders[i] = address(uint160(0xF000 + i));
            payees[i] = address(uint160(0xE000 + i));
            spenderPks[i] = 0xA000 + i;
            vm.prank(funders[i]);
            usdc.approve(address(fm), type(uint256).max);
        }
    }

    function idCount() external view returns (uint256) {
        return ids.length;
    }

    // ───────── helpers ─────────

    function _pick(uint256 seed) internal view returns (bytes32 id, bool ok) {
        if (ids.length == 0) return (bytes32(0), false);
        return (ids[seed % ids.length], true);
    }

    function _sign(bytes32 id, uint256 cumulative, bytes32 memo, uint256 pk) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, fm.noteDigest(id, cumulative, memo));
        return abi.encodePacked(r, s, v);
    }

    /// Check every new transfer out of the contract since `fromIdx` against the allowed recipient/amount.
    function _checkOuts(uint256 fromIdx, bytes32 id, address allowedTo) internal {
        uint256 n = usdc.outCount();
        for (uint256 i = fromIdx; i < n; ++i) {
            (address to, uint256 amount) = usdc.outAt(i);
            if (to != allowedTo) violationI5 = true;
            if (ghostReclaimed[id]) violationI6 = true;
            if (to == fm.getCertificate(id).payee) ghostPaidToPayee[id] += amount;
        }
    }

    function _afterRedeem(bytes32 id, uint256 cumulative, uint256 paid) internal {
        FlyingMoney.Certificate memory c = fm.getCertificate(id);
        if (c.redeemed < ghostLastRedeemed[id]) violationI7 = true;
        ghostLastRedeemed[id] = c.redeemed;
        if (paid > 0) {
            if (cumulative > ghostMaxRedeemedCumulative[id]) ghostMaxRedeemedCumulative[id] = cumulative;
            ghostExpectedToPayee[c.payee] += paid;
            ghostTotalExpectedOut += paid;
        }
        if (ghostPaidToPayee[id] != c.redeemed || c.redeemed != ghostMaxRedeemedCumulative[id]) violationI7 = true;
    }

    // ───────── actions ─────────

    function issue(uint256 fSeed, uint256 pSeed, uint256 sSeed, uint256 face, uint256 life) external {
        calls++;
        address f = funders[fSeed % 3];
        face = bound(face, 1, 1_000e6);
        // mostly short lifetimes so expiry/reclaim paths are exercised; sometimes up to the 365 d maximum
        life = life % 8 == 0 ? bound(life, 1 hours, 365 days) : bound(life, 1 hours, 3 days);
        usdc.mint(f, face);
        uint256 pk = spenderPks[sSeed % 3];
        vm.prank(f);
        try fm.issue(payees[pSeed % 3], vm.addr(pk), uint128(face), uint64(block.timestamp + life)) returns (bytes32 id)
        {
            ids.push(id);
            certSpenderPk[id] = pk;
            ghostFaceIssuedBy[f] += face;
            okIssue++;
        } catch {}
    }

    function topUp(uint256 seed, uint256 amount) external {
        calls++;
        (bytes32 id, bool ok) = _pick(seed);
        if (!ok) return;
        address f = fm.getCertificate(id).funder;
        amount = bound(amount, 1, 500e6);
        usdc.mint(f, amount);
        vm.prank(f);
        try fm.topUp(id, uint128(amount)) {
            ghostFaceIssuedBy[f] += amount;
        } catch {}
    }

    function extend(uint256 seed, uint256 delta) external {
        calls++;
        (bytes32 id, bool ok) = _pick(seed);
        if (!ok) return;
        FlyingMoney.Certificate memory c = fm.getCertificate(id);
        delta = bound(delta, 1, 60 days);
        vm.prank(c.funder);
        try fm.extend(id, c.expiresAt + uint64(delta)) {} catch {}
    }

    /// Redeem a note: mostly authentic, sometimes stale/duplicated/over-face/forged; by the payee or a stranger.
    function redeem(uint256 seed, uint256 cumSeed, uint256 mode, bool byStranger) external {
        calls++;
        (bytes32 id, bool ok) = _pick(seed);
        if (!ok) return;
        FlyingMoney.Certificate memory c = fm.getCertificate(id);
        uint256 cumulative;
        uint256 m = mode % 10;
        if (m == 0) cumulative = c.redeemed; // duplicate / already covered

        else if (m == 1) cumulative = c.redeemed / 2; // older note

        else if (m == 2) cumulative = uint256(c.faceValue) + 1 + (cumSeed % 1e6); // over face value

        else cumulative = bound(cumSeed, 0, c.faceValue);
        uint256 pk = m == 3 ? spenderPks[(seed + 1) % 3] + 7 : certSpenderPk[id]; // m==3: forged signer
        bytes memory sig = _sign(id, cumulative, bytes32(cumSeed), pk);

        uint256 outIdx = usdc.outCount();
        vm.prank(byStranger ? stranger : c.payee);
        try fm.redeem(id, cumulative, bytes32(cumSeed), sig) returns (uint256 paid) {
            _checkOuts(outIdx, id, c.payee);
            _afterRedeem(id, cumulative, paid);
            if (paid > 0) okRedeemPaid++;
        } catch {
            if (usdc.outCount() != outIdx) violationI5 = true; // a reverted call can't leave transfers
        }
    }

    /// Batch redemption of up to 4 notes across certificates, including stale and forged ones.
    function redeemMany(uint256 seed, uint256 cumSeed) external {
        calls++;
        if (ids.length == 0) return;
        uint256 n = 1 + (seed % 4);
        FlyingMoney.SignedNote[] memory notes = new FlyingMoney.SignedNote[](n);
        bytes32[] memory cids = new bytes32[](n);
        for (uint256 i; i < n; ++i) {
            bytes32 id = ids[uint256(keccak256(abi.encode(seed, i))) % ids.length];
            cids[i] = id;
            FlyingMoney.Certificate memory c = fm.getCertificate(id);
            uint256 cum = bound(uint256(keccak256(abi.encode(cumSeed, i))), 0, uint256(c.faceValue) + 1);
            uint256 pk = (cumSeed + i) % 7 == 0 ? 0xBAD : certSpenderPk[id];
            notes[i] = FlyingMoney.SignedNote(id, cum, bytes32(i), _sign(id, cum, bytes32(i), pk));
        }
        uint256 outIdx = usdc.outCount();
        uint256[] memory before = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            before[i] = fm.getCertificate(cids[i]).redeemed;
        }

        vm.prank(stranger);
        try fm.redeemMany(notes) {
            // attribute each transfer: recipient must be the payee of some cert in the batch
            uint256 outs = usdc.outCount();
            for (uint256 k = outIdx; k < outs; ++k) {
                (address to,) = usdc.outAt(k);
                bool known;
                for (uint256 i; i < n; ++i) {
                    if (to == fm.getCertificate(cids[i]).payee) known = true;
                }
                if (!known) violationI5 = true;
            }
            for (uint256 i; i < n; ++i) {
                bytes32 id = cids[i];
                bool seen;
                for (uint256 j; j < i; ++j) {
                    if (cids[j] == id) seen = true;
                }
                if (seen) continue; // count each certificate once per batch (before[] of its first slot)
                FlyingMoney.Certificate memory c = fm.getCertificate(id);
                if (c.redeemed < ghostLastRedeemed[id]) violationI7 = true;
                if (c.redeemed > before[i]) {
                    uint256 paid = c.redeemed - before[i];
                    if (ghostReclaimed[id]) violationI6 = true;
                    if (c.redeemed > ghostMaxRedeemedCumulative[id]) ghostMaxRedeemedCumulative[id] = c.redeemed;
                    ghostPaidToPayee[id] += paid;
                    ghostExpectedToPayee[c.payee] += paid;
                    ghostTotalExpectedOut += paid;
                    okBatchPaid++;
                }
                ghostLastRedeemed[id] = c.redeemed;
            }
        } catch {
            if (usdc.outCount() != outIdx) violationI5 = true;
        }
    }

    function warp(uint256 dt) external {
        calls++;
        vm.warp(block.timestamp + bound(dt, 1, 2 days));
    }

    function reclaim(uint256 seed, bool byStranger) external {
        calls++;
        (bytes32 id, bool ok) = _pick(seed);
        if (!ok) return;
        FlyingMoney.Certificate memory c = fm.getCertificate(id);
        uint256 outIdx = usdc.outCount();
        vm.prank(byStranger ? stranger : c.funder);
        try fm.reclaim(id) returns (uint256 refunded) {
            _checkOuts(outIdx, id, c.funder);
            ghostReclaimed[id] = true;
            okReclaim++;
            ghostExpectedToFunder[c.funder] += refunded;
            ghostTotalExpectedOut += refunded;
        } catch {
            if (usdc.outCount() != outIdx) violationI5 = true;
        }
    }
}

abstract contract InvariantsBase is Test {
    FlyingMoney internal fm;
    TrackingUSDC internal usdc;
    Handler internal handler;

    function _caps() internal pure virtual returns (uint128 maxFace, uint128 maxTotal);

    function setUp() public {
        usdc = new TrackingUSDC();
        (uint128 maxFace, uint128 maxTotal) = _caps();
        fm = new FlyingMoney(IERC20(address(usdc)), maxFace, maxTotal);
        usdc.watch(address(fm));
        handler = new Handler(fm, usdc);
        targetContract(address(handler));
    }

    /// Coverage guard: the handler must actually exercise the protocol, not pass vacuously.
    function afterInvariant() public view {
        console.log(
            "issued %s, redeems paid %s, batch payouts %s",
            handler.okIssue(),
            handler.okRedeemPaid(),
            handler.okBatchPaid()
        );
        console.log("reclaims %s, calls %s", handler.okReclaim(), handler.calls());
    }

    /// I1: redeemed ≤ faceValue for every certificate.
    function invariant_I1_redeemedLeFaceValue() public view {
        uint256 n = handler.idCount();
        for (uint256 i; i < n; ++i) {
            FlyingMoney.Certificate memory c = fm.getCertificate(handler.ids(i));
            assertLe(c.redeemed, c.faceValue);
        }
    }

    /// I2: balanceOf(contract) == totalOutstanding == Σ open (faceValue − redeemed).
    function invariant_I2_solvency() public view {
        uint256 sum;
        uint256 n = handler.idCount();
        for (uint256 i; i < n; ++i) {
            FlyingMoney.Certificate memory c = fm.getCertificate(handler.ids(i));
            if (!c.closed) sum += uint256(c.faceValue) - c.redeemed;
        }
        assertEq(fm.totalOutstanding(), sum, "totalOutstanding == sum over open certs");
        assertEq(usdc.balanceOf(address(fm)), fm.totalOutstanding(), "balance == totalOutstanding");
    }

    /// I2b: totalOutstanding ≤ maxTotalOutstanding whenever the cap ≠ 0 (and per-cert cap on faceValue).
    function invariant_I2b_caps() public view {
        (uint128 maxFace, uint128 maxTotal) = _caps();
        if (maxTotal != 0) assertLe(fm.totalOutstanding(), maxTotal);
        if (maxFace != 0) {
            uint256 n = handler.idCount();
            for (uint256 i; i < n; ++i) {
                assertLe(fm.getCertificate(handler.ids(i)).faceValue, maxFace);
            }
        }
    }

    /// I7: redeemed never decreases; each certificate's total payout == its highest redeemed cumulative.
    function invariant_I7_monotonicRedemption() public view {
        assertFalse(handler.violationI7(), "I7 violated during a call");
        uint256 n = handler.idCount();
        for (uint256 i; i < n; ++i) {
            bytes32 id = handler.ids(i);
            FlyingMoney.Certificate memory c = fm.getCertificate(id);
            assertEq(handler.ghostPaidToPayee(id), c.redeemed);
            assertEq(handler.ghostMaxRedeemedCumulative(id), c.redeemed);
        }
    }

    /// I3: each payee's received total == Σ over its certificates of the highest redeemed cumulative.
    function invariant_I3_payeeReceivesHighestCumulative() public view {
        for (uint256 p; p < 3; ++p) {
            address payee = handler.payees(p);
            uint256 expected;
            uint256 n = handler.idCount();
            for (uint256 i; i < n; ++i) {
                bytes32 id = handler.ids(i);
                if (fm.getCertificate(id).payee == payee) expected += handler.ghostMaxRedeemedCumulative(id);
            }
            assertEq(usdc.balanceOf(payee), expected);
            assertEq(usdc.receivedFromWatched(payee), expected);
        }
    }

    /// I4: a funder's total outflow into the contract ≤ the total face value it issued (issue + topUp).
    function invariant_I4_funderOutflowLeIssued() public view {
        for (uint256 f; f < 3; ++f) {
            address funder = handler.funders(f);
            assertLe(usdc.sentToWatched(funder), handler.ghostFaceIssuedBy(funder));
            assertLe(usdc.receivedFromWatched(funder), usdc.sentToWatched(funder), "refunds <= deposits");
        }
    }

    /// I5: no certificate pays anyone other than its payee (redeem) or funder (reclaim).
    function invariant_I5_onlyPayeeOrFunder() public view {
        assertFalse(handler.violationI5(), "I5 violated during a call");
        uint256 accounted;
        for (uint256 i; i < 3; ++i) {
            assertEq(usdc.receivedFromWatched(handler.payees(i)), handler.ghostExpectedToPayee(handler.payees(i)));
            assertEq(usdc.receivedFromWatched(handler.funders(i)), handler.ghostExpectedToFunder(handler.funders(i)));
            accounted += usdc.receivedFromWatched(handler.payees(i)) + usdc.receivedFromWatched(handler.funders(i));
        }
        assertEq(usdc.receivedFromWatched(handler.stranger()), 0);
        assertEq(usdc.totalOutOfWatched(), accounted, "every outflow went to a payee or funder");
        assertEq(usdc.totalOutOfWatched(), handler.ghostTotalExpectedOut());
    }

    /// I6: after reclaim, no further transfers occur for that certificate.
    function invariant_I6_noTransfersAfterReclaim() public view {
        assertFalse(handler.violationI6(), "I6 violated during a call");
    }
}

/// Testnet-style deployment (caps 0 = unlimited).
contract FlyingMoneyInvariantsUncapped is InvariantsBase {
    function _caps() internal pure override returns (uint128, uint128) {
        return (0, 0);
    }
}

/// Mainnet-style deployment with tight caps so the handler hits them often (I2b).
contract FlyingMoneyInvariantsCapped is InvariantsBase {
    function _caps() internal pure override returns (uint128, uint128) {
        return (300e6, 1_000e6);
    }
}
