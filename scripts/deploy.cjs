const hre = require("hardhat");
const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("Deploying OPECHO token...");

  // Get the contract factory
  const OPECHO = await hre.ethers.getContractFactory("OPECHO");
  
  // Get the deployer's address
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from address:", deployer.address);

  // Create addresses for development and trading using environment variables
  if (!process.env.DEVELOPMENT_PRIVATE_KEY || !process.env.TRADING_PRIVATE_KEY) {
    throw new Error("Missing DEVELOPMENT_PRIVATE_KEY or TRADING_PRIVATE_KEY in environment variables");
  }

  const developmentWallet = new hre.ethers.Wallet(process.env.DEVELOPMENT_PRIVATE_KEY);
  const tradingWallet = new hre.ethers.Wallet(process.env.TRADING_PRIVATE_KEY);

  console.log("\nToken Distribution Addresses:");
  console.log("Development (10%):", developmentWallet.address);
  console.log("Trading (20%):", tradingWallet.address);
  
  // Deploy the contract
  console.log("\nDeploying contract...");
  const opecho = await OPECHO.deploy(developmentWallet.address, tradingWallet.address);
  
  console.log("Waiting for deployment...");
  await opecho.waitForDeployment();
  
  const deployedAddress = await opecho.getAddress();
  console.log("\nOPECHO token deployed to:", deployedAddress);

  console.log("\nToken distribution:");
  console.log("- Rewards Pool (70%):", deployedAddress);  // Contract holds rewards
  console.log("- Development (10%):", developmentWallet.address);
  console.log("- Trading (20%):", tradingWallet.address);

  // Verify initial balances and contract state
  const [
    rewardsPool,
    devBalance,
    tradingBalance,
    totalSupply,
    rewardsDistributed,
    isPaused
  ] = await Promise.all([
    opecho.getRewardsPoolBalance(),
    opecho.balanceOf(developmentWallet.address),
    opecho.balanceOf(tradingWallet.address),
    opecho.totalSupply(),
    opecho.rewardsDistributed(),
    opecho.paused()
  ]);

  console.log("\nInitial Contract State:");
  console.log("- Total Supply:", ethers.formatEther(totalSupply), "OPECHO");
  console.log("- Rewards Pool:", ethers.formatEther(rewardsPool), "OPECHO");
  console.log("- Development Balance:", ethers.formatEther(devBalance), "OPECHO");
  console.log("- Trading Balance:", ethers.formatEther(tradingBalance), "OPECHO");
  console.log("- Rewards Distributed:", ethers.formatEther(rewardsDistributed), "OPECHO");
  console.log("- Contract Paused:", isPaused);

  // Calculate reward metrics
  const rewardAmount = ethers.parseEther("5"); // 5 OPECHO per reward
  const maxRewards = ethers.parseEther("70000000"); // 70M OPECHO
  const possibleRewards = maxRewards / rewardAmount;

  console.log("\nReward Metrics:");
  console.log("- Reward Amount:", ethers.formatEther(rewardAmount), "OPECHO per response");
  console.log("- Maximum Total Rewards:", ethers.formatEther(maxRewards), "OPECHO");
  console.log("- Possible Number of Rewards:", possibleRewards.toString());
  
  console.log("\nIMPORTANT NOTES:");
  console.log("1. The rewards pool is held by the contract itself");
  console.log("2. Only the contract owner can distribute rewards");
  console.log("3. Each response earns 5 OPECHO tokens");
  console.log("4. Rewards have a 1-hour cooldown period per user");
  console.log("5. The contract can be paused in case of emergency");
  console.log("6. The rewards pool has a maximum cap of 70M OPECHO");

  // Verify contract ownership
  const owner = await opecho.owner();
  console.log("\nContract Owner:", owner);
  if (owner !== deployer.address) {
    console.warn("WARNING: Contract owner is not the deployer!");
  }

  console.log("\nDeployment complete! 🎉");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 