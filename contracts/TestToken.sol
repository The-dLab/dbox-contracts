// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Test Token
 * @author Remy
 */
contract TestToken is ERC20, Ownable {
    constructor(uint256 _amount) ERC20("Test Token", "TT") {
        _mint(msg.sender, _amount);
    }
}
