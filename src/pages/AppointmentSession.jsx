import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, User, Calendar, Clock, Stethoscope,
  FileText, Plus, Save, AlertCircle, CheckCircle,Fingerprint,
  Activity, Heart, Pill, AlertTriangle
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  getAppointmentDetails, 
  updateAppointmentSessionStatus, 
  completeAppointmentSession, 
  updatePatientMedicalInfoInSession,
  storeBlockchainTransactionHash 
} from '../services/AppointmentSessionService';
import { getPatientHealthRecord, notarizeHealthRecordOnChain } from '../services/healthRecordService';

const AppointmentSession = ({ userProfile, appointmentId, onEndSession }) => {
  const [appointment, setAppointment] = useState(null);
  const [healthRecord, setHealthRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Doctor's medical update forms
  const [newAllergy, setNewAllergy] = useState({ name: '', severity: '', reaction: '' });
  const [newMedication, setNewMedication] = useState({ name: '', dosage: '', frequency: '', instructions: '' });
  const [newCondition, setNewCondition] = useState({ name: '', diagnosedDate: '', severity: '', notes: '' });
  const [newHistoryEntry, setNewHistoryEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    diagnosis: '',
    treatment: '',
    notes: ''
  });
  const [notarizing, setNotarizing] = useState(false);
  const [notarizeMessage, setNotarizeMessage] = useState('');
  const isDoctor = userProfile.role === 'doctor';

  // UPDATED handleNotarizeRecord function with extensive debugging
  const handleNotarizeRecord = async () => {
    console.log("=== NOTARIZATION DEBUG START ===");
    console.log("1. Health record exists:", !!healthRecord);
    console.log("2. Appointment ID:", appointmentId);
    console.log("3. Patient ID:", appointment?.patientId);
    
    if (!healthRecord) {
      console.error("4. ERROR: No health record data");
      alert("No health record data to notarize.");
      return;
    }

    setNotarizing(true);
    setNotarizeMessage('');
    
    try {
      console.log("5. Starting blockchain notarization...");
      // Calls the function from your service file
      const result = await notarizeHealthRecordOnChain(appointment.patientId, healthRecord);
      console.log("6. Blockchain notarization result:", result);
      console.log("7. Transaction hash:", result.txHash);
      
      if (!result.txHash) {
        throw new Error("No transaction hash received from blockchain");
      }
      
      console.log("8. Calling storeBlockchainTransactionHash...");
      // Store the transaction hash in Firebase
      await storeBlockchainTransactionHash(appointmentId, result.txHash);
      console.log("9. Successfully stored hash in Firebase");
      
      // Update the local appointment state to reflect the notarization
      setAppointment(prev => {
        const updated = {
          ...prev,
          blockchainTransactionHash: result.txHash,
          notarizedAt: new Date(),
          isNotarized: true
        };
        console.log("10. Updated local appointment state:", updated);
        return updated;
      });
      
      setNotarizeMessage(`Success! Tx: ${result.txHash.substring(0, 12)}... (Hash saved to record)`);
      console.log("11. SUCCESS: Notarization complete");
      
    } catch (error) {
      console.error("12. NOTARIZATION ERROR:", error);
      console.error("13. Error message:", error.message);
      console.error("14. Error stack:", error.stack);
      setNotarizeMessage(`Error: ${error.message}`);
    } finally {
      setNotarizing(false);
      setTimeout(() => setNotarizeMessage(''), 6000);
      console.log("=== NOTARIZATION DEBUG END ===");
    }
  };

  // Real-time listener for appointment status changes
  useEffect(() => {
    if (!appointmentId) return;

    const appointmentRef = doc(db, "appointments", appointmentId);
    const unsubscribe = onSnapshot(appointmentRef, (doc) => {
      if (doc.exists()) {
        const appointmentData = doc.data();
        console.log("Real-time appointment update:", appointmentData);
        
        // Check if session was completed by doctor
        if (appointmentData.sessionStatus === 'completed' && !isDoctor) {
          console.log("Session completed by doctor, redirecting patient...");
          onEndSession();
          return;
        }
        
        // Update appointment state
        setAppointment(prev => prev ? { ...prev, ...appointmentData } : null);
      }
    }, (error) => {
      console.error("Error listening to appointment changes:", error);
    });

    return () => unsubscribe();
  }, [appointmentId, isDoctor, onEndSession]);

  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        setLoading(true);
        const appointmentData = await getAppointmentDetails(appointmentId);

        if (!appointmentData) {
          console.error("ERROR: appointmentData is null/undefined");
          setLoading(false);
          return;
        }

        console.log("Fetched appointment data:", appointmentData);
        setAppointment(appointmentData);

        const patientId = isDoctor ? appointmentData.patientId : userProfile.uid;
        const healthData = await getPatientHealthRecord(patientId);
        setHealthRecord(healthData);

        if (isDoctor && appointmentData.sessionStatus !== 'active') {
          await updateAppointmentSessionStatus(appointmentId, 'active');
          setAppointment(prev => ({ ...prev, sessionStatus: 'active' }));
        }

      } catch (error) {
        console.error("CATCH ERROR in fetchSessionData:", error);
      } finally {
        setLoading(false);
      }
    };

    if (appointmentId && userProfile) {
      fetchSessionData();
    } else {
      setLoading(false);
    }
  }, [appointmentId, userProfile, isDoctor]);

  const handleAddMedicalInfo = async (type) => {
    if (!isDoctor) return;

    try {
      setUpdating(true);
      const doctorInfo = { uid: userProfile.uid, name: userProfile.name };
      const updates = {};

      switch (type) {
        case 'allergy':
          if (newAllergy.name.trim()) {
            updates.allergies = [newAllergy];
            setNewAllergy({ name: '', severity: '', reaction: '' });
          }
          break;
        case 'medication':
          if (newMedication.name.trim()) {
            updates.medications = [newMedication];
            setNewMedication({ name: '', dosage: '', frequency: '', instructions: '' });
          }
          break;
        case 'condition':
          if (newCondition.name.trim()) {
            updates.conditions = [newCondition];
            setNewCondition({ name: '', diagnosedDate: '', severity: '', notes: '' });
          }
          break;
        case 'history':
          if (newHistoryEntry.description.trim()) {
            updates.historyEntry = newHistoryEntry;
            setNewHistoryEntry({
              date: new Date().toISOString().split('T')[0],
              description: '',
              diagnosis: '',
              treatment: '',
              notes: ''
            });
          }
          break;
        default:
         break;
      }

      if (Object.keys(updates).length > 0) {
        await updatePatientMedicalInfoInSession(appointment.patientId, updates, doctorInfo);

        const updatedHealthRecord = await getPatientHealthRecord(appointment.patientId);
        setHealthRecord(updatedHealthRecord);

        setSaveMessage('Medical information updated successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (error) {
      console.error("Error updating medical info:", error);
      setSaveMessage('Error updating medical information. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  // UPDATED handleCompleteSession with debug logging
  const handleCompleteSession = async () => {
    if (!isDoctor) return;

    try {
      setUpdating(true);
      console.log("Completing session with hash:", appointment?.blockchainTransactionHash);
      
      // Pass the blockchain transaction hash if it exists
      await completeAppointmentSession(
        appointmentId, 
        null, // sessionNotes - you can add a form for this if needed
        appointment?.blockchainTransactionHash // This will be included if the record was notarized
      );
      
      onEndSession(); // Redirect doctor immediately
    } catch (error) {
      console.error("Error completing session:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleEndSession = () => {
    onEndSession();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading appointment session...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-xl text-gray-600">Appointment not found</p>
          <button
            onClick={handleEndSession}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center">
                <button
                    onClick={handleEndSession}
                    className="p-3 bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 hover:bg-white transition-all duration-300 group mr-4"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-blue-600"/>
                </button>
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
                        Appointment Session
                    </h1>
                    <div className="flex items-center text-gray-600 mt-1">
                        <div className={`w-2 h-2 rounded-full mr-2 ${appointment.sessionStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`}></div>
                        {appointment.sessionStatus === 'active' ? 'Session Active' : 'Session Ready'}
                    </div>
                </div>
            </div>
            <div className="flex items-center space-x-4">
              {saveMessage && (
                <div className="flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm">{saveMessage}</span>
                </div>
              )}
              {notarizeMessage && (
                <div className={`flex items-center px-3 py-1 ${notarizeMessage.startsWith('Success') ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-800'} rounded-full`}>
                  {notarizeMessage.startsWith('Success') ? <CheckCircle className="w-4 h-4 mr-1" /> : <AlertCircle className="w-4 h-4 mr-1" />}
                  <span className="text-sm">{notarizeMessage}</span>
                </div>
              )}
              {isDoctor && (
                <button
                  onClick={handleNotarizeRecord}
                  disabled={notarizing || updating || appointment?.isNotarized}
                  className={`py-3 px-6 rounded-xl text-white font-semibold transform hover:scale-105 transition-all duration-300 shadow-lg flex items-center justify-center disabled:opacity-50 ${
                    appointment?.isNotarized 
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600' 
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                  }`}
                >
                  <Fingerprint className="w-4 h-4 mr-2" />
                  {appointment?.isNotarized 
                    ? 'Already Notarized' 
                    : notarizing 
                      ? 'Notarizing...' 
                      : 'Notarize on Blockchain'
                  }
                </button>
              )}
              {isDoctor && (
                <button
                  onClick={handleCompleteSession}
                  disabled={updating}
                  className="py-3 px-6 rounded-xl text-white font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transform hover:scale-105 transition-all duration-300 shadow-lg flex items-center justify-center disabled:opacity-50"
                >
                  {updating ? 'Completing...' : 'Complete Session'}
                </button>
              )}
            </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Appointment Info & Patient Problem */}
          <div className="lg:col-span-1 space-y-6">
            {/* Appointment Details Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Calendar className="w-6 h-6 mr-2 text-blue-600" />
                Appointment Details
              </h2>

              <div className="space-y-4">
                <div className="flex items-center">
                  <User className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">
                      {isDoctor ? 'Patient' : 'Doctor'}
                    </p>
                    <p className="font-semibold text-gray-800">
                      {isDoctor ? appointment.patientName : appointment.doctorName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-semibold text-gray-800">{appointment.appointmentDate}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Time</p>
                    <p className="font-semibold text-gray-800">{appointment.appointmentTime}</p>
                  </div>
                </div>

                {appointment.doctorSpecialization && (
                  <div className="flex items-center">
                    <Stethoscope className="w-5 h-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Specialization</p>
                      <p className="font-semibold text-gray-800">{appointment.doctorSpecialization}</p>
                    </div>
                  </div>
                )}

                {/* Blockchain Notarization Status */}
                {appointment.isNotarized && (
                  <div className="flex items-center p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
                    <Fingerprint className="w-5 h-5 text-indigo-600 mr-3" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-indigo-800">Blockchain Notarized</p>
                      <p className="text-xs text-indigo-600">
                        TX: {appointment.blockchainTransactionHash?.substring(0, 16)}...
                      </p>
                      {appointment.notarizedAt && (
                        <p className="text-xs text-gray-500">
                          {new Date(appointment.notarizedAt.seconds ? appointment.notarizedAt.seconds * 1000 : appointment.notarizedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Patient Problem Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <FileText className="w-6 h-6 mr-2 text-red-600" />
                {isDoctor ? 'Patient Problem' : 'Your Problem'}
              </h2>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-gray-800 leading-relaxed">
                  {appointment.problem || 'No problem description provided.'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Health Records */}
          <div className="lg:col-span-2">
            {/* Rest of your health records component remains the same... */}
            {/* I'm truncating this for brevity, but include all your existing health records JSX here */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentSession;