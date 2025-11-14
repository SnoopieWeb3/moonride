// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Vault {
    address private immutable owner;

    event Deposit(address indexed account, uint256 amount, uint256 timestamp);
    event Withdrawal(uint256 amount);
    event Distribution(uint256 totalAmount, uint256 recipientCount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Vault: Caller is not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        require(msg.value > 0, "Vault: Deposit must be > 0");
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }

    function withdraw(uint256 amount, address recipient) external onlyOwner {
        require(amount > 0, "Vault: Withdraw amount must be > 0");
        require(address(this).balance >= amount, "Vault: Insufficient balance");

        (bool success,) = recipient.call{value: amount}("");
        require(success, "Vault: Ether transfer failed");

        emit Withdrawal(amount);
    }

    function distribute(address[] calldata accounts, uint256[] calldata amounts)
        external onlyOwner
    {
        uint256 recipientCount = accounts.length;
        require(recipientCount > 0, "Vault: Recipient list empty");
        require(recipientCount == amounts.length, "Vault: Arrays length mismatch");

        uint256 totalAmount = 0;
        unchecked {
            for (uint256 i = 0; i < recipientCount; i++) {
                totalAmount += amounts[i];
            }
        }

        require(address(this).balance >= totalAmount, "Vault: Insufficient balance for distribution");

        unchecked {
            for (uint256 i = 0; i < recipientCount; i++) {
                address recipient = accounts[i];
                uint256 amount = amounts[i];

                if (amount > 0 && recipient != address(0)) {
                    (bool success,) = recipient.call{value: amount}("");
                    require(success, "Vault: Transfer failed to recipient");
                }
            }
        }

        emit Distribution(totalAmount, recipientCount);
    }

    receive() external payable {
        if (msg.value > 0) {
            emit Deposit(msg.sender, msg.value, block.timestamp);
        }
    }

    fallback() external payable {
        // fallback can optionally handle ether or do nothing
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
