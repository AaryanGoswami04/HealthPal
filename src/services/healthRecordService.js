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
