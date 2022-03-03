const { ethers } = require("hardhat");
const hre = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = require("ethers");
const AddressZero = ethers.constants.AddressZero;

describe("BindBoxTest without condition", function () {
  let owner, addr1, addr2;
  let BlindBox, blindBox, TestToken, testToken, TestNFT, testNFT;
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

    BlindBox = await ethers.getContractFactory("BlindBox");
    blindBox = await BlindBox.deploy(
      owner.address,
      false,
      [],
      [],
      [],
      [BigNumber.from("0"), BigNumber.from("1"), BigNumber.from("2")],
      [AddressZero, testToken.address, testNFT.address],
      [BigNumber.from("0"), ethers.utils.parseUnits("50", 18), BigNumber.from("3")],
    );
    await blindBox.deployed();
  });
  it("Test Token must be initialized success", async () => {
    expect(await testToken.balanceOf(owner.address)).to.equal("1000000000000000000000");
  });
  it("Test NFT must be initialized success", async () => {
    expect(await testNFT.balanceOf(owner.address)).to.equal("10");
  });
  it("correctly constructs a box", async function () {
    expect(await blindBox.condition()).to.equal(false);
    expect(await blindBox.state()).to.equal(0);
    expect(await blindBox.prizeId()).to.equal(3);
  });
  describe("Add Prize", () => {
    it("Only owner could add prize", async () => {
      await expect(blindBox.connect(addr1).addPrize(0)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Add one [TOKEN] prize must be success", async () => {
      await testToken.approve(blindBox.address, amount);
      await blindBox.addPrize(1);
      expect(await testToken.balanceOf(blindBox.address)).to.equal(amount.toString());
      expect(await blindBox.currentPrizeSize()).to.equal(2);
    });
    it("Add one [NFT] prize must be success", async () => {
      const tokenId = "3";
      await testNFT.approve(blindBox.address, BigNumber.from(tokenId));
      await blindBox.addPrize(2);
      expect(await testNFT.balanceOf(blindBox.address)).to.equal("1");
      expect(await testNFT.ownerOf(BigNumber.from(tokenId))).to.equal(blindBox.address);
      expect(await blindBox.currentPrizeSize()).to.equal(2);
    });
    it("Add multi prize must be success", async () => {
      await testToken.approve(blindBox.address, amount);
      await blindBox.addPrize(1);
      const tokenId = "3";
      await testNFT.approve(blindBox.address, BigNumber.from(tokenId));
      await blindBox.addPrize(2);
      const curPrizeId = 3;
      expect(await blindBox.currentPrizeSize()).to.equal(curPrizeId);
      const pool = await blindBox.getAllPool();
      expect(pool.length).to.equal(curPrizeId);
      for (let index = 0; index < curPrizeId; index++) {
        expect((await blindBox.prizeInfo(index))["state"]).to.equal(1);
      }
    });
  });
  describe("Draw Box", () => {
    const tokenId = "3";
    const amount = ethers.utils.parseUnits("50", 18);
    beforeEach(async () => {
      await testNFT.approve(blindBox.address, BigNumber.from(tokenId));
      await testToken.approve(blindBox.address, amount);
      await blindBox.addPrize(1);
      await blindBox.addPrize(2);
      expect(await blindBox.prizeId()).to.equal(3);
    });
    const drawOne = async (addr, remain) => {
      const initBalance = BigNumber.from(await testToken.balanceOf(addr.address));
      const tx = await blindBox.connect(addr).draw();
      const receipt = await tx.wait();
      const events = receipt.events.filter(x => {
        return x.event == "Draw";
      });
      const id = events[0].args["prizeId"].toNumber();
      const pool = await blindBox.getAllPool();
      expect(pool.length).to.equal(remain);
      const prizeInfo = await blindBox.prizeInfo(id);
      expect(prizeInfo["state"]).to.equal(2);
      expect(prizeInfo["id"]).to.equal(id);
      const playInfo = await blindBox.players(addr.address);
      expect(playInfo["time"].toNumber()).to.greaterThan(0);
      expect(playInfo["prizeId"]).to.equal(id);
      if (prizeInfo["pType"] == 1) {
        expect(await testToken.balanceOf(addr.address)).to.equals(amount.add(initBalance).toString());
      } else if (prizeInfo["pType"] == 2) {
        expect(await testNFT.ownerOf(BigNumber.from(tokenId))).to.equal(addr.address);
      }
    };
    it("Set box state must be success", async () => {
      await expect(blindBox.connect(addr1).start()).to.be.revertedWith("Ownable: caller is not the owner");
      await blindBox.start();
      await expect(blindBox.start()).to.be.revertedWith("Must call after Waiting");
      expect(await blindBox.state()).to.equal(1);
    });
    it("Draw only with active", async () => {
      await expect(blindBox.connect(addr1).draw()).to.be.revertedWith("Only call in Active");
    });
    it("Draw one must be success", async () => {
      await blindBox.start();
      await drawOne(addr1, 2);
    });
    it("Player only could play once", async () => {
      await blindBox.start();
      await drawOne(addr1, 2);
      await expect(blindBox.connect(addr1).draw()).to.revertedWith("One player can only call once");
    });
    it("Draw mulit must be success", async () => {
      await blindBox.start();
      await drawOne(owner, 2);
      await drawOne(addr1, 1);
      await drawOne(addr2, 0);
    });
    it("Draw out state must be right", async () => {
      await blindBox.start();
      await drawOne(owner, 2);
      await drawOne(addr1, 1);
      await drawOne(addr2, 0);
      expect(await blindBox.state()).to.equal(2);
      expect(await blindBox.currentPrizeSize()).to.equal(0);
      expect((await blindBox.getAllPool()).length).to.equal(0);
    });
    it("Recycle excess prize must be success", async () => {
      const initOwnerToken = BigNumber.from(await testToken.balanceOf(owner.address));
      const initContractToken = BigNumber.from(await testToken.balanceOf(blindBox.address));
      const initOwnerNFT = BigNumber.from(await testNFT.balanceOf(owner.address));
      const initContractNFT = BigNumber.from(await testNFT.balanceOf(blindBox.address));
      await blindBox.start();
      await expect(blindBox.recycle()).to.revertedWith("Only finished game can be recycle");
      await blindBox.finish();
      await blindBox.recycle();
      const afterOwnerToken = BigNumber.from(await testToken.balanceOf(owner.address));
      const afterContractToken = BigNumber.from(await testToken.balanceOf(blindBox.address));
      const afterOwnerNFT = BigNumber.from(await testNFT.balanceOf(owner.address));
      const afterContractNFT = BigNumber.from(await testNFT.balanceOf(blindBox.address));
      expect(afterContractNFT.toNumber()).to.equal(0);
      expect(afterContractToken.toNumber()).to.equal(0);
      expect(afterOwnerToken).to.equal(initOwnerToken.add(initContractToken));
      expect(afterOwnerNFT.toNumber()).to.equal(initOwnerNFT.toNumber() + initContractNFT.toNumber());
    });
  });
});

