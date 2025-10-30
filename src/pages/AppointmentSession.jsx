import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, User, Calendar, Clock, Stethoscope,
  FileText, Plus, Save, AlertCircle, CheckCircle, Fingerprint,
  Activity, Heart, Pill, AlertTriangle
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { 
  getAppointmentDetails, 
  updateAppointmentSessionStatus, 
  completeAppointmentSession, 
  updatePatientMedicalInfoInSession,
  storeBlockchainTransactionHash 
} from '../services/AppointmentSessionService';
import { getPatientHealthRecord, createNewHealthRecord, notarizeHealthRecordOnChain } from '../services/healthRecordService';

const AppointmentSession = ({ userProfile, appointmentId, onEndSession }) => {
  const [appointment, setAppointment] = useState(null);
  const [healthRecord, setHealthRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

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
  const isDoctor = userProfile?.role === 'doctor';

  // Authentication guard - Check auth FIRST before doing anything
  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    console.log("=== AUTHENTICATION CHECK ===");
    console.log("Current user:", currentUser);
    console.log("User profile passed:", userProfile);
    
    if (!currentUser) {
      console.error("❌ NO AUTHENTICATED USER FOUND");
      alert("Your session has expired. Please log in again.");
      onEndSession();
      return;
    }
    
    if (!userProfile || !userProfile.uid) {
      console.error("❌ NO USER PROFILE PROVIDED");
      alert("Unable to load user profile. Please try again.");
      onEndSession();
      return;
    }
    
    if (currentUser.uid !== userProfile.uid) {
      console.error("❌ USER MISMATCH", {
        authUid: currentUser.uid,
        profileUid: userProfile.uid
      });
      alert("Session mismatch detected. Please log in again.");
      onEndSession();
      return;
    }
    
    console.log("✅ Authentication verified successfully");
    console.log("User UID:", currentUser.uid);
    console.log("User email:", currentUser.email);
    setAuthChecked(true);
  }, [userProfile, onEndSession]);

  // UPDATED: Fetch data with proper health record handling
  useEffect(() => {
    if (!authChecked) {
      console.log("Waiting for authentication check...");
      return;
    }

    const fetchSessionData = async () => {
      try {
        setLoading(true);
        
        console.log("=== FETCHING SESSION DATA ===");
        console.log("Appointment ID:", appointmentId);
        console.log("User profile:", userProfile);
        
        const appointmentData = await getAppointmentDetails(appointmentId);

        if (!appointmentData) {
          console.error("❌ Appointment data is null/undefined");
          alert("Appointment not found. Please try again.");
          setLoading(false);
          return;
        }

        console.log("✅ Fetched appointment data:", appointmentData);
        setAppointment(appointmentData);

        // Determine which patient ID to use
        const patientId = isDoctor ? appointmentData.patientId : userProfile.uid;
        console.log("=== FETCHING HEALTH RECORD ===");
        console.log("Patient ID:", patientId);
        console.log("Is Doctor:", isDoctor);
        
        // Fetch health record with proper error handling
        try {
          console.log("Calling getPatientHealthRecord...");
          let healthData = await getPatientHealthRecord(patientId);
          
          if (!healthData) {
            console.warn("⚠️ No health record found, creating new one...");
            // Create a new health record if it doesn't exist
            healthData = await createNewHealthRecord(patientId);
            console.log("✅ New health record created:", healthData);
          } else {
            console.log("✅ Health record fetched successfully:", healthData);
          }
          
          setHealthRecord(healthData);
        } catch (healthError) {
          console.error("❌ Error fetching/creating health record:", healthError);
          console.error("Error code:", healthError.code);
          console.error("Error message:", healthError.message);
          
          // Show user-friendly error
          if (healthError.code === 'permission-denied') {
            alert("Unable to access health records. Please check your permissions.");
          } else {
            alert(`Error loading health records: ${healthError.message}`);
          }
          
          // Set an empty health record so the UI doesn't break
          setHealthRecord(null);
        }

        // Update session status if doctor
        if (isDoctor && appointmentData.sessionStatus !== 'active') {
          await updateAppointmentSessionStatus(appointmentId, 'active');
          setAppointment(prev => ({ ...prev, sessionStatus: 'active' }));
        }

      } catch (error) {
        console.error("❌ CATCH ERROR in fetchSessionData:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        alert(`Error loading appointment session: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (appointmentId && userProfile) {
      fetchSessionData();
    } else {
      console.error("❌ Missing required data:", { appointmentId, userProfile });
      setLoading(false);
    }
  }, [appointmentId, userProfile, isDoctor, authChecked]);

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
      const result = await notarizeHealthRecordOnChain(appointment.patientId, healthRecord);
      console.log("6. Blockchain notarization result:", result);
      console.log("7. Transaction hash:", result.txHash);
      
      if (!result.txHash) {
        throw new Error("No transaction hash received from blockchain");
      }
      
      console.log("8. Calling storeBlockchainTransactionHash...");
      await storeBlockchainTransactionHash(appointmentId, result.txHash);
      console.log("9. Successfully stored hash in Firebase");
      
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
    if (!appointmentId || !authChecked) return;

    const appointmentRef = doc(db, "appointments", appointmentId);
    const unsubscribe = onSnapshot(appointmentRef, (doc) => {
      if (doc.exists()) {
        const appointmentData = doc.data();
        console.log("Real-time appointment update:", appointmentData);
        
        if (appointmentData.sessionStatus === 'completed' && !isDoctor) {
          console.log("Session completed by doctor, redirecting patient...");
          onEndSession();
          return;
        }
        
        setAppointment(prev => prev ? { ...prev, ...appointmentData } : null);
      }
    }, (error) => {
      console.error("Error listening to appointment changes:", error);
    });

    return () => unsubscribe();
  }, [appointmentId, isDoctor, onEndSession, authChecked]);

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

  const handleCompleteSession = async () => {
    if (!isDoctor) return;

    try {
      setUpdating(true);
      console.log("Completing session with hash:", appointment?.blockchainTransactionHash);
      
      await completeAppointmentSession(
        appointmentId, 
        null,
        appointment?.blockchainTransactionHash
      );
      
      onEndSession();
    } catch (error) {
      console.error("Error completing session:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleEndSession = () => {
    onEndSession();
  };

  // Show loading while checking authentication
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

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
        {/* Rest of your JSX - keeping it exactly as you had it */}
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

          {/* Right Column - Health Records - ADD YOUR EXISTING HEALTH RECORDS UI HERE */}
          <div className="lg:col-span-2">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Health Record</h2>
              {healthRecord ? (
                <div className="text-gray-700">
                  <p>Health record loaded successfully!</p>
                  {/* Add your full health record display UI here */}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No health record available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentSession;