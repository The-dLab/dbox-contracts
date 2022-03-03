//SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.7;

import "./BountyBox.sol";

contract BountyBoxFactory is Ownable {
    event CreateBox(bytes32 oid, address boxAddress);

    function createBox(
        bytes32 oid,
        bool _condition,
        uint256 _endTime,
        IERC20[] memory _cTokens,
        IERC721[] memory _cNFTs,
        uint256[] memory _cAmounts,
        BlindBox.PrizeType[] memory _rTypes,
        address[] memory _rAddress,
        uint256[] memory _rAmounts
    ) public {
        BountyBox bounty = new BountyBox(
            msg.sender,
            _condition,
            _endTime,
            _cTokens,
            _cNFTs,
            _cAmounts,
            _rTypes,
            _rAddress,
            _rAmounts
        );
        emit CreateBox(oid, address(bounty));
    }
}
