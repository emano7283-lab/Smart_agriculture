// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SmartProperty {

    struct Property {
        uint id;
        string name;
        address owner;
        bool exists;
    }

    struct ContractAgreement {
        uint propertyId;
        address owner;
        address client;
        uint price;
        uint startDate;
        uint durationMonths;
        string contractType; // "buy" or "rent"
    }

    mapping(uint => Property) public properties;
    mapping(uint => ContractAgreement) public contracts;

    uint public propertyCount = 0;
    uint public contractCount = 0;

    event PropertyAdded(uint propertyId, address owner);
    event PropertyDeleted(uint propertyId);
    event ContractCreated(uint contractId, uint propertyId, address client);

    function addProperty(string memory name) public {
        propertyCount++;
        properties[propertyCount] = Property(propertyCount, name, msg.sender, true);
        emit PropertyAdded(propertyCount, msg.sender);
    }

    function deleteProperty(uint propertyId) public {
        require(properties[propertyId].owner == msg.sender, "Not owner");
        properties[propertyId].exists = false;
        emit PropertyDeleted(propertyId);
    }

    function createContract(
        uint propertyId,
        address client,
        uint price,
        uint startDate,
        uint durationMonths,
        string memory contractType
    ) public {
        require(properties[propertyId].exists, "Property does not exist");
        require(properties[propertyId].owner == msg.sender, "Not owner");
        contractCount++;
        contracts[contractCount] = ContractAgreement(
            propertyId,
            msg.sender,
            client,
            price,
            startDate,
            durationMonths,
            contractType
        );
        emit ContractCreated(contractCount, propertyId, client);
    }
}