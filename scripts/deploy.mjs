import { ethers } from "hardhat";

async function main() {
  console.log("Deploying OPECHO token...");

  // Get the contract factory
  const OPECHO = await ethers.getContractFactory("OPECHO");
  
  // Generate addresses for liquidatable and trading
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from address:", deployer.address);

  // For testing, we'll create new wallets for liquidatable and trading
  const liquidatableWallet = ethers.Wallet.createRandom();
  const tradingWallet = ethers.Wallet.createRandom();

  console.log("Liquidatable address:", liquidatableWallet.address);
  console.log("Trading address:", tradingWallet.address);
  
  // Deploy the contract with the addresses
  const opecho = await OPECHO.deploy(liquidatableWallet.address, tradingWallet.address);
  await opecho.deployed();

  console.log("OPECHO token deployed to:", opecho.address);
  console.log("Transaction hash:", opecho.deployTransaction.hash);

  console.log("\nToken distribution:");
  console.log("- Deployer (70%):", deployer.address);
  console.log("- Liquidatable (10%):", liquidatableWallet.address);
  console.log("- Trading (20%):", tradingWallet.address);
}

// Handle errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 