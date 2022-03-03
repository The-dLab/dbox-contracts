const { ethers } = require("hardhat");
const hre = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = require("ethers");
const AddressZero = ethers.constants.AddressZero;

describe("BindBoxFactory without condition", function () {
  let owner, addr1, addr2;
  let BlindBoxFactory, blindBoxFactory, TestToken, testToken, TestNFT, testNFT;
  const amount = ethers.utils.parseUnits("50", 18);
  beforeEach(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();

    //init test token
    TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(ethers.utils.parseUnits("1000", 18));
    await testToken.deployed();

    //init test NFT
    TestNFT = await ethers.getContractFactory("TestNFT");
    testNFT = await TestNFT.deploy();
    // init mint 10
    for (let index = 0; index < 10; index++) {
      await testNFT.mint(owner.address);
    }

    BlindBoxFactory = await ethers.getContractFactory("BlindBoxFactory");
    blindBoxFactory = await BlindBoxFactory.deploy();

    await blindBoxFactory.deployed();
  });
  it("Test Token must be initialized success", async () => {
    expect(await testToken.balanceOf(owner.address)).to.equal("1000000000000000000000");
  });
  it("Test NFT must be initialized success", async () => {
    expect(await testNFT.balanceOf(owner.address)).to.equal("10");
  });
  it("Create box must be success", async () => {
    const tx = await blindBoxFactory.createBox(
      ethers.utils.formatBytes32String("test_oid"),
      owner.address,
      false,
      [],
      [],
      [],
      [BigNumber.from("0"), BigNumber.from("1"), BigNumber.from("2")],
      [AddressZero, testToken.address, testNFT.address],
      [BigNumber.from("0"), ethers.utils.parseUnits("50", 18), BigNumber.from("3")],
    );
    const receipt = await tx.wait();
    const events = receipt.events.filter(x => {
      return x.event == "CreateBox";
    });
    const oidBytes = events[0].args["oid"];
    const oid = ethers.utils.parseBytes32String(oidBytes);
    expect(oid).to.equal("test_oid");
  });
  // it("correctly constructs a box", async function () {
  //   expect(await blindBox.condition()).to.equal(false);
  //   expect(await blindBox.state()).to.equal(0);
  //   expect(await blindBox.prizeId()).to.equal(3);
  // });
});
