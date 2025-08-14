// src/services/doctorPatientService.js
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from '../firebase';

/**
 * Fetches all patients that have scheduled appointments with a specific doctor.
 * This includes both upcoming appointments and appointment requests.
 * @param {string} doctorId - The doctor's ID
 * @returns {Array} Array of unique patients with their appointment details
 */
export const getDoctorPatients = async (doctorId) => {
  try {
    // Get confirmed appointments
    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("doctorId", "==", doctorId)
    );
    
    // Get pending appointment requests
    const requestsQuery = query(
      collection(db, "appointment_requests"),
      where("doctorId", "==", doctorId)
    );

    const [appointmentsSnapshot, requestsSnapshot] = await Promise.all([
      getDocs(appointmentsQuery),
      getDocs(requestsQuery)
    ]);

    const patientsMap = new Map();

    // Process confirmed appointments
    appointmentsSnapshot.forEach((doc) => {
      const data = doc.data();
      const patientKey = data.patientId;
      
      if (!patientsMap.has(patientKey) || 
          new Date(data.appointmentDate) > new Date(patientsMap.get(patientKey).appointmentDate)) {
        patientsMap.set(patientKey, {
          patientId: data.patientId,
          patientName: data.patientName,
          appointmentDate: data.appointmentDate,
          appointmentTime: data.appointmentTime,
          problem: data.problem || '',
          status: data.status || 'confirmed',
          type: 'appointment'
        });
      }
    });

    // Process pending requests (only add if not already in appointments or if more recent)
    requestsSnapshot.forEach((doc) => {
      const data = doc.data();
      const patientKey = data.patientId;
      
      if (!patientsMap.has(patientKey) || 
          new Date(data.appointmentDate) > new Date(patientsMap.get(patientKey).appointmentDate)) {
        patientsMap.set(patientKey, {
          patientId: data.patientId,
          patientName: data.patientName,
          appointmentDate: data.appointmentDate,
          appointmentTime: data.appointmentTime,
          problem: data.problem || '',
          status: data.status || 'pending',
          type: 'request'
        });
      }
    });

    // Convert map to array and sort by appointment date (most recent first)
    const patients = Array.from(patientsMap.values()).sort((a, b) => 
      new Date(b.appointmentDate) - new Date(a.appointmentDate)
    );

    console.log(`Found ${patients.length} unique patients for doctor ${doctorId}`);
    return patients;
  } catch (error) {
    console.error("Error fetching doctor patients:", error);
    throw error;
  }
};

/**
 * Fetches a patient's health record. This is a wrapper around the existing function
 * but with doctor-specific access logic.
 * @param {string} patientId - The patient's ID
 * @returns {Object|null} The health record data or null if not found
 */
export const getPatientHealthRecord = async (patientId) => {
  try {
    const recordRef = doc(db, "healthRecords", patientId);
    const docSnap = await getDoc(recordRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("No health record found for patient:", patientId);
      return {
        patientId: patientId,
        bloodType: '',
        emergencyContact: '',
        emergencyContactName: '',
        address: '',
        dateOfBirth: '',
        allergies: [],
        chronicConditions: [],
        currentMedications: [],
        medicalHistory: []
      };
    }
  } catch (error) {
    console.error("Error fetching patient health record:", error);
    throw error;
  }
};

/**
 * Fetches detailed patient information including user profile data.
 * @param {string} patientId - The patient's ID
 * @returns {Object|null} The patient's profile data
 */
export const getPatientProfile = async (patientId) => {
  try {
    const userRef = doc(db, "users", patientId);
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
      return { id: patientId, ...docSnap.data() };
    } else {
      console.log("No profile found for patient:", patientId);
      return null;
    }
  } catch (error) {
    console.error("Error fetching patient profile:", error);
    throw error;
  }
};