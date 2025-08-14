import {
  doc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  deleteDoc,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db } from '../firebase';

class AppointmentSessionService {
  constructor(appointmentId) {
    this.appointmentId = appointmentId;
    this.appointmentRef = doc(db, "appointments", appointmentId);
    this.messagesRef = collection(db, "appointments", appointmentId, "messages");
    this.unsubscribeAppointment = null;
    this.unsubscribeMessages = null;
  }

  // Start the appointment session
  async startSession(doctorId) {
    try {
      await updateDoc(this.appointmentRef, {
        sessionStatus: 'active',
        sessionStartTime: serverTimestamp(),
        sessionDuration: 10000, // 10 seconds for testing
        startedBy: doctorId
      });
      return { success: true };
    } catch (error) {
      console.error("Error starting session:", error);
      return { success: false, error: error.message };
    }
  }

  // End the appointment session and clean up
  async endSession(userId, reason = 'completed') {
    try {
      const batch = writeBatch(db);

      // Update appointment status to 'ended'.
      // Note: We are deleting the appointment right after, so this status is short-lived.
      // It can be useful for logging or if you decide not to delete appointments immediately.
      batch.update(this.appointmentRef, {
        sessionStatus: 'ended',
        sessionEndTime: serverTimestamp(),
        endedBy: userId,
        endReason: reason
      });

      // Delete the appointment document
      batch.delete(this.appointmentRef);

      await batch.commit();

      return { success: true };
    } catch (error) {
      console.error("Error ending session:", error);
      return { success: false, error: error.message };
    }
  }

  // Send a message in the chat
  async sendMessage(senderId, senderName, senderRole, messageText) {
    try {
      await addDoc(this.messagesRef, {
        senderId,
        senderName,
        senderRole,
        message: messageText,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      });
      return { success: true };
    } catch (error) {
      console.error("Error sending message:", error);
      return { success: false, error: error.message };
    }
  }

  // Listen for appointment updates
  subscribeToAppointment(callback) {
    this.unsubscribeAppointment = onSnapshot(this.appointmentRef,
      (doc) => {
        if (doc.exists()) {
          callback({ exists: true, data: doc.data() });
        } else {
          callback({ exists: false, data: null });
        }
      },
      (error) => {
        console.error("Error listening to appointment:", error);
        callback({ exists: false, data: null, error: error.message });
      }
    );
  }

  // Listen for chat messages
  subscribeToMessages(callback) {
    const messagesQuery = query(this.messagesRef, orderBy("createdAt", "asc"));

    this.unsubscribeMessages = onSnapshot(messagesQuery,
      (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        callback(messages);
      },
      (error) => {
        console.error("Error listening to messages:", error);
        callback([]);
      }
    );
  }

  // Clean up listeners
  cleanup() {
    if (this.unsubscribeAppointment) {
      this.unsubscribeAppointment();
      this.unsubscribeAppointment = null;
    }
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
      this.unsubscribeMessages = null;
    }
  }

  // Auto-end session after duration
  startSessionTimer(onTimeUp) {
    return setTimeout(() => {
      onTimeUp();
    }, 10000); // 10 seconds
  }
}

export default AppointmentSessionService;
