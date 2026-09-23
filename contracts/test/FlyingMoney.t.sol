// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FlyingMoney} from "../src/FlyingMoney.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {TestUSDC, FeeOnTransferToken, ReentrantToken, GarbageAccepting1271} from "./mocks/Tokens.sol";

abstract contract FlyingMoneyBase is Test {
    // secp256k1 group order, for the malleability test
    uint256 internal constant N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    TestUSDC internal usdc;
    FlyingMoney internal fm;

    address internal funder = makeAddr("funder");
    address internal payee = makeAddr("payee");
    address internal stranger = makeAddr("stranger");
    uint256 internal spenderPk = 0xA11CE;
    address internal spender;
    uint256 internal funderPk;
    uint256 internal payeePk;

    function setUp() public virtual {
        spender = vm.addr(spenderPk);
        (funder, funderPk) = makeAddrAndKey("funder");
        (payee, payeePk) = makeAddrAndKey("payee");
        usdc = new TestUSDC();
        fm = new FlyingMoney(IERC20(address(usdc)), 0, 0);
        _fund(funder, fm, 1_000_000e6);
    }

    function _fund(address who, FlyingMoney target, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(target), type(uint256).max);
    }

    function _issue(uint128 face, uint64 life) internal returns (bytes32) {
        vm.prank(funder);
        return fm.issue(payee, spender, face, uint64(block.timestamp) + life);
    }

    function _sign(FlyingMoney target, uint256 pk, bytes32 id, uint256 cum, bytes32 memo)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, target.noteDigest(id, cum, memo));
        return abi.encodePacked(r, s, v);
    }

    function _sign(uint256 pk, bytes32 id, uint256 cum, bytes32 memo) internal view returns (bytes memory) {
        return _sign(fm, pk, id, cum, memo);
    }
}

