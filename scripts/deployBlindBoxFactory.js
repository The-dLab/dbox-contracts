// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function main() {
  const [owner, addr1, addr2] = await ethers.getSigners();
  const BlindBoxFactory = await hre.ethers.getContractFactory("BlindBoxFactory");
  const TestNFT = await hre.ethers.getContractFactory("TestNFT");
  const TestToken = await hre.ethers.getContractFactory("TestToken");
  // const und = "0x37587469690CC37EE19Ff6163ce7275BB1b17d3b";
  // const wallet = "0x6f9e282aC2Bc744755b7fb10eC4CA642b2d2e883";
  // const ohexPerSecond = "500000000000000000000";
  // const startTime = 1642870800;
  // const endTime = 1643871600;
  const blindBoxFactory = await BlindBoxFactory.deploy();
  const testNFT = await TestNFT.deploy();
  const testToken = await TestToken.deploy(ethers.utils.parseUnits("1000", 18));
  for (let index = 0; index < 20; index++) {
    await testNFT.mint(owner.address);
  }
  await blindBoxFactory.deployed();

  console.log("BlindBoxFactory deployed to:", blindBoxFactory.address);
  console.log("TestNFT deployed to:", testNFT.address);
  console.log("TestToken deployed to:", testToken.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
