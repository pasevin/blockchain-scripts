import { ethers, network } from "hardhat";
import * as fs from "fs";
import { parse } from "csv";
import { isAddress } from "@ethersproject/address";
import { pipeline } from "stream/promises";
import { BigNumber, ContractReceipt, ContractTransaction } from "ethers";

async function main() {
  // Path to the CSV files.
  const readPath = __dirname + "/csv/input/addresses.csv";
  const now = new Date();
  const timeStamp = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}-${now.getUTCSeconds()}`;
  const writePathValid = `${__dirname}/csv/output/${timeStamp}_valid.csv`;
  const writePathInvalid = `${__dirname}/csv/output/${timeStamp}_invalid.csv`;

  // Read/write the CSV file.
  const readFileStream = fs.createReadStream(readPath);
  const writeValidStream = fs.createWriteStream(writePathValid);
  const writeInvalidStream = fs.createWriteStream(writePathInvalid);
  // Parse the CSV file.
  const parser = parse({
    delimiter: ",",
  });

  // Create a pipeline to read the CSV file, parse it, and write the results.
  const promise = pipeline(readFileStream, parser);

  // Keeps track of the addresses that are valid.
  const valid: string[][] = [];
  // Keeps track of the addresses that are invalid.
  const invalid: string[][] = [];

  // Iterate over the CSV file.
  for await (const record of parser) {
    const targetAddr = record[0];
    console.log("Checking: ", record);
    if (record.length == 1) {
      if (isAddress(targetAddr)) {
        writeValidStream.write(`${targetAddr}\n`);
        valid.push(record);
      } else {
        writeInvalidStream.write(`${targetAddr}\n`);
        invalid.push(record);
      }
    } else {
      console.log("Skipping invalid record: ", record);
      writeInvalidStream.write(`${targetAddr}\n`);
      invalid.push(record);
    }
  }

  // End all streams
  writeValidStream.end();
  writeInvalidStream.end();
  parser.end();

  await promise;

  console.log("\nValid ---------------------------------------\n\n", valid);
  console.log("\nInvalid -------------------------------------\n\n", invalid);
  console.log("\nCompleted the whole list!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