describe("BindBoxTest with condition", function () {
  let owner, addr1, addr2, addr3;
  let BlindBox, blindBox, TestToken, testToken, TestNFT, testNFT;
  beforeEach(async () => {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

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
    await testNFT.mint(addr2.address);
    await testToken.approve(testToken.address, ethers.utils.parseUnits("10", 18));
    await testToken.transfer(addr1.address, ethers.utils.parseUnits("10", 18));

    BlindBox = await ethers.getContractFactory("BlindBox");
    blindBox = await BlindBox.deploy(
      owner.address,
      true,
      [testToken.address],
      [testNFT.address],
      [ethers.utils.parseUnits("10", 18)],
      [BigNumber.from("0"), BigNumber.from("1"), BigNumber.from("2")],
      [AddressZero, testToken.address, testNFT.address],
      [BigNumber.from("0"), ethers.utils.parseUnits("50", 18), BigNumber.from("4")],
    );
    await blindBox.deployed();
  });
  it("correctly constructs a box", async function () {
    expect(await blindBox.condition()).to.equal(true);
    expect(await blindBox.state()).to.equal(0);
    expect(await blindBox.prizeId()).to.equal(3);
  });
  describe("Draw Box", () => {
    const tokenId = "4";
    const amount = ethers.utils.parseUnits("50", 18);
    beforeEach(async () => {
      await testNFT.approve(blindBox.address, BigNumber.from(tokenId));
      await testToken.approve(blindBox.address, amount);
      await blindBox.addPrize(1);
      await blindBox.addPrize(2);
      expect(await blindBox.currentPrizeSize()).to.equal(3);
    });
    const drawOne = async (addr, remain) => {
      const initBalance = BigNumber.from(await testToken.balanceOf(addr.address));
      const tx = await blindBox.connect(addr).draw();
      const receipt = await tx.wait();
      const events = receipt.events.filter(x => {
        return x.event == "Draw";
      });
      const id = events[0].args["prizeId"].toNumber();
      const pool = await blindBox.getAllPool();
      expect(pool.length).to.equal(remain);
      const prizeInfo = await blindBox.prizeInfo(id);
      expect(prizeInfo["state"]).to.equal(2);
      expect(prizeInfo["id"]).to.equal(id);
      const playInfo = await blindBox.players(addr.address);
      expect(playInfo["time"].toNumber()).to.greaterThan(0);
      expect(playInfo["prizeId"]).to.equal(id);
      if (prizeInfo["pType"] == 1) {
        expect(await testToken.balanceOf(addr.address)).to.equals(amount.add(initBalance).toString());
      } else if (prizeInfo["pType"] == 2) {
        expect(await testNFT.ownerOf(BigNumber.from(tokenId))).to.equal(addr.address);
      }
    };
    it("Set box state must be success", async () => {
      await expect(blindBox.connect(addr1).start()).to.be.revertedWith("Ownable: caller is not the owner");
      await blindBox.start();
      await expect(blindBox.start()).to.be.revertedWith("Must call after Waiting");
      expect(await blindBox.state()).to.equal(1);
    });
    it("Draw only with active", async () => {
      await expect(blindBox.connect(addr1).draw()).to.be.revertedWith("Only call in Active");
    });
    it("Draw one pass condition[TOKEN] must be success", async () => {
      await blindBox.start();
      await drawOne(addr1, 2);
    });
    it("Draw one pass condition[NFT] must be success", async () => {
      await blindBox.start();
      await drawOne(addr2, 2);
    });
    it("Draw one not pass condition must be reverted", async () => {
      await blindBox.start();
      await expect(blindBox.connect(addr3).draw()).to.revertedWith("Must meet the condition");
    });
    it("Player only could play once", async () => {
      await blindBox.start();
      await drawOne(addr1, 2);
      await expect(blindBox.connect(addr1).draw()).to.revertedWith("One player can only call once");
    });
    it("Draw mulit must be success", async () => {
      await blindBox.start();
      await drawOne(owner, 2);
      await drawOne(addr1, 1);
      await drawOne(addr2, 0);
    });
    it("Draw out state must be right", async () => {
      await blindBox.start();
      await drawOne(owner, 2);
      await drawOne(addr1, 1);
      await drawOne(addr2, 0);
      expect(await blindBox.state()).to.equal(2);
      expect(await blindBox.currentPrizeSize()).to.equal(0);
      expect((await blindBox.getAllPool()).length).to.equal(0);
    });
    it("Recycle excess prize must be success", async () => {
      const initOwnerToken = BigNumber.from(await testToken.balanceOf(owner.address));
      const initContractToken = BigNumber.from(await testToken.balanceOf(blindBox.address));
      const initOwnerNFT = BigNumber.from(await testNFT.balanceOf(owner.address));
      const initContractNFT = BigNumber.from(await testNFT.balanceOf(blindBox.address));
      await blindBox.start();
      await expect(blindBox.recycle()).to.revertedWith("Only finished game can be recycle");
      await blindBox.finish();
      await blindBox.recycle();
      const afterOwnerToken = BigNumber.from(await testToken.balanceOf(owner.address));
      const afterContractToken = BigNumber.from(await testToken.balanceOf(blindBox.address));
      const afterOwnerNFT = BigNumber.from(await testNFT.balanceOf(owner.address));
      const afterContractNFT = BigNumber.from(await testNFT.balanceOf(blindBox.address));
      expect(afterContractNFT.toNumber()).to.equal(0);
      expect(afterContractToken.toNumber()).to.equal(0);
      expect(afterOwnerToken).to.equal(initOwnerToken.add(initContractToken));
      expect(afterOwnerNFT.toNumber()).to.equal(initOwnerNFT.toNumber() + initContractNFT.toNumber());
    });
  });
});
