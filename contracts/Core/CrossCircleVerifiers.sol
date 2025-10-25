// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ICrossCircleVerifiers.sol";

/**
 * @title CrossCircleVerifiers
 * @dev Pool de verificadores cross-circle para prevenir fraudes
 */
contract CrossCircleVerifiers is ICrossCircleVerifiers, Ownable {
    IERC20 public token;
    
    struct Verifier {
        uint256 stake;
        uint256 reputation;
        uint256 lastVerification;
        uint256 successfulVerifications;
        uint256 failedVerifications;
        bool isActive;
    }
    
    struct Verification {
        address[] verifiers;
        uint256 votesFor;
        uint256 votesAgainst;
        bool completed;
        uint256 deadline;
    }
    
    // Configuración
    uint256 public constant MIN_STAKE = 20 * 10**6; // 20 USDC
    uint256 public constant VERIFICATION_FEE = 1 * 10**6; // 1 USDC
    uint256 public constant RESPONSE_SLA = 36 hours;
    uint256 public constant REPUTATION_BONUS = 10;
    uint256 public constant SLASH_PERCENTAGE = 50;
    
    // Mappings
    mapping(address => Verifier) public verifiers;
    mapping(uint256 => Verification) public verifications;
    mapping(address => uint256) public cooldown;
    mapping(uint256 => mapping(address => bool)) private verifierVotes;

    address[] public activeVerifiers;
    
    constructor(address _token) {
        token = IERC20(_token);
    }
    
    function stakeAsVerifier(uint256 amount) external override {
        require(amount >= MIN_STAKE, "Stake below minimum");
        require(!verifiers[msg.sender].isActive, "Already active verifier");
        
        bool success = token.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        
        verifiers[msg.sender] = Verifier({
            stake: amount,
            reputation: 500,
            lastVerification: 0,
            successfulVerifications: 0,
            failedVerifications: 0,
            isActive: true
        });
        
        activeVerifiers.push(msg.sender);
        emit VerifierStaked(msg.sender, amount);
    }
    
    function unstakeVerifier() external override {
        Verifier storage verifier = verifiers[msg.sender];
        require(verifier.isActive, "Not an active verifier");
        require(block.timestamp > verifier.lastVerification + 1 days, "Recent verification pending");
        
        uint256 stakeAmount = verifier.stake;
        verifier.isActive = false;
        verifier.stake = 0;
        
        for (uint i = 0; i < activeVerifiers.length; i++) {
            if (activeVerifiers[i] == msg.sender) {
                activeVerifiers[i] = activeVerifiers[activeVerifiers.length - 1];
                activeVerifiers.pop();
                break;
            }
        }
        
        bool success = token.transfer(msg.sender, stakeAmount);
        require(success, "Transfer failed");
    }
    
    function assignVerifiers(
        uint256 claimId, 
        uint256 claimAmount, 
        address /* beneficiary */ 
    ) external override onlyOwner returns (address[] memory) {
        require(verifications[claimId].verifiers.length == 0, "Verifiers already assigned");
        require(activeVerifiers.length >= 2, "Not enough verifiers");
        
        uint256 numVerifiers = _getRequiredVerifiers(claimAmount);
        if (numVerifiers == 0) {
            return new address[](0);
        }
        
        address[] memory selectedVerifiers = new address[](numVerifiers);
        
        for (uint i = 0; i < numVerifiers; i++) {
            uint256 index = uint256(keccak256(abi.encodePacked(claimId, i, block.timestamp))) % activeVerifiers.length;
            address verifier = activeVerifiers[index];
            
            while (_isVerifierInList(selectedVerifiers, verifier) || cooldown[verifier] > block.timestamp) {
                index = (index + 1) % activeVerifiers.length;
                verifier = activeVerifiers[index];
            }
            
            selectedVerifiers[i] = verifier;
            cooldown[verifier] = block.timestamp + 1 days;
            
            emit VerifierAssigned(claimId, verifier);
        }
        
        verifications[claimId] = Verification({
            verifiers: selectedVerifiers,
            votesFor: 0,
            votesAgainst: 0,
            completed: false,
            deadline: block.timestamp + RESPONSE_SLA
        });
        
        return selectedVerifiers;
    }
    
    function submitVerification(uint256 claimId, bool approved) external override {
        Verification storage verification = verifications[claimId];
        require(!verification.completed, "Verification already completed");
        require(block.timestamp <= verification.deadline, "Verification deadline passed");
        require(_isVerifierAssigned(claimId, msg.sender), "Not assigned to this claim");
        require(!verifierVotes[claimId][msg.sender], "Already voted");
        
        if (approved) {
            verification.votesFor++;
        } else {
            verification.votesAgainst++;
        }
        
        verifierVotes[claimId][msg.sender] = true;
        
        Verifier storage verifier = verifiers[msg.sender];
        verifier.lastVerification = block.timestamp;
        
        bool success = token.transfer(msg.sender, VERIFICATION_FEE);
        require(success, "Fee transfer failed");
        
        if (verification.votesFor + verification.votesAgainst == verification.verifiers.length) {
            verification.completed = true;
            bool finalApproval = verification.votesFor > verification.votesAgainst;
            
            for (uint i = 0; i < verification.verifiers.length; i++) {
                address v = verification.verifiers[i];
                bool votedFor = verifierVotes[claimId][v];
                
                if ((finalApproval && votedFor) || (!finalApproval && !votedFor)) {
                    verifiers[v].reputation += REPUTATION_BONUS;
                    verifiers[v].successfulVerifications++;
                } else {
                    verifiers[v].failedVerifications++;
                }
            }
            
            emit VerificationCompleted(claimId, finalApproval);
        }
    }
    
    function slashVerifier(address verifier, uint256 /* claimId */) external onlyOwner { 
        Verifier storage v = verifiers[verifier];
        require(v.isActive, "Verifier not active");
        
        uint256 slashAmount = (v.stake * SLASH_PERCENTAGE) / 100;
        v.stake -= slashAmount;
        v.reputation = v.reputation > 100 ? v.reputation - 100 : 0;
        
        emit VerifierSlashed(verifier, slashAmount);
    }
    
    function hasExternalVerification(uint256 claimId) external view override returns (bool) {
        Verification storage verification = verifications[claimId];
        return verification.completed && verification.votesFor > verification.votesAgainst;
    }
    
    //  FUNCIONES INTERNAS 
    
    function _getRequiredVerifiers(uint256 claimAmount) internal pure returns (uint256 requiredVerifiers) { // ← CORREGIDO: variable nombrada
        if (claimAmount <= 100 * 10**6) {
            requiredVerifiers = 0; // ≤ 100 USDC - solo miembros del circulo 
        } else if (claimAmount <= 500 * 10**6) {
            requiredVerifiers = 1; // 101-500 USDC - 1 externo
        } else if (claimAmount > 500 * 10**6) {
            requiredVerifiers = 2; // > 500 USDC - 2 externos
        }
        
        return requiredVerifiers; 
    }
    
    function _isVerifierInList(address[] memory list, address verifier) internal pure returns (bool) {
        for (uint i = 0; i < list.length; i++) {
            if (list[i] == verifier) return true;
        }
        return false;
    }
    
    function _isVerifierAssigned(uint256 claimId, address verifier) internal view returns (bool) {
        address[] memory assigned = verifications[claimId].verifiers;
        for (uint i = 0; i < assigned.length; i++) {
            if (assigned[i] == verifier) return true;
        }
        return false;
    }
    
    // Getters
    function getVerifierStake(address verifier) external view override returns (uint256) {
        return verifiers[verifier].stake;
    }
    
    function getVerifierReputation(address verifier) external view override returns (uint256) {
        return verifiers[verifier].reputation;
    }
    
    function getActiveVerifiersCount() external view override returns (uint256) {
        return activeVerifiers.length;
    }
}