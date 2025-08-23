// src/services/healthRecordService.js
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from '../firebase';

/**
 * Creates a new, empty health record for a patient.
 * This is typically called when a new user registers.
 * @param {string} patientUid - The UID of the patient.
 * @returns {object} The newly created record data.
 */
export const createNewHealthRecord = async (patientUid) => {
  const recordRef = doc(db, "healthRecords", patientUid);
  
  const newRecord = {
    patientId: patientUid,
    createdAt: new Date().toISOString(),
    bloodType: '',
    emergencyContact: '',
    emergencyContactName: '',
    address: '',
    dateOfBirth: '',
    personalDetailsLastUpdated: null,
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
    medicalHistory: [],
    lastUpdated: null,
    lastUpdatedBy: null
  };
  
  try {
    await setDoc(recordRef, newRecord);
    console.log("Health record created successfully for patient:", patientUid);
    return newRecord;
  } catch (error) {
    console.error("Error creating health record:", error);
    throw error; // Re-throw the error to be handled by the calling component
  }
};

/**
 * Fetches a patient's health record from Firestore.
 * @param {string} patientUid - The UID of the patient.
 * @returns {object|null} The patient's health record data, or null if not found.
 */
export const getPatientHealthRecord = async (patientUid) => {
    const recordRef = doc(db, "healthRecords", patientUid);
    try {
        const docSnap = await getDoc(recordRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            console.log("No health record found for patient:", patientUid);
            return null; // Return null instead of throwing an error
        }
    } catch (error) {
        console.error("Error fetching patient health record:", error);
        throw error;
    }
};


/**
 * Updates the personal details section of a patient's health record.
 * This function is intended to be used by the patient.
 * @param {string} patientUid - The UID of the patient.
 * @param {object} personalData - An object containing the fields to update.
 * @returns {object} The data that was sent for the update.
 */
export const updatePersonalDetails = async (patientUid, personalData) => {
  const recordRef = doc(db, "healthRecords", patientUid);
  
  const updateData = {
    ...personalData, // Includes bloodType, emergencyContact, etc.
    personalDetailsLastUpdated: new Date().toISOString()
  };
  
  try {
    await updateDoc(recordRef, updateData);
    console.log("Personal details updated successfully for patient:", patientUid);
    return updateData;
  } catch (error) {
    console.error("Error updating personal details:", error);
    throw error;
  }
};


/**
 * Updates the medical information section of a patient's record.
 * This is a comprehensive function intended for use by doctors during appointments.
 * @param {string} patientUid - The UID of the patient.
 * @param {object} updates - An object containing arrays of new medical info (allergies, medications, etc.).
 * @param {object} doctorInfo - An object with the doctor's UID and name.
 * @returns {object} The payload that was sent for the update.
 */
export const updatePatientMedicalInfo = async (patientUid, updates, doctorInfo) => {
  const recordRef = doc(db, "healthRecords", patientUid);
  
  try {
    const docSnap = await getDoc(recordRef);
    if (!docSnap.exists()) {
      throw new Error("Patient health record not found, cannot update medical info.");
    }
    
    const currentData = docSnap.data();
    const updatePayload = {
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: doctorInfo.name
    };
    
    // Add new allergies if provided
    if (updates.allergies && updates.allergies.length > 0) {
      updatePayload.allergies = [...(currentData.allergies || []), ...updates.allergies.map(allergy => ({
        ...allergy,
        addedBy: doctorInfo.uid,
        addedDate: new Date().toISOString()
      }))];
    }
    
    // Add new medications if provided
    if (updates.medications && updates.medications.length > 0) {
      updatePayload.currentMedications = [...(currentData.currentMedications || []), ...updates.medications.map(med => ({
        ...med,
        prescribedBy: doctorInfo.uid,
        prescribedDate: new Date().toISOString()
      }))];
    }
    
    // Add new chronic conditions if provided
    if (updates.conditions && updates.conditions.length > 0) {
      updatePayload.chronicConditions = [...(currentData.chronicConditions || []), ...updates.conditions.map(condition => ({
        ...condition,
        addedBy: doctorInfo.uid,
        addedDate: new Date().toISOString()
      }))];
    }
    
    // Add a new medical history entry if provided
    if (updates.historyEntry) {
      updatePayload.medicalHistory = [...(currentData.medicalHistory || []), {
        ...updates.historyEntry,
        doctorId: doctorInfo.uid,
        date: updates.historyEntry.date || new Date().toISOString().split('T')[0]
      }];
    }
    
    await updateDoc(recordRef, updatePayload);
    console.log("Patient medical information updated successfully by doctor:", doctorInfo.uid);
    return updatePayload;
  } catch (error) {
    console.error("Error updating patient medical info:", error);
    throw error;
  }
};

// ==================================================================
// START: NEW BLOCKCHAIN INTEGRATION CODE
// ==================================================================
import { ethers } from "ethers";
import CryptoJS from 'crypto-js';

// --- PASTE YOUR DEPLOYED CONTRACT DETAILS HERE ---
const contractAddress = "0xF6b95638D2864205354Db252670054e02a3416D3";
const contractABI = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_patientId",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_recordHash",
				"type": "string"
			}
		],
		"name": "addRecordHash",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "string",
				"name": "patientId",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "recordHash",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			}
		],
		"name": "RecordUpdated",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_patientId",
				"type": "string"
			}
		],
		"name": "getLatestRecordHash",
		"outputs": [
			{
				"components": [
					{
						"internalType": "string",
						"name": "recordHash",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "timestamp",
						"type": "uint256"
					}
				],
				"internalType": "struct HealthRecordLedger.RecordUpdate",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "patientRecords",
		"outputs": [
			{
				"internalType": "string",
				"name": "recordHash",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];
// ----------------------------------------------------

/**
 * Takes a full health record object, calculates its hash, and stores it on the blockchain.
 * This creates a verifiable, timestamped snapshot of the patient's record.
 * @param {string} patientUid - The UID of the patient.
 * @param {object} fullHealthRecord - The complete, current health record object.
 * @returns {object} An object indicating success and containing the transaction hash.
 */
export const notarizeHealthRecordOnChain = async (patientUid, fullHealthRecord) => {
  // 1. Ensure we have a valid record to process.
  if (!patientUid || !fullHealthRecord) {
    throw new Error("Patient UID and health record data are required to notarize.");
  }
  console.log("Notarizing the following record for patient:", patientUid, fullHealthRecord);

  // 2. Calculate the SHA-256 hash of the entire record.
  // We stringify with consistent key order to ensure the hash is deterministic.
  const recordString = JSON.stringify(fullHealthRecord, Object.keys(fullHealthRecord).sort());
  const recordHash = CryptoJS.SHA256(recordString).toString();
  console.log(`Calculated Hash: ${recordHash}`);

  // 3. Send the hash to the blockchain via MetaMask.
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed. Please install it to use this feature.");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, contractABI, signer);

    console.log(`Sending hash to smart contract for patient ID: ${patientUid}`);
    const tx = await contract.addRecordHash(patientUid, recordHash);
    
    // Wait for the transaction to be confirmed on the blockchain
    await tx.wait(); 
    
    console.log("Notarization transaction successful!", tx);
    return { success: true, txHash: tx.hash, recordHash: recordHash };

  } catch (error) {
    console.error("Blockchain notarization failed:", error);
    // We re-throw the error so the component can display a message to the user.
    throw error;
  }
};
// ==================================================================
// END: NEW BLOCKCHAIN INTEGRATION CODE
// ==================================================================