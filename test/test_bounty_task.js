const { ethers } = require("hardhat");
const hre = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = require("ethers");
const AddressZero = ethers.constants.AddressZero;

describe("BountyTask without condition", function () {
  let owner, addr1, addr2;
  let BountyTask, bountyTask, TestToken, testToken, TestNFT, testNFT;
  const amount = ethers.utils.parseUnits("50", 18);
  const endTime = Math.round(new Date().getTime() / 1000) + 60 * 60;
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

    BountyTask = await ethers.getContractFactory("BountyTask");
    bountyTask = await BountyTask.deploy(
      false,
      endTime,
      [],
      [],
      [],
      [BigNumber.from("0"), BigNumber.from("1"), BigNumber.from("2")],
      [AddressZero, testToken.address, testNFT.address],
      [BigNumber.from("0"), ethers.utils.parseUnits("50", 18), BigNumber.from("1")],
    );
    await bountyTask.deployed();
  });
  it("Test Token must be initialized success", async () => {
    expect(await testToken.balanceOf(owner.address)).to.equal("1000000000000000000000");
  });
  it("Test NFT must be initialized success", async () => {
    expect(await testNFT.balanceOf(owner.address)).to.equal("10");
  });
  it("correctly constructs a task", async function () {
    expect(await bountyTask.condition()).to.equal(false);
    expect(await bountyTask.state()).to.equal(0);
    expect(await bountyTask.idx()).to.equal(3);
  });
  describe("Add Reward", () => {
    it("Only owner could add reward", async () => {
      await expect(bountyTask.connect(addr1).addReward(0)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Add one [TOKEN] reward must be success", async () => {
      await testToken.approve(bountyTask.address, amount);
      await bountyTask.addReward(1);
      expect(await testToken.balanceOf(bountyTask.address)).to.equal(amount.toString());
    });
    it("Add one [NFT] reward must be success", async () => {
      const tokenId = "1";
      await testNFT.approve(bountyTask.address, BigNumber.from(tokenId));
      await bountyTask.addReward(2);
      expect(await testNFT.balanceOf(bountyTask.address)).to.equal("1");
      expect(await testNFT.ownerOf(BigNumber.from(tokenId))).to.equal(bountyTask.address);
    });
    it("Add multi reward must be success", async () => {
      await testToken.approve(bountyTask.address, amount);
      await bountyTask.addReward(1);
      const tokenId = "1";
      await testNFT.approve(bountyTask.address, BigNumber.from(tokenId));
      await bountyTask.addReward(2);
      const curIdx = 3;
      expect(await bountyTask.idx()).to.equal(curIdx);
      expect(await bountyTask.state()).to.equal(1);
      for (let index = 0; index < curIdx; index++) {
        expect((await bountyTask.rewardInfo(index))["state"]).to.equal(1);
      }
    });
  });
  describe("Join Task", () => {
    const tokenId = "1";
    const amount = ethers.utils.parseUnits("50", 18);
    beforeEach(async () => {
      await testNFT.approve(bountyTask.address, BigNumber.from(tokenId));
      await testToken.approve(bountyTask.address, amount);
      await bountyTask.addReward(1);
      await bountyTask.addReward(2);
      expect(await bountyTask.idx()).to.equal(3);
    });
    const joinTask = async addr => {
      const tx = await bountyTask
        .connect(addr)
        .join(
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
        return x.event == "JOIN";
      });
      const newBox = events[0].args["_contract"];
      const size = events[0].args["actorSize"].toNumber();
      const actorInfo = await bountyTask.actors(size - 1);
      expect(actorInfo["time"].toNumber()).to.greaterThan(0);
      expect(actorInfo["creator"]).to.equal(addr.address);
      expect(actorInfo["blindBox"]).to.equal(newBox);
    };
    it("Join only with active", async () => {
      await bountyTask.finish();
      await expect(
        bountyTask
          .connect(addr1)
          .join(
            false,
            [],
            [],
            [],
            [BigNumber.from("0"), BigNumber.from("1"), BigNumber.from("2")],
            [AddressZero, testToken.address, testNFT.address],
            [BigNumber.from("0"), ethers.utils.parseUnits("50", 18), BigNumber.from("3")],
          ),
      ).to.be.revertedWith("Task must in Active");
    });
    it("Join one must be success", async () => {
      await joinTask(addr1);
    });
    it("User only could join once", async () => {
      await joinTask(addr1);
      await expect(
        bountyTask
          .connect(addr1)
          .join(
            false,
            [],
            [],
            [],
            [BigNumber.from("0"), BigNumber.from("1"), BigNumber.from("2")],
            [AddressZero, testToken.address, testNFT.address],
            [BigNumber.from("0"), ethers.utils.parseUnits("50", 18), BigNumber.from("3")],
          ),
      ).to.revertedWith("Only join once");
    });
    it("Join mulit must be success", async () => {
      await joinTask(owner);
      await joinTask(addr1);
      await joinTask(addr2);
    });
    it("Award must be success", async () => {
      await joinTask(owner);
      await joinTask(addr1);
      await joinTask(addr2);
      await bountyTask.finish();
      expect(await bountyTask.state()).to.equal(2);
      expect(await bountyTask.actorSize()).to.equal(3);
      await bountyTask.award(1, 2);
      const initBalance = BigNumber.from(await testToken.balanceOf(addr1.address));
      expect(await testToken.balanceOf(addr2.address)).to.equals(amount.add(initBalance).toString());
      await bountyTask.award(2, 1);
      expect(await testNFT.ownerOf(BigNumber.from(tokenId))).to.equal(addr1.address);
    });
    it("Recycle excess reward must be success", async () => {
      const initOwnerToken = BigNumber.from(await testToken.balanceOf(owner.address));
      const initContractToken = BigNumber.from(await testToken.balanceOf(bountyTask.address));
      const initOwnerNFT = BigNumber.from(await testNFT.balanceOf(owner.address));
      const initContractNFT = BigNumber.from(await testNFT.balanceOf(bountyTask.address));
      await expect(bountyTask.recycle()).to.revertedWith("Only finished task can be recycle");
      await bountyTask.finish();
      await bountyTask.recycle();
      const afterOwnerToken = BigNumber.from(await testToken.balanceOf(owner.address));
      const afterContractToken = BigNumber.from(await testToken.balanceOf(bountyTask.address));
      const afterOwnerNFT = BigNumber.from(await testNFT.balanceOf(owner.address));
      const afterContractNFT = BigNumber.from(await testNFT.balanceOf(bountyTask.address));
      expect(afterContractNFT.toNumber()).to.equal(0);
      expect(afterContractToken.toNumber()).to.equal(0);
      expect(afterOwnerToken).to.equal(initOwnerToken.add(initContractToken));
      expect(afterOwnerNFT.toNumber()).to.equal(initOwnerNFT.toNumber() + initContractNFT.toNumber());
    });
  });
});
