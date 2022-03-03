const { utils } = require("ethers");

function generateHashEncodePacked(address, tokenId) {
  return utils.sha256(
    utils.solidityPack(["address", "uint256"], [address, tokenId])
  );
}

module.exports = { generateHashEncodePacked }