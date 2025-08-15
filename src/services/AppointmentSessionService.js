import { doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from '../firebase';
import { updatePatientMedicalInfo } from './healthRecordService';

/**
 * Fetches complete appointment details including patient info
 * @param {string} appointmentId - The appointment ID
 * @returns {Object|null} Complete appointment data or null if not found
 */
export const getAppointmentDetails = async (appointmentId) => {
  try {
    console.log("=== getAppointmentDetails Debug ===");
    console.log("1. Appointment ID received:", appointmentId);
    console.log("2. DB instance:", db);
    
    if (!appointmentId) {
      console.error("3. ERROR: No appointment ID provided");
      return null;
    }
    
    console.log("4. Creating document reference...");
    const appointmentRef = doc(db, "appointments", appointmentId);
    console.log("5. Document reference created:", appointmentRef);
    console.log("6. Document path:", appointmentRef.path);
    
    console.log("7. Attempting to fetch document...");
    const appointmentSnap = await getDoc(appointmentRef);
    console.log("8. Document snapshot received:", appointmentSnap);
    console.log("9. Document exists:", appointmentSnap.exists());
    
    if (appointmentSnap.exists()) {
      const appointmentData = appointmentSnap.data();
      console.log("10. SUCCESS: Document data:", appointmentData);
      return {
        id: appointmentId,
        ...appointmentData
      };
    } else {
      console.log("11. ERROR: Document does not exist");
      console.log("12. Document path checked:", `appointments/${appointmentId}`);
      console.log("13. Snapshot metadata:", appointmentSnap.metadata);
      return null;
    }
  } catch (error) {
    console.error("14. CATCH ERROR in getAppointmentDetails:", error);
    console.error("15. Error message:", error.message);
    console.error("16. Error code:", error.code);
    console.error("17. Full error:", error);
    throw error;
  }
};

/**
 * Updates appointment session status
 * @param {string} appointmentId - The appointment ID
 * @param {string} sessionStatus - New session status ('waiting', 'active', 'completed')
 * @returns {Promise} Promise that resolves when update is complete
 */
export const updateAppointmentSessionStatus = async (appointmentId, sessionStatus) => {
  try {
    const appointmentRef = doc(db, "appointments", appointmentId);
    await updateDoc(appointmentRef, {
      sessionStatus: sessionStatus,
      updatedAt: new Date()
    });
    console.log(`Appointment ${appointmentId} session status updated to: ${sessionStatus}`);
  } catch (error) {
    console.error("Error updating appointment session status:", error);
    throw error;
  }
};

/**
 * Completes an appointment session
 * @param {string} appointmentId - The appointment ID
 * @param {Object} sessionNotes - Optional notes about the session
 * @returns {Promise} Promise that resolves when appointment is completed
 */
export const completeAppointmentSession = async (appointmentId, sessionNotes = null) => {
  try {
    const appointmentRef = doc(db, "appointments", appointmentId);
    const updateData = {
      status: 'completed',
      sessionStatus: 'completed',
      completedAt: new Date(),
      updatedAt: new Date()
    };
    
    if (sessionNotes) {
      updateData.sessionNotes = sessionNotes;
    }
    
    await updateDoc(appointmentRef, updateData);
    console.log(`Appointment ${appointmentId} completed successfully`);
  } catch (error) {
    console.error("Error completing appointment session:", error);
    throw error;
  }
};

/**
 * Updates patient medical information during appointment session
 * @param {string} patientId - The patient's ID
 * @param {Object} medicalUpdates - Medical information to update
 * @param {Object} doctorInfo - Doctor information
 * @returns {Promise} Promise that resolves when update is complete
 */
export const updatePatientMedicalInfoInSession = async (patientId, medicalUpdates, doctorInfo) => {
  try {
    return await updatePatientMedicalInfo(patientId, medicalUpdates, doctorInfo);
  } catch (error) {
    console.error("Error updating patient medical info in session:", error);
    throw error;
  }
};