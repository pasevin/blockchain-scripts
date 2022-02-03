import { ethers, network } from "hardhat";
import * as fs from "fs";
import { parse } from "csv";
import { isAddress } from "@ethersproject/address";
import { pipeline } from "stream/promises";
import {
  BigNumber,
  Contract,
  ContractReceipt,
  ContractTransaction,
  utils,
} from "ethers";
import { getBalancesConfig } from "./config/config";

async function main() {
  const [sender] = await ethers.getSigners();
  const networkName = network.name;
  if (
    networkName === "localhost" ||
    networkName === "testnet" ||
    networkName === "mainnet"
  ) {
    const conf = getBalancesConfig[networkName];
    const tokens: Contract[] = [];

    // Get all the token contracts
    for (let i = 0; i < conf.tokenAddresses.length; i++) {
      const addr = conf.tokenAddresses[i];
      const token = await ethers.getContractAt(conf.tokenABIs[i], addr);
      tokens.push(token);
    }

    // Path to the CSV files.
    const readPath = __dirname + "/csv/input/addresses.csv";
    const now = new Date();
    const timeStamp = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}-${now.getUTCSeconds()}`;
    const writePathBalances = `${__dirname}/csv/output/${timeStamp}_balances.csv`;
    const writePathSkip = `${__dirname}/csv/output/${timeStamp}_skipped.csv`;

    // Read/write the CSV file.
    const readFileStream = fs.createReadStream(readPath);
    const writeBalancesStream = fs.createWriteStream(writePathBalances);
    const writeSkipsStream = fs.createWriteStream(writePathSkip);
    // Parse the CSV file.
    const parser = parse({
      delimiter: ",",
    });

    // Create a pipeline to read the CSV file, parse it, and write the results.
    const promise = pipeline(readFileStream, parser);

    // Keeps track of the records that have successfully returned a balance.
    const balances: string[][] = [];
    // Keeps track of the records that have been skipped for some reason.
    const skipped: string[][] = [];

    // Iterate over the CSV file.
    for await (const record of parser) {
      const targetAddr = record[0];

      console.log("Processing: ", record);
      if (record.length == 1) {
        if (isAddress(targetAddr)) {
          // Can proceed with the requests for each token...
          const tokenBalances: string[] = [];
          for (let i = 0; i < tokens.length; i++) {
            try {
              const balance = await tokens[i].balanceOf(targetAddr);
              const frmUnit = utils.formatUnits(balance, conf.tokenDecimals[i]);
              tokenBalances.push(frmUnit);
            } catch (e) {
              console.log("Failed to get balance: ", e);
            }
          }
          // Check if successfully retrieved all balances for the targetAddress.
          if (tokenBalances.length == tokens.length) {
            console.log("Successfully retrieved all balances! ");
            console.log(tokenBalances);
            writeBalancesStream.write(
              `${targetAddr},${tokenBalances.join()}\n`
            );
            balances.push(record);
          } else {
            console.log("[SKIP]: Failed to get all balances for: ", targetAddr);
            writeSkipsStream.write(`${targetAddr}\n`);
            skipped.push(record);
          }
        } else {
          console.log("Skipping invalid address: ", targetAddr);
          writeSkipsStream.write(`${targetAddr}\n`);
          skipped.push(record);
        }
      } else {
        console.log("Skipping invalid record: ", record);
        writeSkipsStream.write(`${targetAddr}\n`);
        skipped.push(record);
      }
    }

    // End all streams
    writeBalancesStream.end();
    writeSkipsStream.end();
    parser.end();

    await promise;

    console.log("\nRetrieved ----------------------------------\n\n", balances);
    console.log("\nSkiped --------------------------------------\n\n", skipped);
  } else {
    const message = `network=${networkName} message='Unsupported network'`;
    console.log(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
