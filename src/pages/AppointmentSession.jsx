import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from '../firebase';
import { User, Stethoscope, FileText, Send } from 'lucide-react';

// This component simulates being on a specific appointment page.
// In a real app, you'd pass an appointmentId as a prop.
// For this example, we'll use a hardcoded ID for demonstration.
const APPOINTMENT_ID = "mock_appointment_123";

const AppointmentSession = ({ userProfile, onEndSession }) => {
  const [appointment, setAppointment] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Listen for real-time updates on the appointment document
  useEffect(() => {
    const appointmentRef = doc(db, "appointments", APPOINTMENT_ID);
    
    const unsubscribe = onSnapshot(appointmentRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAppointment(data);
        // If the doctor has already submitted a diagnosis, populate the textarea
        if(data.diagnosis) {
          setDiagnosis(data.diagnosis);
        }
        // If the appointment status is 'completed', end the session for the patient
        if (userProfile.role === 'patient' && data.status === 'completed') {
            setTimeout(() => onEndSession(), 5000); // Wait 5s before redirecting
        }
      } else {
        setError("Appointment not found. It may have been canceled.");
      }
      setIsLoading(false);
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [userProfile.role, onEndSession]);

  // Function for the doctor to submit the diagnosis
  const handleDiagnosisSubmit = async () => {
    if (diagnosis.trim() === '') {
      alert("Please enter a diagnosis.");
      return;
    }
    const appointmentRef = doc(db, "appointments", APPOINTMENT_ID);
    try {
      await updateDoc(appointmentRef, {
        diagnosis: diagnosis,
        status: 'completed' // Mark the appointment as completed
      });
      // The doctor can also be redirected after submission
      setTimeout(() => onEndSession(), 3000);
    } catch (error) {
      console.error("Error updating diagnosis: ", error);
      alert("Failed to submit diagnosis.");
    }
  };

  if (isLoading) {
    return <div className="text-center p-10">Loading session...</div>;
  }

  if (error) {
    return <div className="text-center p-10 text-red-500">{error}</div>;
  }

  // Determine the view based on the user's role
  const isDoctor = userProfile.role === 'doctor';

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
          Live Appointment
        </h1>
        <p className="text-gray-600">Session in progress...</p>
        <div className="w-16 h-1 bg-gradient-to-r from-blue-600 to-teal-600 mx-auto mt-3"></div>
      </div>

      {/* Shared Appointment Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-sm">
        <div className="bg-white/50 p-4 rounded-2xl shadow-lg border border-white/20 flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center mr-4">
                <User className="w-5 h-5 text-white" />
            </div>
            <div>
                <p className="font-semibold text-gray-500">Patient</p>
                <p className="text-gray-800 font-bold">{appointment.patientName}</p>
            </div>
        </div>
        <div className="bg-white/50 p-4 rounded-2xl shadow-lg border border-white/20 flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
                <p className="font-semibold text-gray-500">Doctor</p>
                <p className="text-gray-800 font-bold">{appointment.doctorName}</p>
            </div>
        </div>
      </div>

      {/* Patient's Stated Problem */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-600"/>
            Patient's Health Concern
        </h3>
        <p className="bg-gray-100 p-4 rounded-2xl text-gray-700 border border-gray-200">
            {appointment.problem}
        </p>
      </div>

      {/* Diagnosis Section (Varies by role) */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-teal-600"/>
            Doctor's Diagnosis
        </h3>
        {isDoctor ? (
            // Doctor's View: Textarea to input diagnosis
            <div className="space-y-4">
                 <textarea
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="Enter your diagnosis here..."
                    className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-white/70"
                    rows="5"
                    disabled={appointment.status === 'completed'}
                />
                {appointment.status !== 'completed' ? (
                    <button
                        onClick={handleDiagnosisSubmit}
                        className="w-full py-3 px-6 rounded-2xl text-white font-semibold bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 transform hover:scale-105 transition-all duration-300 shadow-xl flex items-center justify-center"
                    >
                        Submit Diagnosis & End Session
                        <Send className="ml-2 w-4 h-4" />
                    </button>
                ) : (
                    <p className="text-center text-green-600 font-semibold">Diagnosis submitted. Session has ended.</p>
                )}
            </div>
        ) : (
            // Patient's View: Display diagnosis or waiting message
            <div className="bg-gray-100 p-4 rounded-2xl text-gray-700 min-h-[100px] border border-gray-200">
                {appointment.diagnosis ? (
                    <>
                        <p>{appointment.diagnosis}</p>
                        {appointment.status === 'completed' && (
                             <p className="text-sm text-green-600 mt-4 font-semibold">The session has ended. You will be redirected shortly.</p>
                        )}
                    </>
                ) : (
                    <p className="text-gray-500 animate-pulse">Waiting for the doctor to submit a diagnosis...</p>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentSession;
