//SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./BlindBox.sol";

contract BountyBox is Ownable, ERC721Holder {
    //not needed starting with Solidity 0.8
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event JOIN(address creator, uint256 actorSize, address _contract);
    event ChangeState(address sender, BlindBox.State state);
    event Recycle(address sender);

    ActorInfo[] public actors;
    RewardInfo[] public rewardInfo;
    uint256 public idx;
    uint256 public immutable endTime;
    BlindBox.State public state;
    bool public condition;
    IERC20[] private cTokens;
    uint256[] private cAmounts;
    IERC721[] private cNFTs;

    struct ActorInfo {
        uint256 time;
        address creator;
        BlindBox blindBox;
    }

    struct RewardInfo {
        uint256 id;
        BlindBox.PrizeType rType;
        IERC20 rewardToken;
        IERC721 rewardNFT;
        uint256 amount;
        uint256 tokenId;
        BlindBox.PrizeState state;
    }

    constructor(
        address creator,
        bool _condition,
        uint256 _endTime,
        IERC20[] memory _cTokens,
        IERC721[] memory _cNFTs,
        uint256[] memory _cAmounts,
        BlindBox.PrizeType[] memory _rTypes,
        address[] memory _rAddress,
        uint256[] memory _rAmounts
    ) {
        transferOwnership(creator);
        state = BlindBox.State.Waiting;
        endTime = _endTime;
        if (_condition && (_cNFTs.length > 0 || _cTokens.length > 0)) {
            condition = _condition;
            cTokens = _cTokens;
            cAmounts = _cAmounts;
            cNFTs = _cNFTs;
        }
        for (uint256 index = 0; index < _rTypes.length; index++) {
            RewardInfo memory _rewardInfo = RewardInfo({
                id: idx,
                rType: _rTypes[index],
                rewardToken: IERC20(address(0)),
                rewardNFT: IERC721(address(0)),
                amount: 0,
                tokenId: 0,
                state: BlindBox.PrizeState.DRAFT
            });
            if (_rTypes[index] == BlindBox.PrizeType.TOKEN) {
                _rewardInfo.rewardToken = IERC20(_rAddress[index]);
                _rewardInfo.amount = _rAmounts[index];
            } else if (_rTypes[index] == BlindBox.PrizeType.NFT) {
                _rewardInfo.rewardNFT = IERC721(_rAddress[index]);
                _rewardInfo.tokenId = _rAmounts[index];
            } else if (_rTypes[index] == BlindBox.PrizeType.IMAGE) {
                _rewardInfo.state = BlindBox.PrizeState.CONFIRMED;
            }
            idx++;
            rewardInfo.push(_rewardInfo);
        }
    }

    function start() public onlyOwner {
        for (uint256 index = 0; index < rewardInfo.length; index++) {
            addReward(index);
        }
        state = BlindBox.State.Active;
        emit ChangeState(msg.sender, BlindBox.State.Active);
    }

    function addReward(uint256 _idx) public onlyOwner {
        require(state == BlindBox.State.Waiting, "Must call when task preparation stage");
        require(rewardInfo.length > 0, "Empty!");
        if (rewardInfo[_idx].rType == BlindBox.PrizeType.IMAGE) {
            return;
        }
        if (rewardInfo[_idx].rType == BlindBox.PrizeType.TOKEN) {
            rewardInfo[_idx].rewardToken.safeTransferFrom(address(msg.sender), address(this), rewardInfo[_idx].amount);
        } else if (rewardInfo[_idx].rType == BlindBox.PrizeType.NFT) {
            rewardInfo[_idx].rewardNFT.safeTransferFrom(address(msg.sender), address(this), rewardInfo[_idx].tokenId);
        }
        rewardInfo[_idx].state = BlindBox.PrizeState.CONFIRMED;
    }

    function checkCondition(address sender) internal view {
        if (condition && (cTokens.length > 0 || cNFTs.length > 0)) {
            bool pass = false;
            for (uint256 index = 0; index < cTokens.length; index++) {
                if (cTokens[index].balanceOf(sender) >= cAmounts[index]) {
                    pass = true;
                    break;
                }
            }
            if (!pass) {
                for (uint256 index = 0; index < cNFTs.length; index++) {
                    if (cNFTs[index].balanceOf(sender) > 0) {
                        pass = true;
                        break;
                    }
                }
            }
            require(pass, "Must meet the condition");
        }
    }

    function join(
        bool _condition,
        IERC20[] memory _cTokens,
        IERC721[] memory _cNFTs,
        uint256[] memory _amounts,
        BlindBox.PrizeType[] memory _pTypes,
        address[] memory _pAddress,
        uint256[] memory _pAmounts
    ) public {
        require(state == BlindBox.State.Active, "Task must in Active");
        require(block.timestamp < endTime, "Task end");
        checkJoin(msg.sender);
        checkCondition(msg.sender);
        BlindBox newBlindBox = new BlindBox(
            msg.sender,
            _condition,
            _cTokens,
            _cNFTs,
            _amounts,
            _pTypes,
            _pAddress,
            _pAmounts
        );
        ActorInfo memory actor = ActorInfo({ time: block.timestamp, creator: msg.sender, blindBox: newBlindBox });
        actors.push(actor);
        emit JOIN(msg.sender, actors.length, address(newBlindBox));
    }

    function checkJoin(address sender) private view {
        for (uint256 index = 0; index < actors.length; index++) {
            if (actors[index].creator == sender) {
                require(actors[index].time == 0, "Only join once");
            }
        }
    }

    function award(uint256 rIdx, uint256 aIdx) public onlyOwner {
        require(rewardInfo[rIdx].state == BlindBox.PrizeState.CONFIRMED, "Awards have been issued");
        if (rewardInfo[rIdx].rType == BlindBox.PrizeType.TOKEN) {
            rewardInfo[rIdx].rewardToken.safeTransfer(actors[aIdx].creator, rewardInfo[rIdx].amount);
        } else if (rewardInfo[rIdx].rType == BlindBox.PrizeType.NFT) {
            rewardInfo[rIdx].rewardNFT.safeTransferFrom(address(this), actors[aIdx].creator, rewardInfo[rIdx].tokenId);
        }
        rewardInfo[rIdx].state = BlindBox.PrizeState.REWARDED;
    }

    //end task
    function finish() public onlyOwner {
        require(state != BlindBox.State.Finished);
        state = BlindBox.State.Finished;
        emit ChangeState(msg.sender, BlindBox.State.Active);
    }

    //recycle excess prize
    function recycle() public onlyOwner {
        require(rewardInfo.length > 0, "Empty");
        require(state == BlindBox.State.Finished);
        for (uint256 index = 0; index < rewardInfo.length; index++) {
            RewardInfo storage _rewardInfo = rewardInfo[index];
            if (_rewardInfo.state == BlindBox.PrizeState.CONFIRMED) {
                _rewardInfo.state = BlindBox.PrizeState.RECYCLED;
                if (_rewardInfo.rType == BlindBox.PrizeType.TOKEN) {
                    _rewardInfo.rewardToken.safeTransfer(msg.sender, _rewardInfo.amount);
                } else if (_rewardInfo.rType == BlindBox.PrizeType.NFT) {
                    _rewardInfo.rewardNFT.safeTransferFrom(address(this), msg.sender, _rewardInfo.tokenId);
                }
            }
        }
        emit Recycle(msg.sender);
    }
}
