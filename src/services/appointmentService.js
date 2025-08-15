// import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc, writeBatch } from "firebase/firestore";
import { db } from '../firebase';

/**
 * Fetches all doctors from the 'users' collection in Firestore.
 * @returns {Array} Array of doctor user objects.
 */
export const fetchDoctors = async () => {
  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "doctor")
    );
    
    const querySnapshot = await getDocs(q);
    const doctors = [];
    
    querySnapshot.forEach((doc) => {
      doctors.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Found ${doctors.length} doctors`);
    return doctors;
  } catch (error) {
    console.error("Error fetching doctors:", error);
    throw error;
  }
};

/**
 * Searches doctors by name or specialization from the fetched list.
 * @param {string} searchTerm - The search term
 * @param {Array} doctorsList - The full list of doctors to search
 * @returns {Array} Filtered array of doctors
 */
export const searchDoctors = (searchTerm, doctorsList) => {
  if (!searchTerm.trim()) return doctorsList;
  
  const term = searchTerm.toLowerCase();
  return doctorsList.filter(doctor => 
    doctor.name.toLowerCase().includes(term) ||
    doctor.specialization.toLowerCase().includes(term)
  );
};

/**
 * Gets available time slots for a specific date and doctor.
 * Checks both confirmed appointments and pending requests to determine availability.
 * @param {string} date - The date in YYYY-MM-DD format
 * @param {string} doctorId - The doctor's ID
 * @returns {Array} Array of available time slots
 */
export const getAvailableTimeSlots = async (date, doctorId) => {
  console.log(`Fetching slots for Dr: ${doctorId} on ${date}`);
  
  const allSlots = [
    "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
    "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"
  ];
  
  try {
    const confirmedQuery = query(
      collection(db, "appointments"),
      where("doctorId", "==", doctorId),
      where("appointmentDate", "==", date)
    );
    
    const pendingQuery = query(
      collection(db, "appointment_requests"),
      where("doctorId", "==", doctorId),
      where("appointmentDate", "==", date),
      where("status", "==", "pending_approval")
    );
    
    const [confirmedSnapshot, pendingSnapshot] = await Promise.all([
      getDocs(confirmedQuery),
      getDocs(pendingQuery)
    ]);
    
    const bookedSlots = new Set();
    
    confirmedSnapshot.forEach((doc) => {
      const data = doc.data();
      bookedSlots.add(data.appointmentTime);
    });
    
    pendingSnapshot.forEach((doc) => {
      const data = doc.data();
      bookedSlots.add(data.appointmentTime);
    });
    
    const availableSlots = allSlots.filter(slot => !bookedSlots.has(slot));
    
    console.log(`Available slots for ${date}:`, availableSlots);
    return availableSlots;
    
  } catch (error) {
    console.error("Error fetching available time slots:", error);
    return allSlots;
  }
};

/**
 * Fetches a patient's health record from Firestore.
 * @param {string} patientId - The patient's ID
 * @returns {Object|null} The health record data or null if not found
 */
export const getHealthRecord = async (patientId) => {
  try {
    const docRef = doc(db, "healthRecords", patientId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("No health record found for this patient.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching health record:", error);
    throw error;
  }
};

/**
 * Creates a new appointment request in Firestore, including health record details.
 * @param {Object} requestData - The appointment request data
 * @param {Object} healthRecordData - The patient's health record details
 * @returns {Promise} Promise that resolves when the request is created
 */
export const createAppointmentRequest = async (requestData, healthRecordData) => {
  try {
    const appointmentRequest = {
      ...requestData,
      healthRecords: healthRecordData, // Include the health records here
      status: 'pending_approval',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, "appointment_requests"), appointmentRequest);
    console.log("Appointment request created with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error creating appointment request:", error);
    throw error;
  }
};

/**
 * Fetches all pending appointment requests for a specific doctor.
 * @param {string} doctorId - The doctor's ID
 * @returns {Array} Array of pending appointment request objects
 */
export const getPendingAppointmentRequests = async (doctorId) => {
  try {
    const q = query(
      collection(db, "appointment_requests"),
      where("doctorId", "==", doctorId),
      where("status", "==", "pending_approval")
    );
    const querySnapshot = await getDocs(q);
    const requests = [];
    querySnapshot.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() });
    });
    console.log(`Found ${requests.length} pending requests for doctor ${doctorId}`);
    return requests;
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    throw error;
  }
};

/**
 * Approves an appointment request and moves it to the 'appointments' collection.
 * @param {string} requestId - The ID of the pending request
 * @param {object} requestData - The data of the pending request
 */
export const approveAppointmentRequest = async (requestId, requestData) => {
  // Use a batch write for an atomic operation (both actions succeed or both fail)
  const batch = writeBatch(db);

  try {
    // 1. Create a reference for the new document in the 'appointments' collection
    const newAppointmentRef = doc(collection(db, "appointments"));

    // 2. Explicitly build the new appointment object to ensure names are included
    const confirmedAppointment = {
      patientId: requestData.patientId,
      patientName: requestData.patientName,
      doctorId: requestData.doctorId,
      doctorName: requestData.doctorName,
      appointmentDate: requestData.appointmentDate,
      appointmentTime: requestData.appointmentTime,
      problem: requestData.problem,
      doctorSpecialization: requestData.doctorSpecialization,
      healthRecords: requestData.healthRecords, // Keep health records if needed
      status: 'upcoming',
      sessionStatus: 'waiting',
      createdAt: new Date(),
    };

    // 3. Add the 'set' operation for the new appointment to the batch
    batch.set(newAppointmentRef, confirmedAppointment);

    // 4. Create a reference to the request document that will be deleted
    const requestRef = doc(db, "appointment_requests", requestId);

    // 5. Add the 'delete' operation to the batch
    batch.delete(requestRef);

    // 6. Commit both operations at the same time
    await batch.commit();

    console.log(`Approved request ${requestId}. New appointment created.`);

  } catch (error) {
    console.error("Error approving appointment request:", error);
    throw error;
  }
};

/**
 * Rejects an appointment request by simply deleting it.
 * @param {string} requestId - The ID of the pending request
 */
export const rejectAppointmentRequest = async (requestId) => {
  try {
    await deleteDoc(doc(db, "appointment_requests", requestId));
    console.log(`Rejected and deleted request ${requestId}.`);
  } catch (error) {
    console.error("Error rejecting appointment request:", error);
    throw error;
  }
};

/**
 * Fetches appointments for a specific user (doctor or patient)
 * @param {string} userId - The user's ID
 * @param {string} userRole - The user's role ('doctor' or 'patient')
 * @param {string} status - The appointment status ('upcoming', 'completed', 'cancelled')
 * @returns {Array} Array of appointment objects
 */
export const getAppointments = async (userId, userRole, status = 'upcoming') => {
  try {
    let q;
    
    if (userRole === 'doctor') {
      q = query(
        collection(db, "appointments"),
        where("doctorId", "==", userId),
        where("status", "==", status)
      );
    } else {
      q = query(
        collection(db, "appointments"),
        where("patientId", "==", userId),
        where("status", "==", status)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const appointments = [];
    
    querySnapshot.forEach((doc) => {
      appointments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort appointments by date and time
    appointments.sort((a, b) => {
      const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`);
      const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`);
      return dateA - dateB;
    });
    
    console.log(`Found ${appointments.length} ${status} appointments for ${userRole} ${userId}`);
    return appointments;
  } catch (error) {
    console.error("Error fetching appointments:", error);
    throw error;
  }
};