import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, User, Calendar, Clock, Stethoscope,
  FileText, Plus, Save, AlertCircle, CheckCircle,
  Activity, Heart, Pill, AlertTriangle
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore'; // Add onSnapshot import
import { db } from '../firebase'; // Add db import
import { getAppointmentDetails, updateAppointmentSessionStatus, completeAppointmentSession, updatePatientMedicalInfoInSession } from '../services/AppointmentSessionService';
import { getPatientHealthRecord } from '../services/healthRecordService';

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

  const isDoctor = userProfile.role === 'doctor';

  // Real-time listener for appointment status changes
  useEffect(() => {
    if (!appointmentId) return;

    const appointmentRef = doc(db, "appointments", appointmentId);
    const unsubscribe = onSnapshot(appointmentRef, (doc) => {
      if (doc.exists()) {
        const appointmentData = doc.data();
        
        // Check if session was completed by doctor
        if (appointmentData.sessionStatus === 'completed' && !isDoctor) {
          // Patient should be redirected when doctor completes the session
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

  const handleCompleteSession = async () => {
    if (!isDoctor) return;

    try {
      setUpdating(true);
      await completeAppointmentSession(appointmentId);
      // The real-time listener will handle redirecting the patient
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
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <Activity className="w-6 h-6 mr-2 text-green-600" />
                {isDoctor ? 'Patient Health Records' : 'Your Health Records'}
              </h2>

              {!healthRecord ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <p className="text-gray-600">No health records found.</p>
                </div>
              ) : (
                <div className="space-y-8">

                  {/* Personal Details */}
                  <div className="border-b border-gray-200 pb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {healthRecord.bloodType && (
                        <div>
                          <p className="text-sm text-gray-500">Blood Type</p>
                          <p className="font-semibold text-gray-800">{healthRecord.bloodType}</p>
                        </div>
                      )}
                      {healthRecord.dateOfBirth && (
                        <div>
                          <p className="text-sm text-gray-500">Date of Birth</p>
                          <p className="font-semibold text-gray-800">{healthRecord.dateOfBirth}</p>
                        </div>
                      )}
                      {healthRecord.emergencyContactName && (
                        <div>
                          <p className="text-sm text-gray-500">Emergency Contact</p>
                          <p className="font-semibold text-gray-800">{healthRecord.emergencyContactName}</p>
                          <p className="text-sm text-gray-600">{healthRecord.emergencyContact}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Allergies */}
                  <div className="border-b border-gray-200 pb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                        Allergies
                      </h3>
                    </div>

                    {healthRecord.allergies && healthRecord.allergies.length > 0 ? (
                      <div className="space-y-3">
                        {healthRecord.allergies.map((allergy, index) => (
                          <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-gray-800">{allergy.name}</p>
                                {allergy.severity && (
                                  <p className="text-sm text-red-600">Severity: {allergy.severity}</p>
                                )}
                                {allergy.reaction && (
                                  <p className="text-sm text-gray-600">Reaction: {allergy.reaction}</p>
                                )}
                              </div>
                              {allergy.addedDate && (
                                <p className="text-xs text-gray-400">
                                  Added: {new Date(allergy.addedDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No allergies recorded.</p>
                    )}

                    {/* Doctor Add Allergy Form */}
                    {isDoctor && (
                      <div className="mt-4 bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-700 mb-3">Add New Allergy</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            type="text"
                            placeholder="Allergy name"
                            value={newAllergy.name}
                            onChange={(e) => setNewAllergy(prev => ({ ...prev, name: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <select
                            value={newAllergy.severity}
                            onChange={(e) => setNewAllergy(prev => ({ ...prev, severity: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select severity</option>
                            <option value="Mild">Mild</option>
                            <option value="Moderate">Moderate</option>
                            <option value="Severe">Severe</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Reaction"
                            value={newAllergy.reaction}
                            onChange={(e) => setNewAllergy(prev => ({ ...prev, reaction: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <button
                          onClick={() => handleAddMedicalInfo('allergy')}
                          disabled={!newAllergy.name.trim() || updating}
                          className="mt-3 flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Allergy
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Current Medications */}
                  <div className="border-b border-gray-200 pb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                        <Pill className="w-5 h-5 mr-2 text-blue-500" />
                        Current Medications
                      </h3>
                    </div>

                    {healthRecord.currentMedications && healthRecord.currentMedications.length > 0 ? (
                      <div className="space-y-3">
                        {healthRecord.currentMedications.map((medication, index) => (
                          <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-gray-800">{medication.name}</p>
                                {medication.dosage && (
                                  <p className="text-sm text-blue-600">Dosage: {medication.dosage}</p>
                                )}
                                {medication.frequency && (
                                  <p className="text-sm text-gray-600">Frequency: {medication.frequency}</p>
                                )}
                                {medication.instructions && (
                                  <p className="text-sm text-gray-600">Instructions: {medication.instructions}</p>
                                )}
                              </div>
                              {medication.prescribedDate && (
                                <p className="text-xs text-gray-400">
                                  Prescribed: {new Date(medication.prescribedDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No current medications recorded.</p>
                    )}

                    {/* Doctor Add Medication Form */}
                    {isDoctor && (
                      <div className="mt-4 bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-700 mb-3">Prescribe New Medication</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Medication name"
                            value={newMedication.name}
                            onChange={(e) => setNewMedication(prev => ({ ...prev, name: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Dosage"
                            value={newMedication.dosage}
                            onChange={(e) => setNewMedication(prev => ({ ...prev, dosage: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Frequency"
                            value={newMedication.frequency}
                            onChange={(e) => setNewMedication(prev => ({ ...prev, frequency: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Instructions"
                            value={newMedication.instructions}
                            onChange={(e) => setNewMedication(prev => ({ ...prev, instructions: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <button
                          onClick={() => handleAddMedicalInfo('medication')}
                          disabled={!newMedication.name.trim() || updating}
                          className="mt-3 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Prescribe Medication
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Chronic Conditions */}
                  <div className="border-b border-gray-200 pb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                        <Heart className="w-5 h-5 mr-2 text-purple-500" />
                        Chronic Conditions
                      </h3>
                    </div>

                    {healthRecord.chronicConditions && healthRecord.chronicConditions.length > 0 ? (
                      <div className="space-y-3">
                        {healthRecord.chronicConditions.map((condition, index) => (
                          <div key={index} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-gray-800">{condition.name}</p>
                                {condition.diagnosedDate && (
                                  <p className="text-sm text-purple-600">
                                    Diagnosed: {new Date(condition.diagnosedDate).toLocaleDateString()}
                                  </p>
                                )}
                                {condition.severity && (
                                  <p className="text-sm text-gray-600">Severity: {condition.severity}</p>
                                )}
                                {condition.notes && (
                                  <p className="text-sm text-gray-600">Notes: {condition.notes}</p>
                                )}
                              </div>
                              {condition.addedDate && (
                                <p className="text-xs text-gray-400">
                                  Added: {new Date(condition.addedDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No chronic conditions recorded.</p>
                    )}

                    {/* Doctor Add Condition Form */}
                    {isDoctor && (
                      <div className="mt-4 bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-700 mb-3">Add Chronic Condition</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Condition name"
                            value={newCondition.name}
                            onChange={(e) => setNewCondition(prev => ({ ...prev, name: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="date"
                            value={newCondition.diagnosedDate}
                            onChange={(e) => setNewCondition(prev => ({ ...prev, diagnosedDate: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <select
                            value={newCondition.severity}
                            onChange={(e) => setNewCondition(prev => ({ ...prev, severity: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select severity</option>
                            <option value="Mild">Mild</option>
                            <option value="Moderate">Moderate</option>
                            <option value="Severe">Severe</option>
                          </select>
                          <textarea
                            placeholder="Notes"
                            value={newCondition.notes}
                            onChange={(e) => setNewCondition(prev => ({ ...prev, notes: e.target.value }))}
                            rows="2"
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <button
                          onClick={() => handleAddMedicalInfo('condition')}
                          disabled={!newCondition.name.trim() || updating}
                          className="mt-3 flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Condition
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Medical History */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-green-500" />
                        Medical History
                      </h3>
                    </div>

                    {healthRecord.medicalHistory && healthRecord.medicalHistory.length > 0 ? (
                      <div className="space-y-3">
                        {healthRecord.medicalHistory.map((entry, index) => (
                          <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-800">{entry.description}</p>
                                {entry.diagnosis && (
                                  <p className="text-sm text-green-700 mt-1">
                                    <span className="font-medium">Diagnosis:</span> {entry.diagnosis}
                                  </p>
                                )}
                                {entry.treatment && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">Treatment:</span> {entry.treatment}
                                  </p>
                                )}
                                {entry.notes && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">Notes:</span> {entry.notes}
                                  </p>
                                )}
                              </div>
                              <div className="text-right text-xs text-gray-400">
                                {entry.date && (
                                  <p>Date: {new Date(entry.date).toLocaleDateString()}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No medical history recorded.</p>
                    )}

                    {/* Doctor Add History Entry Form */}
                    {isDoctor && (
                      <div className="mt-4 bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-700 mb-3">Add Medical History Entry</h4>
                        <div className="space-y-3">
                          <input
                            type="date"
                            value={newHistoryEntry.date}
                            onChange={(e) => setNewHistoryEntry(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <textarea
                            placeholder="Description of visit/condition"
                            value={newHistoryEntry.description}
                            onChange={(e) => setNewHistoryEntry(prev => ({ ...prev, description: e.target.value }))}
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Diagnosis"
                            value={newHistoryEntry.diagnosis}
                            onChange={(e) => setNewHistoryEntry(prev => ({ ...prev, diagnosis: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Treatment provided"
                            value={newHistoryEntry.treatment}
                            onChange={(e) => setNewHistoryEntry(prev => ({ ...prev, treatment: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <textarea
                            placeholder="Additional notes"
                            value={newHistoryEntry.notes}
                            onChange={(e) => setNewHistoryEntry(prev => ({ ...prev, notes: e.target.value }))}
                            rows="2"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <button
                          onClick={() => handleAddMedicalInfo('history')}
                          disabled={!newHistoryEntry.description.trim() || updating}
                          className="mt-3 flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add History Entry
                        </button>
                      </div>
                    )}
                  </div>
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