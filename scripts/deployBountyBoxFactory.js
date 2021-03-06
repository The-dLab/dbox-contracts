// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function main() {
  // const [owner] = await ethers.getSigners();
  const BountyBoxFactory = await hre.ethers.getContractFactory("BountyBoxFactory");
  const bountyBoxFactory = await BountyBoxFactory.deploy();
  await bountyBoxFactory.deployed();

  console.log("BountyBoxFactory deployed to:", bountyBoxFactory.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
