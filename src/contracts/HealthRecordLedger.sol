// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HealthRecordLedger {

    // A structure to hold the hash and the timestamp
    struct RecordUpdate {
        string recordHash;
        uint256 timestamp;
    }

    mapping(string => RecordUpdate[]) public patientRecords;

    event RecordUpdated(string indexed patientId, string recordHash, uint256 timestamp);

    /**
     * @dev Adds a new health record hash for a given patient.
     * Only the doctor should be able to call this (in a real app, you'd add access control).
     */
    function addRecordHash(string memory _patientId, string memory _recordHash) public {
        patientRecords[_patientId].push(RecordUpdate({
            recordHash: _recordHash,
            timestamp: block.timestamp
        }));
        emit RecordUpdated(_patientId, _recordHash, block.timestamp);
    }

    function getLatestRecordHash(string memory _patientId) public view returns (RecordUpdate memory) {
        uint256 recordCount = patientRecords[_patientId].length;
        require(recordCount > 0, "No records found for this patient.");
        return patientRecords[_patientId][recordCount - 1];
    }
}