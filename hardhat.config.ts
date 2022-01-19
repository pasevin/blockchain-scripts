import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts:
        process.env.SENDER001_PRIVATE_KEY !== undefined
          ? [process.env.SENDER001_PRIVATE_KEY]
          : [],
      forking: {
        url: process.env.MORALIS_BSC_MAINNET_ARCHIVE_URL || "",
        blockNumber: parseInt(process.env.MORALIS_BSC_TESTNET_BLOCK || "0"),
      },
    },
    testnet: {
      url: process.env.MORALIS_BSC_TESTNET_ARCHIVE_URL || "",
      chainId: 97,
      gasPrice: 20000000000,
      accounts:
        process.env.SENDER001_PRIVATE_KEY !== undefined
          ? [process.env.SENDER001_PRIVATE_KEY]
          : [],
    },
    mainnet: {
      url: process.env.MORALIS_BSC_MAINNET_URL || "",
      chainId: 56,
      gasPrice: 20000000000,
      accounts:
        process.env.SENDER001_PRIVATE_KEY !== undefined
          ? [process.env.SENDER001_PRIVATE_KEY]
          : [],
    },
    hardhat: {
      mining: {
        auto: true,
      },
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.MNEMONIC !== undefined
          ? { mnemonic: process.env.MNEMONIC }
          : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 100000,
  },
  gasReporter: {
    enabled: Boolean(process.env.REPORT_GAS),
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
