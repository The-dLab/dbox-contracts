//SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestNFT is ERC721, Ownable {
    uint256 public tokenId;

    constructor() ERC721("TestNFT", "TFT") {}

    function mint(address to) public onlyOwner {
        tokenId++;
        _mint(to, tokenId);
    }
}
