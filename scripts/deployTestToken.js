const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const TestNFT = await hre.ethers.getContractFactory("TestNFT");
  const TestToken = await hre.ethers.getContractFactory("TestToken");
  const testNFT = await TestNFT.deploy();
  const testToken = await TestToken.deploy(ethers.utils.parseUnits("100000", 18));
  for (let index = 0; index < 200; index++) {
    await testNFT.mint(owner.address);
  }
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
