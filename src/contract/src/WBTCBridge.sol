// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./IERC20.sol";

interface ITicketFactory {
    function createTicket(
        bytes32 _identifier,
        address _msgSender,
        bytes memory _message
    ) external;
}

contract WBTCBridge {
    address public appInbox;
    address private constant WBTC_ADDRESS = 0x92f3B59a79bFf5dc60c0d59eA13a44D082B2bdFC; // sepolia

    // Mapping to keep track of bridged WBTC amounts
    mapping(address => uint256) public bridgedAmounts;

    // Event to log WBTC bridging activities
    event WBTCBridged(string indexed btcAddress, uint256 amount);

    constructor(address _appInbox) {
        appInbox = _appInbox;
    }

    function bridgeWBTC(
        address _token,
        uint256 _amount,
        string memory _btcAddress
    ) external payable {
        require(_amount > 0, "AMOUNT_ZERO");
        require(_token == WBTC_ADDRESS, "ONLY_WBTC_ALLOWED");
        // TODO: validate btcAddress

        bool success = IERC20(_token).transferFrom(
            msg.sender,
            address(this),
            _amount
        );
        require(success, "TRANSFER_FAILED");

        bridgedAmounts[msg.sender] += _amount;

        bytes memory message = abi.encode(_amount, _btcAddress);

        bytes32 identifier = keccak256("BRIDGE_WBTC");
        ITicketFactory(appInbox).createTicket(identifier, msg.sender, message);

        emit WBTCBridged(_btcAddress, _amount);
    }
}
