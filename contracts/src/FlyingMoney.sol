// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Flying Money (飛錢) — sealed spending certificates
/// @notice A funder locks this deployment's USDC for ONE payee, spendable by ONE secp256k1 spender key,
///         until expiry. The spender signs cumulative Notes off-chain; anyone may redeem the latest Note,
///         paying the payee. After expiry the funder reclaims the unredeemed remainder.
contract FlyingMoney is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Certificate {
        address funder;
        address payee;
        address spender;     // secp256k1 key address; verified with ECDSA only (no ERC-1271)
        uint128 faceValue;
        uint128 redeemed;
        uint64  expiresAt;
        bool    closed;
    }

    bytes32 public constant NOTE_TYPEHASH =
        keccak256("Note(bytes32 certificateId,uint256 cumulative,bytes32 memo)");
    uint64 public constant MIN_LIFETIME = 1 hours;
    uint64 public constant MAX_LIFETIME = 365 days;

    // _tryRedeem status codes (also emitted in NoteSkipped)
    uint8 private constant S_OK = 0;
    uint8 private constant S_UNKNOWN = 1;
    uint8 private constant S_CLOSED = 2;
    uint8 private constant S_EXPIRED = 3;
    uint8 private constant S_EXCEEDS = 4;
    uint8 private constant S_NOTHING = 5;
    uint8 private constant S_BAD_SIG = 6;

    /// @notice The only settlement token of this deployment (the chain's Circle USDC).
    IERC20 public immutable token;
    /// @notice Per-certificate ceiling on faceValue (0 = unlimited).
    uint128 public immutable maxFaceValue;
    /// @notice Deployment-wide ceiling on totalOutstanding (0 = unlimited).
    uint128 public immutable maxTotalOutstanding;
    /// @notice Σ over open certificates of (faceValue − redeemed).
    uint256 public totalOutstanding;

    mapping(bytes32 => Certificate) private _certificates;
    mapping(address => uint256) public funderNonce;

    event CertificateIssued(bytes32 indexed id, address indexed funder, address indexed payee,
        address spender, uint256 faceValue, uint64 expiresAt);
    event CertificateToppedUp(bytes32 indexed id, uint256 amount, uint256 newFaceValue);
    event CertificateExtended(bytes32 indexed id, uint64 newExpiresAt);
    event NoteRedeemed(bytes32 indexed id, uint256 cumulative, uint256 paid, bytes32 memo, address indexed redeemer);
    event NoteSkipped(bytes32 indexed id, uint256 cumulative, uint8 reason);
    event CertificateReclaimed(bytes32 indexed id, uint256 refunded);

    error InvalidParams();
    error UnknownCertificate();
    error NotFunder();
    error Expired();
    error NotExpired();
    error Closed();
    error ExceedsFaceValue();
    error ExceedsCap();
    error InvalidSignature();
    error NothingToRedeem();
    error UnsupportedToken();

    constructor(IERC20 token_, uint128 maxFaceValue_, uint128 maxTotalOutstanding_) EIP712("FlyingMoney", "1") {
        if (address(token_).code.length == 0) revert InvalidParams();
        token = token_;
        maxFaceValue = maxFaceValue_;
        maxTotalOutstanding = maxTotalOutstanding_;
    }

    // ───────── Funder ─────────

    function issue(address payee, address spender, uint128 faceValue, uint64 expiresAt)
        external nonReentrant returns (bytes32 id)
    {
        if (payee == address(0) || payee == address(this) || spender == address(0) || faceValue == 0)
            revert InvalidParams();
        // Key isolation is structural: the spender key can never be the funder or the payee.
        if (spender == msg.sender || spender == payee) revert InvalidParams();
        if (expiresAt < block.timestamp + MIN_LIFETIME || expiresAt > block.timestamp + MAX_LIFETIME)
            revert InvalidParams();
        if (maxFaceValue != 0 && faceValue > maxFaceValue) revert ExceedsCap();
        _addOutstanding(faceValue);

        id = keccak256(abi.encode(block.chainid, address(this), msg.sender, funderNonce[msg.sender]++));
        _pullExact(faceValue);
        _certificates[id] = Certificate(msg.sender, payee, spender, faceValue, 0, expiresAt, false);
        emit CertificateIssued(id, msg.sender, payee, spender, faceValue, expiresAt);
    }

    function topUp(bytes32 id, uint128 amount) external nonReentrant {
        Certificate storage c = _open(id);
        if (msg.sender != c.funder) revert NotFunder();
        if (block.timestamp > c.expiresAt) revert Expired();
        if (amount == 0) revert InvalidParams();
        uint128 newFace = c.faceValue + amount; // checked
        if (maxFaceValue != 0 && newFace > maxFaceValue) revert ExceedsCap();
        _addOutstanding(amount);
        _pullExact(amount);
        c.faceValue = newFace;
        emit CertificateToppedUp(id, amount, newFace);
    }

    function extend(bytes32 id, uint64 newExpiresAt) external {
        Certificate storage c = _open(id);
        if (msg.sender != c.funder) revert NotFunder();
        if (block.timestamp > c.expiresAt) revert Expired();
        if (newExpiresAt <= c.expiresAt || newExpiresAt > block.timestamp + MAX_LIFETIME) revert InvalidParams();
        c.expiresAt = newExpiresAt;
        emit CertificateExtended(id, newExpiresAt);
    }

    function reclaim(bytes32 id) external nonReentrant returns (uint256 refunded) {
        Certificate storage c = _open(id);
        if (msg.sender != c.funder) revert NotFunder();
        if (block.timestamp <= c.expiresAt) revert NotExpired();
        c.closed = true;
        refunded = uint256(c.faceValue) - c.redeemed;
        totalOutstanding -= refunded;
        if (refunded > 0) token.safeTransfer(c.funder, refunded);
        emit CertificateReclaimed(id, refunded);
    }

    // ───────── Anyone (for the payee) ─────────

    function redeem(bytes32 id, uint256 cumulative, bytes32 memo, bytes calldata signature)
        external nonReentrant returns (uint256 paid)
    {
        uint8 status;
        (paid, status) = _tryRedeem(id, cumulative, memo, signature);
        if (status == S_UNKNOWN) revert UnknownCertificate();
        if (status == S_CLOSED) revert Closed();
        if (status == S_EXPIRED) revert Expired();
        if (status == S_EXCEEDS) revert ExceedsFaceValue();
        if (status == S_NOTHING) revert NothingToRedeem();
        if (status == S_BAD_SIG) revert InvalidSignature();
    }

    struct SignedNote { bytes32 certificateId; uint256 cumulative; bytes32 memo; bytes signature; }

    /// @notice Batch redemption. Never reverts because of one bad or stale note: it skips it and emits
    ///         NoteSkipped. (A token-level transfer failure, e.g. a blocklisted payee, still reverts.)
    function redeemMany(SignedNote[] calldata notes) external nonReentrant returns (uint256 totalPaid) {
        for (uint256 i; i < notes.length; ++i) {
            (uint256 paid, uint8 status) =
                _tryRedeem(notes[i].certificateId, notes[i].cumulative, notes[i].memo, notes[i].signature);
            if (status != S_OK) emit NoteSkipped(notes[i].certificateId, notes[i].cumulative, status);
            totalPaid += paid;
        }
    }

    function _tryRedeem(bytes32 id, uint256 cumulative, bytes32 memo, bytes calldata signature)
        private returns (uint256 paid, uint8 status)
    {
        Certificate storage c = _certificates[id];
        if (c.funder == address(0)) return (0, S_UNKNOWN);
        if (c.closed) return (0, S_CLOSED);
        if (block.timestamp > c.expiresAt) return (0, S_EXPIRED);
        if (cumulative > c.faceValue) return (0, S_EXCEEDS);
        if (cumulative <= c.redeemed) return (0, S_NOTHING); // idempotent: already covered
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(noteDigest(id, cumulative, memo), signature);
        if (err != ECDSA.RecoverError.NoError || recovered != c.spender) return (0, S_BAD_SIG);
        paid = cumulative - c.redeemed;
        c.redeemed = uint128(cumulative);
        totalOutstanding -= paid;
        token.safeTransfer(c.payee, paid);
        emit NoteRedeemed(id, cumulative, paid, memo, msg.sender);
        // status == S_OK (0)
    }

    // ───────── Views ─────────

    function getCertificate(bytes32 id) external view returns (Certificate memory) {
        return _certificates[id];
    }

    function noteDigest(bytes32 id, uint256 cumulative, bytes32 memo) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(NOTE_TYPEHASH, id, cumulative, memo)));
    }

    // ───────── Internal ─────────

    function _open(bytes32 id) private view returns (Certificate storage c) {
        c = _certificates[id];
        if (c.funder == address(0)) revert UnknownCertificate();
        if (c.closed) revert Closed();
    }

    function _addOutstanding(uint256 amount) private {
        uint256 next = totalOutstanding + amount;
        if (maxTotalOutstanding != 0 && next > maxTotalOutstanding) revert ExceedsCap();
        totalOutstanding = next;
    }

    function _pullExact(uint256 amount) private {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert UnsupportedToken();
    }
}
