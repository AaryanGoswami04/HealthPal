import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Stethoscope,
  Send,
  PhoneOff,
  MessageCircle,
  Clock,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
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
  writeBatch,
  getDoc
} from "firebase/firestore";
import { db } from '../firebase';

// The inlined AppointmentSessionService class remains the same and is omitted for brevity.
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
      batch.update(this.appointmentRef, {
        sessionStatus: 'ended',
        sessionEndTime: serverTimestamp(),
        endedBy: userId,
        endReason: reason
      });
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
}


const AppointmentSession = ({ userProfile, appointmentId, onEndSession }) => {
  const [appointment, setAppointment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sessionStatus, setSessionStatus] = useState('waiting');
  const [timeRemaining, setTimeRemaining] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionHasEnded, setSessionHasEnded] = useState(false);
  const [patientProfile, setPatientProfile] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);

  const messagesEndRef = useRef(null);
  const sessionServiceRef = useRef(null);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  const isDoctor = userProfile.role === 'doctor';

  useEffect(() => {
    if (!appointmentId) {
      setError('No appointment ID provided');
      setIsLoading(false);
      return;
    }

    sessionServiceRef.current = new AppointmentSessionService(appointmentId);

    sessionServiceRef.current.subscribeToAppointment((appointmentData) => {
      if (appointmentData.exists) {
        const data = appointmentData.data;
        setAppointment(data);
        setSessionStatus(data.sessionStatus || 'waiting');

        if (data.sessionStatus === 'active' && !countdownRef.current) {
          startCountdown();
        }

        if (data.sessionStatus === 'ended') {
          setSessionHasEnded(true);
        }
      } else if (appointmentData.error) {
        setError(appointmentData.error);
      } else {
        if (sessionHasEnded) {
          setTimeout(() => onEndSession(), 1000);
        }
      }
      setIsLoading(false);
    });

    sessionServiceRef.current.subscribeToMessages((messagesList) => {
      setMessages(messagesList);
    });

    return () => {
      if (sessionServiceRef.current) sessionServiceRef.current.cleanup();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [appointmentId, onEndSession, sessionHasEnded]);
  
  useEffect(() => {
    const fetchParticipantDetails = async () => {
      console.log("Appointment data for session:", appointment);
      if (appointment?.patientId && appointment?.doctorId) {
        try {
          // Fetch patient profile
          const patientDocRef = doc(db, "users", appointment.patientId);
          const patientDocSnap = await getDoc(patientDocRef);
          if (patientDocSnap.exists()) {
            setPatientProfile(patientDocSnap.data());
          }

          // Fetch doctor profile
          const doctorDocRef = doc(db, "users", appointment.doctorId);
          const doctorDocSnap = await getDoc(doctorDocRef);
          if (doctorDocSnap.exists()) {
            setDoctorProfile(doctorDocSnap.data());
          }
        } catch (e) {
          console.error("Error fetching participant details:", e);
          setError("Could not load participant details.");
        }
      }
    };

    fetchParticipantDetails();
  }, [appointment]);


  useEffect(() => {
    if (isDoctor && appointment && appointment.sessionStatus === 'waiting' && !sessionHasEnded) {
      const start = async () => {
        if (sessionServiceRef.current) {
          const result = await sessionServiceRef.current.startSession(userProfile.uid);
          if (!result.success) setError('Failed to start session: ' + result.error);
        }
      };
      start();
    }
  }, [isDoctor, appointment, userProfile.uid, sessionHasEnded]);

  useEffect(() => {
    if (sessionHasEnded && sessionStatus === 'ended') {
      const redirectTimer = setTimeout(() => onEndSession(), 3000);
      return () => clearTimeout(redirectTimer);
    }
  }, [sessionHasEnded, sessionStatus, onEndSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startCountdown = () => {
    setTimeRemaining(10);
    countdownRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = setTimeout(() => handleEndSession('time_up'), 10000);
  };

  const handleEndSession = async (reason = 'manual') => {
    if (sessionHasEnded) return;
    setSessionHasEnded(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (sessionServiceRef.current) {
      const result = await sessionServiceRef.current.endSession(userProfile.uid, reason);
      if (!result.success) setError('Failed to end session: ' + result.error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || sessionStatus !== 'active' || sessionHasEnded) return;
    const result = await sessionServiceRef.current.sendMessage(
      userProfile.uid, userProfile.name, userProfile.role, newMessage.trim()
    );
    if (result.success) setNewMessage('');
    else setError('Failed to send message: ' + result.error);
  };

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50"><div className="text-center"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div><p className="text-xl text-gray-600">Loading session...</p></div></div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50"><div className="text-center p-8 bg-red-50 rounded-3xl border border-red-200"><AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" /><p className="text-xl text-red-600">{error}</p><button onClick={onEndSession} className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">Go Back</button></div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-start justify-between">
          <div className="flex items-center">
            <button
              onClick={() => handleEndSession('manual')}
              className="p-3 bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 hover:bg-white transition-all duration-300 group mr-4"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
            </button>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
                Appointment Session
              </h1>
              <p className="text-gray-600 mt-1">Live chat and consultation with your participant.</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {sessionStatus === 'active' && !sessionHasEnded && (
              <button
                onClick={() => handleEndSession('manual')}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 flex items-center"
              >
                <PhoneOff className="w-5 h-5 mr-2" />
                End Session
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/20">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Participants</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center mr-4"><User className="w-6 h-6 text-white" /></div>
                  <div>
                    {/* ### CORRECTED LINE ### */}
                    <p className="font-semibold text-gray-800">{patientProfile?.name || '...'}</p>
                    <p className="text-sm text-gray-600">Patient</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4"><Stethoscope className="w-6 h-6 text-white" /></div>
                  <div>
                    {/* ### CORRECTED LINE ### */}
                    <p className="font-semibold text-gray-800">{doctorProfile?.name || '...'}</p>
                    <p className="text-sm text-gray-600">Doctor</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 border-t border-gray-200/50 pt-4 space-y-3">
                  <div className={`text-center px-3 py-1 rounded-full text-sm font-semibold ${sessionStatus === 'waiting' ? 'bg-yellow-100 text-yellow-800' : sessionStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {sessionStatus === 'waiting' ? (isDoctor ? 'Starting Session...' : 'Waiting for Doctor...') : sessionStatus === 'active' ? 'Session Active' : 'Session Ended'}
                  </div>
                  {sessionStatus === 'active' && !sessionHasEnded && (
                    <div className="flex items-center justify-center text-blue-600">
                      <Clock className="w-4 h-4 mr-1" />
                      <span className="font-semibold">{formatTime(timeRemaining)}</span>
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 h-[600px] flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 flex items-center"><MessageCircle className="w-6 h-6 mr-2 text-blue-600" />Session Chat</h3>
                {sessionStatus === 'waiting' && (<p className="text-sm text-gray-500 mt-1">{isDoctor ? 'Starting the session...' : 'Waiting for doctor to start the session...'}</p>)}
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {sessionStatus === 'waiting' && (<div className="text-center text-gray-500 py-8"><MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Chat will be available once the session starts</p></div>)}
                {messages.map((message) => (<div key={message.id} className={`flex ${message.senderId === userProfile.uid ? 'justify-end' : 'justify-start'}`}><div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${message.senderId === userProfile.uid ? 'bg-gradient-to-r from-blue-600 to-teal-600 text-white' : 'bg-gray-100 text-gray-800'}`}><div className="flex items-center mb-1"><span className="text-xs font-semibold opacity-75">{message.senderName} ({message.senderRole})</span></div><p className="text-sm">{message.message}</p></div></div>))}
                <div ref={messagesEndRef} />
              </div>
              {sessionStatus === 'active' && !sessionHasEnded && (<div className="p-6 border-t border-gray-200"><form onSubmit={handleSendMessage} className="flex space-x-4"><input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type your message..." className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300" /><button type="submit" disabled={newMessage.trim() === ''} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-2xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"><Send className="w-5 h-5" /></button></form></div>)}
              {sessionHasEnded && (<div className="p-6 border-t border-gray-200 text-center"><p className="text-gray-600">Session has ended. Redirecting to home...</p><div className="mt-2"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div></div></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentSession;