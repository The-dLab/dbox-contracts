//SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract BountyBox is Ownable, ERC721Holder {
    //not needed starting with Solidity 0.8
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event Join(address creator, address _contract);
    event ChangeState(address sender, State state);
    event Recycle(address sender);

    mapping(address => ActorInfo) public actors;
    RewardInfo[] public rewardInfo;
    uint256 public idx;
    uint256 public immutable endTime;
    State public state;
    bool public condition;
    IERC20[] private cTokens;
    uint256[] private cAmounts;
    IERC721[] private cNFTs;

    enum State {
        Waiting,
        Active,
        Finished
    }

    enum PrizeState {
        DRAFT,
        CONFIRMED,
        REWARDED,
        RECYCLED
    }

    enum PrizeType {
        IMAGE,
        TOKEN,
        NFT
    }

    struct ActorInfo {
        uint256 time;
        address box;
    }

    struct RewardInfo {
        uint256 id;
        PrizeType rType;
        IERC20 rewardToken;
        IERC721 rewardNFT;
        uint256 amount;
        uint256 tokenId;
        PrizeState state;
    }

    constructor(
        address creator,
        bool _condition,
        uint256 _endTime,
        IERC20[] memory _cTokens,
        IERC721[] memory _cNFTs,
        uint256[] memory _cAmounts,
        PrizeType[] memory _rTypes,
        address[] memory _rAddress,
        uint256[] memory _rAmounts
    ) {
        transferOwnership(creator);
        state = State.Waiting;
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
                state: PrizeState.DRAFT
            });
            if (_rTypes[index] == PrizeType.TOKEN) {
                _rewardInfo.rewardToken = IERC20(_rAddress[index]);
                _rewardInfo.amount = _rAmounts[index];
            } else if (_rTypes[index] == PrizeType.NFT) {
                _rewardInfo.rewardNFT = IERC721(_rAddress[index]);
                _rewardInfo.tokenId = _rAmounts[index];
            } else if (_rTypes[index] == PrizeType.IMAGE) {
                _rewardInfo.state = PrizeState.CONFIRMED;
            }
            idx++;
            rewardInfo.push(_rewardInfo);
        }
    }

    function start() public onlyOwner {
        for (uint256 index = 0; index < rewardInfo.length; index++) {
            addReward(index);
        }
        state = State.Active;
        emit ChangeState(msg.sender, State.Active);
    }

    function addReward(uint256 _idx) public onlyOwner {
        require(state == State.Waiting, "Must call when task preparation stage");
        require(rewardInfo.length > 0, "Empty!");
        if (rewardInfo[_idx].rType == PrizeType.IMAGE) {
            return;
        }
        if (rewardInfo[_idx].rType == PrizeType.TOKEN) {
            rewardInfo[_idx].rewardToken.safeTransferFrom(address(msg.sender), address(this), rewardInfo[_idx].amount);
        } else if (rewardInfo[_idx].rType == PrizeType.NFT) {
            rewardInfo[_idx].rewardNFT.safeTransferFrom(address(msg.sender), address(this), rewardInfo[_idx].tokenId);
        }
        rewardInfo[_idx].state = PrizeState.CONFIRMED;
    }

    function join(address actor, address box) public {
        checkJoin(actor);
        ActorInfo memory actorInfo = ActorInfo({ box: box, time: block.timestamp });
        actors[actor] = actorInfo;
        emit Join(actor, box);
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

    function checkJoin(address actor) private view {
        require(block.timestamp < endTime, "Bounty end");
        require(actors[actor].time == 0, "Already joined");
    }

    function award(uint256 rIdx, address actor) public onlyOwner {
        require(rewardInfo[rIdx].state == PrizeState.CONFIRMED, "Awards have been issued");
        if (rewardInfo[rIdx].rType == PrizeType.TOKEN) {
            rewardInfo[rIdx].rewardToken.safeTransfer(actor, rewardInfo[rIdx].amount);
        } else if (rewardInfo[rIdx].rType == PrizeType.NFT) {
            rewardInfo[rIdx].rewardNFT.safeTransferFrom(address(this), actor, rewardInfo[rIdx].tokenId);
        }
        rewardInfo[rIdx].state = PrizeState.REWARDED;
    }

    //end bounty
    function finish() public onlyOwner {
        require(state != State.Finished, "Already finished!");
        state = State.Finished;
        emit ChangeState(msg.sender, State.Finished);
    }

    //recycle excess prize
    function recycle() public onlyOwner {
        require(rewardInfo.length > 0, "Empty");
        require(state == State.Finished);
        for (uint256 index = 0; index < rewardInfo.length; index++) {
            RewardInfo storage _rewardInfo = rewardInfo[index];
            if (_rewardInfo.state == PrizeState.CONFIRMED) {
                _rewardInfo.state = PrizeState.RECYCLED;
                if (_rewardInfo.rType == PrizeType.TOKEN) {
                    _rewardInfo.rewardToken.safeTransfer(msg.sender, _rewardInfo.amount);
                } else if (_rewardInfo.rType == PrizeType.NFT) {
                    _rewardInfo.rewardNFT.safeTransferFrom(address(this), msg.sender, _rewardInfo.tokenId);
                }
            }
        }
        emit Recycle(msg.sender);
    }
}
