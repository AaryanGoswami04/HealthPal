/**
 * Stores payment transaction details for an appointment
 * @param {string} appointmentId - The appointment ID
 * @param {string} txHash - Transaction hash
 * @param {Object} paymentDetails - Additional payment details
 * @returns {Promise} Promise that resolves when payment is stored
 */
export const storePaymentTransaction = async (appointmentId, txHash, paymentDetails) => {
  try {
    const appointmentRef = doc(db, "appointments", appointmentId);
    await updateDoc(appointmentRef, {
      paymentVerified: true,
      paymentTxHash: txHash,
      paymentDetails: {
        from: paymentDetails.from,
        amount: paymentDetails.amount,
        blockNumber: paymentDetails.blockNumber,
        timestamp: paymentDetails.timestamp
      },
      paidAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`Payment transaction ${txHash} stored for appointment ${appointmentId}`);
  } catch (error) {
    console.error("Error storing payment transaction:", error);
    throw error;
  }
};

/**
 * Stores payment details for an appointment
 * @param {string} appointmentId - The appointment ID
 * @param {Object} paymentDetails - Payment transaction details
 * @returns {Promise} Promise that resolves when payment is stored
 */
export const storePaymentDetails = async (appointmentId, paymentDetails) => {
  try {
    const appointmentRef = doc(db, "appointments", appointmentId);
    await updateDoc(appointmentRef, {
      paymentCompleted: true,
      paymentDetails: {
        transactionHash: paymentDetails.transactionHash,
        amount: paymentDetails.amount,
        from: paymentDetails.from,
        to: paymentDetails.to,
        timestamp: paymentDetails.timestamp,
        blockNumber: paymentDetails.blockNumber
      },
      paidAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`Payment details stored for appointment ${appointmentId}`);
  } catch (error) {
    console.error("Error storing payment details:", error);
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