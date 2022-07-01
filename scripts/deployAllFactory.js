// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function main() {
  const BlindBoxFactory = await hre.ethers.getContractFactory("BlindBoxFactory");
  const blindBoxFactory = await BlindBoxFactory.deploy();
  const BountyBoxFactory = await hre.ethers.getContractFactory("BountyBoxFactory");
  const bountyBoxFactory = await BountyBoxFactory.deploy();
  await bountyBoxFactory.deployed();
  await blindBoxFactory.deployed();
  console.log("BlindBoxFactory deployed to:", blindBoxFactory.address);
  console.log("BountyBoxFactory deployed to:", bountyBoxFactory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
