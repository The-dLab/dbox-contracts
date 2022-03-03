//SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./BlindBox.sol";

contract BlindBoxFactory is Ownable {
    mapping(bytes32 => address) public ids;

    event CreateBox(bytes32 oid, address boxAddress);

    function createBox(
        bytes32 oid,
        bool _condition,
        IERC20[] memory _cTokens,
        IERC721[] memory _cNFTs,
        uint256[] memory _amounts,
        BlindBox.PrizeType[] memory _pTypes,
        address[] memory _pAddress,
        uint256[] memory _pAmounts
    ) public {
        BlindBox box = new BlindBox(msg.sender, _condition, _cTokens, _cNFTs, _amounts, _pTypes, _pAddress, _pAmounts);
        ids[oid] = address(box);
        emit CreateBox(oid, address(box));
    }
}
