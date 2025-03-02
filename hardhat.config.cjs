require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

const INFURA_PROJECT_ID = process.env.VITE_INFURA_PROJECT_ID;
const DEPLOYER_PRIVATE_KEY = process.env.VITE_PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [DEPLOYER_PRIVATE_KEY]
    }
  },
  paths: {
    sources: "./src/contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./src/artifacts"
  }
};