contract FlyingMoneyTest is FlyingMoneyBase {
    event CertificateIssued(
        bytes32 indexed id,
        address indexed funder,
        address indexed payee,
        address spender,
        uint256 faceValue,
        uint64 expiresAt
    );
    event CertificateToppedUp(bytes32 indexed id, uint256 amount, uint256 newFaceValue);
    event CertificateExtended(bytes32 indexed id, uint64 newExpiresAt);
    event NoteRedeemed(bytes32 indexed id, uint256 cumulative, uint256 paid, bytes32 memo, address indexed redeemer);
    event NoteSkipped(bytes32 indexed id, uint256 cumulative, uint8 reason);
    event CertificateReclaimed(bytes32 indexed id, uint256 refunded);

    // ───────── 1. issue ─────────

    function test_01_issue_storesFields_pullsExact_incrementsNonce_emits() public {
        uint64 exp = uint64(block.timestamp + 7 days);
        bytes32 expectedId = keccak256(abi.encode(block.chainid, address(fm), funder, uint256(0)));
        uint256 before = usdc.balanceOf(funder);

        vm.expectEmit(address(fm));
        emit CertificateIssued(expectedId, funder, payee, spender, 5e6, exp);
        vm.prank(funder);
        bytes32 id = fm.issue(payee, spender, 5e6, exp);

        assertEq(id, expectedId, "id = keccak256(abi.encode(chainId, contract, funder, nonce))");
        FlyingMoney.Certificate memory c = fm.getCertificate(id);
        assertEq(c.funder, funder);
        assertEq(c.payee, payee);
        assertEq(c.spender, spender);
        assertEq(c.faceValue, 5e6);
        assertEq(c.redeemed, 0);
        assertEq(c.expiresAt, exp);
        assertFalse(c.closed);
        assertEq(before - usdc.balanceOf(funder), 5e6);
        assertEq(usdc.balanceOf(address(fm)), 5e6);
        assertEq(fm.funderNonce(funder), 1);
        assertEq(fm.totalOutstanding(), 5e6);

        bytes32 id2 = _issue(1e6, 1 days);
        assertEq(id2, keccak256(abi.encode(block.chainid, address(fm), funder, uint256(1))));
        assertEq(fm.funderNonce(funder), 2);
    }

    // ───────── 2 / 4c / 4d. issue rejects ─────────

    function test_02_issue_rejectsBadParams() public {
        uint64 ok = uint64(block.timestamp + 1 days);
        vm.startPrank(funder);
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.issue(address(0), spender, 1e6, ok);
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.issue(payee, address(0), 1e6, ok);
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.issue(payee, spender, 0, ok);
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.issue(payee, spender, 1e6, uint64(block.timestamp + 1 hours - 1));
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.issue(payee, spender, 1e6, uint64(block.timestamp + 365 days + 1));
        // boundaries are allowed
        fm.issue(payee, spender, 1e6, uint64(block.timestamp + 1 hours));
        fm.issue(payee, spender, 1e6, uint64(block.timestamp + 365 days));
        vm.stopPrank();
    }

    function test_04c_issue_rejectsPayeeIsContract() public {
        vm.prank(funder);
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.issue(address(fm), spender, 1e6, uint64(block.timestamp + 1 days));
    }

    function test_04d_issue_rejectsSpenderIsFunderOrPayee() public {
        vm.startPrank(funder);
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.issue(payee, funder, 1e6, uint64(block.timestamp + 1 days));
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.issue(payee, payee, 1e6, uint64(block.timestamp + 1 days));
        vm.stopPrank();
    }

    function test_02b_feeOnTransferToken_revertsUnsupportedToken() public {
        FeeOnTransferToken fot = new FeeOnTransferToken();
        FlyingMoney fm2 = new FlyingMoney(IERC20(address(fot)), 0, 0);
        fot.mint(funder, 10e6);
        vm.startPrank(funder);
        fot.approve(address(fm2), type(uint256).max);
        vm.expectRevert(FlyingMoney.UnsupportedToken.selector);
        fm2.issue(payee, spender, 1e6, uint64(block.timestamp + 1 days));
        vm.stopPrank();
    }

    // ───────── 3. redeem pays the payee ─────────

    function test_03_redeem_byStranger_paysPayee() public {
        bytes32 id = _issue(5e6, 1 days);
        bytes32 memo = keccak256("req-1");
        bytes memory sig = _sign(spenderPk, id, 370_000, memo);

        vm.expectEmit(address(fm));
        emit NoteRedeemed(id, 370_000, 370_000, memo, stranger);
        vm.prank(stranger);
        uint256 paid = fm.redeem(id, 370_000, memo, sig);

        assertEq(paid, 370_000);
        assertEq(usdc.balanceOf(payee), 370_000);
        assertEq(usdc.balanceOf(stranger), 0);
        assertEq(fm.getCertificate(id).redeemed, 370_000);
        assertEq(fm.totalOutstanding(), 5e6 - 370_000);

        // a higher note pays exactly cumulative − redeemed
        vm.prank(stranger);
        paid = fm.redeem(id, 1e6, keccak256("req-2"), _sign(spenderPk, id, 1e6, keccak256("req-2")));
        assertEq(paid, 1e6 - 370_000);
        assertEq(usdc.balanceOf(payee), 1e6);
    }

    // ───────── 4. older / equal note ─────────

    function test_04_redeem_olderOrEqual_nothingToRedeem_andBatchSkips5() public {
        bytes32 id = _issue(5e6, 1 days);
        fm.redeem(id, 2e6, bytes32(0), _sign(spenderPk, id, 2e6, bytes32(0)));

        bytes memory eq = _sign(spenderPk, id, 2e6, bytes32(0));
        vm.expectRevert(FlyingMoney.NothingToRedeem.selector);
        fm.redeem(id, 2e6, bytes32(0), eq);

        bytes memory older = _sign(spenderPk, id, 1e6, bytes32(uint256(1)));
        vm.expectRevert(FlyingMoney.NothingToRedeem.selector);
        fm.redeem(id, 1e6, bytes32(uint256(1)), older);

        FlyingMoney.SignedNote[] memory notes = new FlyingMoney.SignedNote[](1);
        notes[0] = FlyingMoney.SignedNote(id, 1e6, bytes32(uint256(1)), older);
        vm.expectEmit(address(fm));
        emit NoteSkipped(id, 1e6, 5);
        uint256 total = fm.redeemMany(notes);
        assertEq(total, 0);
        assertEq(usdc.balanceOf(payee), 2e6);
    }

    // ───────── 4b. redeemMany mixed batch ─────────

    function test_04b_redeemMany_mixedBatch_paysValidOnly_neverReverts() public {
        bytes32 shortA = _issue(3e6, 1 hours); // will be reclaimed → closed (2)
        bytes32 shortB = _issue(3e6, 1 hours); // will be expired (3)
        bytes32 valid = _issue(5e6, 30 days);
        vm.warp(block.timestamp + 2 hours);
        vm.prank(funder);
        fm.reclaim(shortA);

        FlyingMoney.SignedNote[] memory notes = new FlyingMoney.SignedNote[](7);
        notes[0] = FlyingMoney.SignedNote(valid, 1e6, "a", _sign(spenderPk, valid, 1e6, "a"));
        notes[1] = FlyingMoney.SignedNote(
            bytes32(uint256(0xdead)), 1e6, "b", _sign(spenderPk, bytes32(uint256(0xdead)), 1e6, "b")
        );
        notes[2] = FlyingMoney.SignedNote(shortA, 1e6, "c", _sign(spenderPk, shortA, 1e6, "c"));
        notes[3] = FlyingMoney.SignedNote(shortB, 1e6, "d", _sign(spenderPk, shortB, 1e6, "d"));
        notes[4] = FlyingMoney.SignedNote(valid, 6e6, "e", _sign(spenderPk, valid, 6e6, "e"));
        notes[5] = FlyingMoney.SignedNote(valid, 2e6, "f", _sign(payeePk, valid, 2e6, "f"));
        notes[6] = FlyingMoney.SignedNote(valid, 1e6, "g", _sign(spenderPk, valid, 1e6, "g"));

        vm.recordLogs();
        uint256 total = fm.redeemMany(notes);
        assertEq(total, 1e6);
        assertEq(usdc.balanceOf(payee), 1e6);

        uint8[6] memory expected = [uint8(1), 2, 3, 4, 6, 5];
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 skipSig = keccak256("NoteSkipped(bytes32,uint256,uint8)");
        uint256 k;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] != skipSig) continue;
            (, uint8 reason) = abi.decode(logs[i].data, (uint256, uint8));
            assertEq(reason, expected[k++]);
        }
        assertEq(k, 6, "one NoteSkipped per bad note");
    }

    // ───────── 5. above face value ─────────

    function test_05_redeem_aboveFaceValue() public {
        bytes32 id = _issue(5e6, 1 days);
        bytes memory sig = _sign(spenderPk, id, 5e6 + 1, bytes32(0));
        vm.expectRevert(FlyingMoney.ExceedsFaceValue.selector);
        fm.redeem(id, 5e6 + 1, bytes32(0), sig);
        // exactly face value is fine
        fm.redeem(id, 5e6, bytes32(0), _sign(spenderPk, id, 5e6, bytes32(0)));
        assertEq(usdc.balanceOf(payee), 5e6);
    }

    // ───────── 6. wrong signer ─────────

    function test_06_redeem_wrongSigner_invalidSignature() public {
        bytes32 id = _issue(5e6, 1 days);
        uint256[3] memory pks = [funderPk, payeePk, uint256(0xBEEF)];
        for (uint256 i; i < 3; ++i) {
            bytes memory sig = _sign(pks[i], id, 1e6, bytes32(0));
            vm.expectRevert(FlyingMoney.InvalidSignature.selector);
            fm.redeem(id, 1e6, bytes32(0), sig);
        }
        // a signature for a different cumulative/memo does not transfer
        bytes memory other = _sign(spenderPk, id, 1e6, bytes32(0));
        vm.expectRevert(FlyingMoney.InvalidSignature.selector);
        fm.redeem(id, 2e6, bytes32(0), other);
        vm.expectRevert(FlyingMoney.InvalidSignature.selector);
        fm.redeem(id, 1e6, bytes32(uint256(1)), other);
        // garbage length
        vm.expectRevert(FlyingMoney.InvalidSignature.selector);
        fm.redeem(id, 1e6, bytes32(0), hex"1234");
    }

    // ───────── 7. malleability ─────────

    function test_07_highS_rejected() public {
        bytes32 id = _issue(5e6, 1 days);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(spenderPk, fm.noteDigest(id, 1e6, bytes32(0)));
        bytes32 highS = bytes32(N - uint256(s));
        uint8 flippedV = v == 27 ? 28 : 27;
        bytes memory mall = abi.encodePacked(r, highS, flippedV);
        vm.expectRevert(FlyingMoney.InvalidSignature.selector);
        fm.redeem(id, 1e6, bytes32(0), mall);
        // the canonical one works
        fm.redeem(id, 1e6, bytes32(0), abi.encodePacked(r, s, v));
    }

    // ───────── 8. domain separation ─────────

    function test_08_domainSeparation_otherChainOrContract() public {
        bytes32 id = _issue(5e6, 1 days);

        // another contract
        FlyingMoney other = new FlyingMoney(IERC20(address(usdc)), 0, 0);
        bytes memory sigOther = _sign(other, spenderPk, id, 1e6, bytes32(0));
        vm.expectRevert(FlyingMoney.InvalidSignature.selector);
        fm.redeem(id, 1e6, bytes32(0), sigOther);

        // another chain id: build the digest by hand with chainId + 1
        bytes32 domainSep = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("FlyingMoney"),
                keccak256("1"),
                block.chainid + 1,
                address(fm)
            )
        );
        bytes32 structHash = keccak256(abi.encode(fm.NOTE_TYPEHASH(), id, uint256(1e6), bytes32(0)));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(spenderPk, digest);
        vm.expectRevert(FlyingMoney.InvalidSignature.selector);
        fm.redeem(id, 1e6, bytes32(0), abi.encodePacked(r, s, v));

        // and the same construction with the real chain id equals noteDigest (EIP-712 layout sanity)
        bytes32 realSep = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("FlyingMoney"),
                keccak256("1"),
                block.chainid,
                address(fm)
            )
        );
        assertEq(keccak256(abi.encodePacked("\x19\x01", realSep, structHash)), fm.noteDigest(id, 1e6, bytes32(0)));
    }

    // ───────── 9. ECDSA-only permanence ─────────

    function _outcomes() internal returns (uint256 paidValid, bool garbageRejected, bool contractSigRejected) {
        bytes32 id = _issue(5e6, 1 days);
        paidValid = fm.redeem(id, 1e6, bytes32(0), _sign(spenderPk, id, 1e6, bytes32(0)));
        try fm.redeem(id, 2e6, bytes32(0), bytes("garbage")) {
            garbageRejected = false;
        } catch (bytes memory err) {
            garbageRejected = bytes4(err) == FlyingMoney.InvalidSignature.selector;
        }
        // an ERC-1271-shaped "signature" (empty) must also be rejected
        try fm.redeem(id, 2e6, bytes32(0), "") {
            contractSigRejected = false;
        } catch (bytes memory err) {
            contractSigRejected = bytes4(err) == FlyingMoney.InvalidSignature.selector;
        }
    }

    function test_09_ecdsaOnly_permanentUnderCodeChange() public {
        uint256 snap = vm.snapshotState();
        (uint256 p1, bool g1, bool c1) = _outcomes();
        vm.revertToState(snap);

        vm.etch(spender, address(new GarbageAccepting1271()).code);
        assertGt(spender.code.length, 0);
        (uint256 p2, bool g2, bool c2) = _outcomes();

        assertEq(p1, 1e6);
        assertTrue(g1 && c1);
        assertEq(p2, p1, "valid ECDSA notes still accepted after the spender gains code");
        assertEq(g2, g1, "garbage still rejected");
        assertEq(c2, c1);
    }

    // ───────── 10. expiry / reclaim / closed ─────────

    function test_10_expiry_reclaim_closed() public {
        bytes32 id = _issue(5e6, 1 days);
        uint64 exp = fm.getCertificate(id).expiresAt;
        fm.redeem(id, 1e6, bytes32(0), _sign(spenderPk, id, 1e6, bytes32(0)));

        vm.startPrank(funder);
        vm.expectRevert(FlyingMoney.NotExpired.selector);
        fm.reclaim(id);
        vm.warp(exp); // at expiry: redeem still allowed, reclaim not
        vm.expectRevert(FlyingMoney.NotExpired.selector);
        fm.reclaim(id);
        vm.stopPrank();
        fm.redeem(id, 2e6, bytes32(0), _sign(spenderPk, id, 2e6, bytes32(0)));

        vm.warp(uint256(exp) + 1);
        bytes memory sig3 = _sign(spenderPk, id, 3e6, bytes32(0));
        vm.expectRevert(FlyingMoney.Expired.selector);
        fm.redeem(id, 3e6, bytes32(0), sig3);

        vm.prank(stranger);
        vm.expectRevert(FlyingMoney.NotFunder.selector);
        fm.reclaim(id);

        uint256 before = usdc.balanceOf(funder);
        vm.expectEmit(address(fm));
        emit CertificateReclaimed(id, 3e6);
        vm.prank(funder);
        uint256 refunded = fm.reclaim(id);
        assertEq(refunded, 3e6);
        assertEq(usdc.balanceOf(funder) - before, 3e6);
        assertTrue(fm.getCertificate(id).closed);
        assertEq(fm.totalOutstanding(), 0);
        assertEq(usdc.balanceOf(address(fm)), 0);

        vm.expectRevert(FlyingMoney.Closed.selector);
        fm.redeem(id, 3e6, bytes32(0), sig3);
        vm.prank(funder);
        vm.expectRevert(FlyingMoney.Closed.selector);
        fm.reclaim(id);
    }

    function test_10b_reclaim_fullyRedeemed_refundsZero() public {
        bytes32 id = _issue(5e6, 1 hours);
        fm.redeem(id, 5e6, bytes32(0), _sign(spenderPk, id, 5e6, bytes32(0)));
        vm.warp(block.timestamp + 2 hours);
        vm.prank(funder);
        assertEq(fm.reclaim(id), 0);
        assertTrue(fm.getCertificate(id).closed);
    }

    function test_10c_unknownCertificate() public {
        vm.expectRevert(FlyingMoney.UnknownCertificate.selector);
        fm.redeem(bytes32(uint256(1)), 1, bytes32(0), "");
        vm.expectRevert(FlyingMoney.UnknownCertificate.selector);
        fm.reclaim(bytes32(uint256(1)));
        vm.expectRevert(FlyingMoney.UnknownCertificate.selector);
        fm.topUp(bytes32(uint256(1)), 1);
        vm.expectRevert(FlyingMoney.UnknownCertificate.selector);
        fm.extend(bytes32(uint256(1)), 1);
    }

    // ───────── 11. topUp / extend ─────────

    function test_11_topUp_extend_rules() public {
        bytes32 id = _issue(5e6, 1 days);
        uint64 exp = fm.getCertificate(id).expiresAt;

        vm.prank(stranger);
        vm.expectRevert(FlyingMoney.NotFunder.selector);
        fm.topUp(id, 1e6);
        vm.prank(stranger);
        vm.expectRevert(FlyingMoney.NotFunder.selector);
        fm.extend(id, exp + 1);

        vm.startPrank(funder);
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.topUp(id, 0);

        vm.expectEmit(address(fm));
        emit CertificateToppedUp(id, 2e6, 7e6);
        fm.topUp(id, 2e6);
        assertEq(fm.getCertificate(id).faceValue, 7e6);
        assertEq(usdc.balanceOf(address(fm)), 7e6);
        assertEq(fm.totalOutstanding(), 7e6);

        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.extend(id, exp); // must strictly increase
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.extend(id, exp - 1);
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        fm.extend(id, uint64(block.timestamp + 365 days + 1));

        vm.expectEmit(address(fm));
        emit CertificateExtended(id, exp + 1 days);
        fm.extend(id, exp + 1 days);
        assertEq(fm.getCertificate(id).expiresAt, exp + 1 days);

        vm.warp(uint256(exp) + 1 days + 1);
        vm.expectRevert(FlyingMoney.Expired.selector);
        fm.topUp(id, 1e6);
        vm.expectRevert(FlyingMoney.Expired.selector);
        fm.extend(id, uint64(block.timestamp + 1 days));
        vm.stopPrank();
    }

    // ───────── 12. reentrancy ─────────

    function test_12_reentrancy_blocked() public {
        ReentrantToken rt = new ReentrantToken();
        FlyingMoney fm2 = new FlyingMoney(IERC20(address(rt)), 0, 0);
        rt.mint(funder, 100e6);
        vm.prank(funder);
        rt.approve(address(fm2), type(uint256).max);
        vm.prank(funder);
        bytes32 id = fm2.issue(payee, spender, 10e6, uint64(block.timestamp + 1 hours));

        bytes memory n1 = _sign(fm2, spenderPk, id, 1e6, bytes32(0));
        bytes memory n2 = _sign(fm2, spenderPk, id, 2e6, bytes32(0));

        // redeem → token transfer → re-enter redeem
        rt.arm(address(fm2), abi.encodeCall(FlyingMoney.redeem, (id, 2e6, bytes32(0), n2)));
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        fm2.redeem(id, 1e6, bytes32(0), n1);

        // redeem → re-enter reclaim
        rt.arm(address(fm2), abi.encodeCall(FlyingMoney.reclaim, (id)));
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        fm2.redeem(id, 1e6, bytes32(0), n1);

        // redeemMany → re-enter redeem
        FlyingMoney.SignedNote[] memory notes = new FlyingMoney.SignedNote[](1);
        notes[0] = FlyingMoney.SignedNote(id, 1e6, bytes32(0), n1);
        rt.arm(address(fm2), abi.encodeCall(FlyingMoney.redeem, (id, 2e6, bytes32(0), n2)));
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        fm2.redeemMany(notes);

        // reclaim → re-enter reclaim
        vm.warp(block.timestamp + 2 hours);
        rt.arm(address(fm2), abi.encodeCall(FlyingMoney.reclaim, (id)));
        vm.prank(funder);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        fm2.reclaim(id);

        // state untouched by the failed attempts
        assertEq(fm2.getCertificate(id).redeemed, 0);
        assertFalse(fm2.getCertificate(id).closed);
        assertEq(rt.balanceOf(address(fm2)), 10e6);
    }

    // ───────── 13. gas snapshot ─────────

    function test_13_gas_redeem_and_redeemMany10() public {
        bytes32 id = _issue(5e6, 1 days);
        bytes memory sig = _sign(spenderPk, id, 1e6, bytes32(0));
        vm.startSnapshotGas("redeem");
        fm.redeem(id, 1e6, bytes32(0), sig);
        vm.stopSnapshotGas();

        FlyingMoney.SignedNote[] memory notes = new FlyingMoney.SignedNote[](10);
        for (uint256 i; i < 10; ++i) {
            bytes32 cid = _issue(5e6, 1 days);
            notes[i] = FlyingMoney.SignedNote(cid, 1e6, bytes32(i), _sign(spenderPk, cid, 1e6, bytes32(i)));
        }
        vm.startSnapshotGas("redeemMany10");
        uint256 total = fm.redeemMany(notes);
        vm.stopSnapshotGas();
        assertEq(total, 10e6);
    }

    // ───────── 14. caps ─────────

    function test_14_caps() public {
        FlyingMoney capped = new FlyingMoney(IERC20(address(usdc)), 100e6, 1_000e6);
        assertEq(capped.maxFaceValue(), 100e6);
        assertEq(capped.maxTotalOutstanding(), 1_000e6);
        _fund(funder, capped, 0);
        uint64 exp = uint64(block.timestamp + 1 days);

        vm.startPrank(funder);
        vm.expectRevert(FlyingMoney.ExceedsCap.selector);
        capped.issue(payee, spender, 100e6 + 1, exp);

        bytes32 a = capped.issue(payee, spender, 100e6, exp);
        vm.expectRevert(FlyingMoney.ExceedsCap.selector);
        capped.topUp(a, 1); // crosses the per-certificate cap

        bytes32 b = capped.issue(payee, spender, 10e6, exp);
        capped.issue(payee, spender, 40e6, exp);
        for (uint256 i; i < 8; ++i) {
            capped.issue(payee, spender, 100e6, exp);
        } // total 950
        assertEq(capped.totalOutstanding(), 950e6);
        vm.expectRevert(FlyingMoney.ExceedsCap.selector);
        capped.issue(payee, spender, 51e6, exp); // deployment-wide cap on issue
        vm.expectRevert(FlyingMoney.ExceedsCap.selector);
        capped.topUp(b, 51e6); // b would be 61 (under per-cert cap) but total 1,001: deployment-wide cap on topUp
        capped.topUp(b, 50e6); // exactly 1,000
        assertEq(capped.totalOutstanding(), 1_000e6);
        vm.stopPrank();

        // redeem frees deployment-wide room
        capped.redeem(a, 30e6, bytes32(0), _sign(capped, spenderPk, a, 30e6, bytes32(0)));
        assertEq(capped.totalOutstanding(), 970e6);
        vm.prank(funder);
        capped.issue(payee, spender, 30e6, exp);
        assertEq(capped.totalOutstanding(), 1_000e6);

        // reclaim frees room too
        vm.warp(block.timestamp + 2 days);
        vm.prank(funder);
        capped.reclaim(a); // refunds 70
        assertEq(capped.totalOutstanding(), 930e6);
        assertEq(usdc.balanceOf(address(capped)), capped.totalOutstanding());
    }

    function test_14_zeroMeansUnlimited() public {
        vm.startPrank(funder);
        fm.issue(payee, spender, 500_000e6, uint64(block.timestamp + 1 days));
        fm.issue(payee, spender, 400_000e6, uint64(block.timestamp + 1 days));
        vm.stopPrank();
        assertEq(fm.totalOutstanding(), 900_000e6);
    }

    // ───────── 14b. constructor / immutable token ─────────

    function test_14b_constructor_rejectsTokenWithoutCode() public {
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        new FlyingMoney(IERC20(makeAddr("eoa")), 0, 0);
        vm.expectRevert(FlyingMoney.InvalidParams.selector);
        new FlyingMoney(IERC20(address(0)), 0, 0);
    }

    function test_14b_issueHasNoTokenParam_usesImmutableToken() public {
        assertEq(address(fm.token()), address(usdc));
        assertEq(FlyingMoney.issue.selector, bytes4(keccak256("issue(address,address,uint128,uint64)")));
        // a different token held by the funder is never touched
        TestUSDC other = new TestUSDC();
        other.mint(funder, 10e6);
        vm.prank(funder);
        other.approve(address(fm), type(uint256).max);
        _issue(1e6, 1 days);
        assertEq(other.balanceOf(funder), 10e6);
    }

    function test_constants() public view {
        assertEq(fm.NOTE_TYPEHASH(), keccak256("Note(bytes32 certificateId,uint256 cumulative,bytes32 memo)"));
        assertEq(fm.MIN_LIFETIME(), 1 hours);
        assertEq(fm.MAX_LIFETIME(), 365 days);
        (, string memory name, string memory version, uint256 chainId, address vc,,) = fm.eip712Domain();
        assertEq(name, "FlyingMoney");
        assertEq(version, "1");
        assertEq(chainId, block.chainid);
        assertEq(vc, address(fm));
    }
}

contract MockUSDCTest is Test {
    function test_mockUSDC() public {
        MockUSDC m = new MockUSDC();
        assertEq(m.decimals(), 6);
        assertEq(m.name(), "Mock USD Coin");
        assertEq(m.symbol(), "mUSDC");
        address alice = makeAddr("alice");
        vm.warp(10 days);
        vm.startPrank(alice);
        m.faucet();
        assertEq(m.balanceOf(alice), 100e6);
        vm.expectRevert(MockUSDC.FaucetCooldown.selector);
        m.faucet();
        vm.warp(block.timestamp + 1 hours - 1);
        vm.expectRevert(MockUSDC.FaucetCooldown.selector);
        m.faucet();
        vm.warp(block.timestamp + 1);
        m.faucet();
        assertEq(m.balanceOf(alice), 200e6);
        vm.stopPrank();
    }
}
