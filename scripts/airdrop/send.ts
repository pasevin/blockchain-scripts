import { ethers, network } from "hardhat";
import * as fs from "fs";
import { parse } from "csv";
import { isAddress } from "@ethersproject/address";
import { pipeline } from "stream/promises";
import { BigNumber, ContractReceipt, ContractTransaction } from "ethers";
import { airdropConfig } from "./config/config";

async function main() {
  const [sender] = await ethers.getSigners();
  const networkName = network.name;
  if (
    networkName === "localhost" ||
    networkName === "testnet" ||
    networkName === "mainnet"
  ) {
    const conf = airdropConfig[networkName];

    /* -------------------------------------------------------------------------- */
    /*                                   GUARDS                                   */
    /* -------------------------------------------------------------------------- */

    // Check if the private key is set (see ethers.js signer).
    if (!process.env.SIGNER_PRIVATE_KEY) {
      throw new Error("Missing private key (signer).");
    }
    // Check if the Dehub Lottery smart contract address is set.
    if (conf.tokenAddress === ethers.constants.AddressZero) {
      throw new Error("Missing token contract address in config.");
    }

    /* -------------------------------------------------------------------------- */
    /*                                    PREP                                    */
    /* -------------------------------------------------------------------------- */

    // Bind the token smart contract address to the ABI, for a given network.
    const token = await ethers.getContractAt(conf.tokenABI, conf.tokenAddress);

    console.table([
      { Label: "Token", Info: token.address },
      { Label: "Sender", Info: sender.address },
      {
        Label: "Sender balance",
        Info: (await token.balanceOf(sender.address)).toString(),
      },
    ]);

    // Path to the CSV files.
    const readPath = __dirname + "/csv/input/recipients.csv";
    const now = new Date();
    const timeStamp = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}-${now.getUTCSeconds()}`;
    const writePathSent = `${__dirname}/csv/output/${timeStamp}_received.csv`;
    const writePathSkip = `${__dirname}/csv/output/${timeStamp}_skipped.csv`;

    // Read/write the CSV file.
    const readFileStream = fs.createReadStream(readPath);
    const writeSentStream = fs.createWriteStream(writePathSent);
    const writeSkipsStream = fs.createWriteStream(writePathSkip);
    // Parse the CSV file.
    const parser = parse({
      delimiter: ",",
    });

    // Create a pipeline to read the CSV file, parse it, and write the results.
    const promise = pipeline(readFileStream, parser);

    // Keeps track of the records that have successfully received.
    const received: string[][] = [];
    // Keeps track of the records that have been skipped for some reason.
    const skipped: string[][] = [];
    // Accumulates total amount sent
    let accumulator = BigNumber.from(0);
    let stoppedBefore: string | undefined;

    // Iterate over the CSV file.
    for await (const record of parser) {
      const targetAddr = record[0];
      const amount = ethers.utils.parseUnits(record[1], conf.tokenDecimals);
      const nextAccumulator = accumulator.add(amount);
      // Skip if the next transaction will reach the end of the cycle allowance.
      if (nextAccumulator.gte(conf.maxLimitPerCycle)) {
        if (!stoppedBefore) {
          stoppedBefore = `Stopped before sending to ${targetAddr}, because the next transaction would exceed the cycle allowance. \nTotal would be: ${nextAccumulator.toString()}`;
        }
      } else {
        console.log("Processing: ", record);
        if (record.length == 2) {
          if (isAddress(targetAddr)) {
            if (amount.gte(conf.minLimitToSend)) {
              console.log("Checking total sent: ", accumulator.toString());
              // Can proceed with the transaction...
              try {
                console.log("Sending: ", amount.toString(), " to ", targetAddr);
                let tx: ContractTransaction = await token
                  .connect(sender)
                  .transfer(targetAddr, amount);
                let receipt: ContractReceipt = await tx.wait();
                // console.log("Receipt: ", receipt);
                console.log((await token.balanceOf(targetAddr)).toString());
                console.log("Successfully sent!");
                writeSentStream.write(`${targetAddr},${amount.toString()}\n`);
                received.push(record);
                accumulator = nextAccumulator;
              } catch (e) {
                console.log("Failed to send: ", e);
                writeSkipsStream.write(`${targetAddr},${amount.toString()}\n`);
                skipped.push(record);
              }
            } else {
              console.log(`Skip "${targetAddr}", amount too small: ${amount}`);
              writeSkipsStream.write(`${targetAddr},${amount.toString()}\n`);
              skipped.push(record);
            }
          } else {
            console.log("Skipping invalid address: ", targetAddr);
            writeSkipsStream.write(`${targetAddr},${amount.toString()}\n`);
            skipped.push(record);
          }
        } else {
          console.log("Skipping invalid record: ", record);
          writeSkipsStream.write(`${targetAddr},${amount.toString()}\n`);
          skipped.push(record);
        }
      }
    }

    // End all streams
    writeSentStream.end();
    writeSkipsStream.end();
    parser.end();

    await promise;

    console.log("\nReceived -----------------------------------\n\n", received);
    console.log("\nSkiped -------------------------------------\n\n", skipped);
    if (stoppedBefore) {
      console.log("\n", stoppedBefore);
    } else {
      console.log("\nCompleted the whole list!");
    }
  } else {
    const message = `network=${networkName} message='Unsupported network'`;
    console.log(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
