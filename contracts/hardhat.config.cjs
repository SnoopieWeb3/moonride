require("@nomiclabs/hardhat-waffle");
require("@nomicfoundation/hardhat-verify");

require('dotenv').config();

const privateKey = process.env.PRIVATE_KEY;

module.exports = {
  solidity: {
    compilers: [
      {
        version: `0.8.20`,
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 100
          },
          evmVersion: `london`,
        }
      },
    ],
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  networks: {
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: [privateKey],
    },
    mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [privateKey],
    },
  },
  sourcify: {
    enabled: true
  },
  paths: {
    sources: "./src"
  },
};