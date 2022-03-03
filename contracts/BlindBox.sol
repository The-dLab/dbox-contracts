//SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract BlindBox is Ownable, ERC721Holder {
    //not needed starting with Solidity 0.8
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event Draw(address sender, uint256 prizeId);
    event ChangeState(address sender, State state);
    event Recycle(address sender);

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

    PrizeInfo[] public prizeInfo;
    uint256[] public pool;
    uint256 public currentPrizeSize;
    uint256 public prizeId;
    State public state;
    bool public condition;
    IERC20[] private cTokens;
    uint256[] private cAmounts;
    IERC721[] private cNFTs;

    struct PlayerInfo {
        uint256 time;
        uint256 prizeId;
    }

    struct PrizeInfo {
        uint256 id;
        PrizeType pType;
        IERC20 prizeToken;
        IERC721 prizeNFT;
        uint256 amount;
        uint256 tokenId;
        PrizeState state;
    }

    mapping(address => PlayerInfo) public players;

    constructor(
        address creator,
        bool _condition,
        IERC20[] memory _cTokens,
        IERC721[] memory _cNFTs,
        uint256[] memory _amounts,
        PrizeType[] memory _pTypes,
        address[] memory _pAddress,
        uint256[] memory _pAmounts
    ) {
        transferOwnership(creator);
        state = State.Waiting;
        prizeId = 0;
        if (_condition && (_cNFTs.length > 0 || _cTokens.length > 0)) {
            condition = _condition;
            cTokens = _cTokens;
            cAmounts = _amounts;
            cNFTs = _cNFTs;
        }
        for (uint256 index = 0; index < _pTypes.length; index++) {
            PrizeInfo memory _prizeInfo = PrizeInfo({
                id: prizeId,
                pType: _pTypes[index],
                prizeToken: IERC20(address(0)),
                prizeNFT: IERC721(address(0)),
                amount: _pAmounts[index],
                tokenId: _pAmounts[index],
                state: PrizeState.DRAFT
            });
            if (_pTypes[index] == PrizeType.TOKEN) {
                _prizeInfo.prizeToken = IERC20(_pAddress[index]);
                _prizeInfo.amount = _pAmounts[index];
            } else if (_pTypes[index] == PrizeType.NFT) {
                _prizeInfo.prizeNFT = IERC721(_pAddress[index]);
                _prizeInfo.tokenId = _pAmounts[index];
            } else if (_pTypes[index] == PrizeType.IMAGE) {
                _prizeInfo.state = PrizeState.CONFIRMED;
                currentPrizeSize++;
                pool.push(prizeId);
            }
            prizeId++;
            prizeInfo.push(_prizeInfo);
        }
    }

    function addPrize(uint256 idx) public onlyOwner {
        require(state == State.Waiting, "Must call when blind box preparation stage");
        PrizeInfo storage _prizeInfo = prizeInfo[idx];
        if (_prizeInfo.state == PrizeState.DRAFT) {
            if (_prizeInfo.pType == PrizeType.TOKEN) {
                _prizeInfo.prizeToken.safeTransferFrom(address(msg.sender), address(this), _prizeInfo.amount);
            } else if (_prizeInfo.pType == PrizeType.NFT) {
                _prizeInfo.prizeNFT.safeTransferFrom(address(msg.sender), address(this), _prizeInfo.tokenId);
            }
            _prizeInfo.state = PrizeState.CONFIRMED;
            pool.push(idx);
            currentPrizeSize++;
        }
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

    function draw() public {
        require(state == State.Active, "Only call in Active");
        require(players[msg.sender].time == 0, "One player can only call once");
        checkCondition(msg.sender);
        uint256 _index = random(currentPrizeSize);
        uint256 id = pool[_index];
        currentPrizeSize = currentPrizeSize > 0 ? currentPrizeSize - 1 : 0;
        PrizeInfo storage _prizeInfo = prizeInfo[id];
        PlayerInfo storage _player = players[msg.sender];
        _player.time = block.timestamp;
        _player.prizeId = _prizeInfo.id;
        _prizeInfo.state = PrizeState.REWARDED;
        delete pool;
        for (uint256 index = 0; index < prizeInfo.length; index++) {
            if (prizeInfo[index].state == PrizeState.CONFIRMED) {
                pool.push(prizeInfo[index].id);
            }
        }
        if (pool.length == 0) {
            state = State.Finished;
        }
        if (_prizeInfo.pType == PrizeType.TOKEN) {
            _prizeInfo.prizeToken.safeTransfer(msg.sender, _prizeInfo.amount);
        } else if (_prizeInfo.pType == PrizeType.NFT) {
            _prizeInfo.prizeNFT.safeTransferFrom(address(this), msg.sender, _prizeInfo.tokenId);
        }
        emit Draw(msg.sender, id);
    }

    //start game
    function start() public onlyOwner {
        require(state == State.Waiting, "Must call after Waiting");
        for (uint256 index = 0; index < prizeInfo.length; index++) {
            if (prizeInfo[index].pType != PrizeType.IMAGE) {
                addPrize(index);
            }
        }
        checkState();
        state = State.Active;
        emit ChangeState(msg.sender, State.Active);
    }

    //end game, prevent player draw it again and owner can recycle excess box
    function finish() public onlyOwner {
        require(state != State.Finished, "Already Finished");
        state = State.Finished;
        emit ChangeState(msg.sender, State.Finished);
    }

    //change condition
    function setCondition(
        bool _condition,
        IERC20[] memory _cTokens,
        IERC721[] memory _cNFTs,
        uint256[] memory _amounts
    ) public onlyOwner {
        condition = _condition;
        if (condition) {
            cTokens = _cTokens;
            cAmounts = _amounts;
            cNFTs = _cNFTs;
        } else {
            delete cTokens;
            delete cAmounts;
            delete cNFTs;
        }
    }

    function checkState() private view {
        uint256 count = 0;
        for (uint256 index = 0; index < prizeInfo.length; index++) {
            if (prizeInfo[index].state == PrizeState.DRAFT) {
                count++;
            }
        }
        require(count == 0, "Need all prize confirmed");
    }

    //recycle excess prize
    function recycle() public onlyOwner {
        require(pool.length > 0, "All box is empty");
        require(state == State.Finished, "Only finished game can be recycle");
        for (uint256 index = 0; index < prizeInfo.length; index++) {
            PrizeInfo storage _prizeInfo = prizeInfo[index];
            if (_prizeInfo.state == PrizeState.CONFIRMED) {
                _prizeInfo.state = PrizeState.RECYCLED;
                if (_prizeInfo.pType == PrizeType.TOKEN) {
                    _prizeInfo.prizeToken.safeTransfer(msg.sender, _prizeInfo.amount);
                } else if (_prizeInfo.pType == PrizeType.NFT) {
                    _prizeInfo.prizeNFT.safeTransferFrom(address(this), msg.sender, _prizeInfo.tokenId);
                }
            }
        }
        emit Recycle(msg.sender);
    }

    //not a reliable RNG, just for lottery game, have fun.
    //if use for high value assets, replace it by Oracle like Chainlink.
    function random(uint256 length) private view returns (uint256) {
        uint256 seed = uint256(keccak256(abi.encodePacked(block.difficulty, block.timestamp, length)));
        return seed % length;
    }

    function getAllPool() public view returns (uint256[] memory) {
        return pool;
    }
}
