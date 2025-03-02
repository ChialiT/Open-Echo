// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title OPECHO Token
 * @dev Implementation of the OPECHO token with fixed supply and reward distribution
 * Total Supply: 100M OPECHO
 * Distribution:
 * - 70% (70M) for user rewards
 * - 10% (10M) for development
 * - 20% (20M) for trading
 */
contract OPECHO is ERC20, Ownable, Pausable {
    // Token distribution constants
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * (10 ** 18); // 100 million tokens
    uint256 public constant REWARD_AMOUNT = 5 * (10 ** 18); // 5 tokens per reward
    uint256 public constant MAX_REWARDS = 70_000_000 * (10 ** 18); // 70% of supply

    // Distribution addresses
    address public immutable rewardsPool;    // 70% for user rewards
    address public immutable development;     // 10% for development
    address public immutable trading;         // 20% for trading

    // Reward tracking
    uint256 public rewardsDistributed;       // Track total rewards given
    mapping(address => uint256) public userRewards; // Track rewards per user
    uint256 public lastRewardTimestamp;      // Last reward timestamp
    uint256 public constant REWARD_COOLDOWN = 1 hours; // Cooldown between rewards for same user

    // Events
    event RewardDistributed(address indexed user, uint256 amount, uint256 timestamp);
    event InsufficientRewardsPool(uint256 remaining);
    event RewardCooldownUpdated(uint256 newCooldown);

    /**
     * @dev Constructor to initialize the OPECHO token
     * @param _development Address to receive development tokens
     * @param _trading Address to receive trading tokens
     */
    constructor(address _development, address _trading) 
        ERC20("Open Echo", "OPECHO")
        Ownable(msg.sender)
        Pausable()
    {
        require(_development != address(0), "Invalid development address");
        require(_trading != address(0), "Invalid trading address");
        
        rewardsPool = address(this);  // Contract holds rewards
        development = _development;    // Development wallet
        trading = _trading;           // Trading allocation wallet

        // Mint initial supply with specific allocations
        _mint(rewardsPool, 70_000_000 * (10 ** 18));  // 70% for rewards
        _mint(development, 10_000_000 * (10 ** 18));   // 10% for development
        _mint(trading, 20_000_000 * (10 ** 18));       // 20% for trading

        rewardsDistributed = 0;
        lastRewardTimestamp = block.timestamp;
    }

    /**
     * @dev Reward a user with OPECHO tokens
     * @param user Address of the user to reward
     */
    function rewardUser(address user) external onlyOwner whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(rewardsDistributed + REWARD_AMOUNT <= MAX_REWARDS, "Rewards pool depleted");
        require(block.timestamp >= userRewards[user] + REWARD_COOLDOWN, "Reward cooldown active");
        
        uint256 poolBalance = balanceOf(rewardsPool);
        require(poolBalance >= REWARD_AMOUNT, "Insufficient rewards in pool");

        // Transfer reward from pool to user
        _transfer(rewardsPool, user, REWARD_AMOUNT);
        rewardsDistributed += REWARD_AMOUNT;
        userRewards[user] = block.timestamp;
        lastRewardTimestamp = block.timestamp;

        emit RewardDistributed(user, REWARD_AMOUNT, block.timestamp);

        // Emit warning when pool is running low (less than 1000 rewards left)
        if (poolBalance - REWARD_AMOUNT < REWARD_AMOUNT * 1000) {
            emit InsufficientRewardsPool(poolBalance - REWARD_AMOUNT);
        }
    }

    /**
     * @dev Get the current balance of the rewards pool
     */
    function getRewardsPoolBalance() public view returns (uint256) {
        return balanceOf(rewardsPool);
    }

    /**
     * @dev Get the remaining rewards that can be distributed
     */
    function getRemainingRewards() public view returns (uint256) {
        return MAX_REWARDS - rewardsDistributed;
    }

    /**
     * @dev Check if a user is eligible for a reward
     * @param user Address of the user to check
     */
    function isEligibleForReward(address user) public view returns (bool) {
        return block.timestamp >= userRewards[user] + REWARD_COOLDOWN;
    }

    /**
     * @dev Get time remaining until user is eligible for next reward
     * @param user Address of the user to check
     */
    function getTimeUntilNextReward(address user) public view returns (uint256) {
        uint256 nextEligibleTime = userRewards[user] + REWARD_COOLDOWN;
        if (block.timestamp >= nextEligibleTime) return 0;
        return nextEligibleTime - block.timestamp;
    }

    /**
     * @dev Pause token rewards (emergency only)
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token rewards
     */
    function unpause() public onlyOwner {
        _unpause();
    }
} 