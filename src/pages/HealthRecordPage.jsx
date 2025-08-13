import React, { useState, useEffect } from 'react';
// Import the functions from your new service file
import { 
  getPatientHealthRecord, 
  createNewHealthRecord, 
  updatePersonalDetails 
} from '../services/healthRecordService';
import { 
  User, Heart, Shield, MapPin, Phone, Save, Edit, ArrowLeft, 
  Loader, Calendar, FileText, AlertTriangle, Pill, Activity, UserCheck
} from 'lucide-react';

// Helper component for displaying record items (No changes needed here)
const RecordItem = ({ icon, label, value, isEditable, onChange, name, placeholder, type = "text", rows = 1 }) => (
  <div className="flex items-start py-4 border-b border-gray-200/50 last:border-b-0">
    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center mr-5 shadow-lg flex-shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-500 mb-1">{label}</p>
      {isEditable ? (
        type === "textarea" ? (
          <textarea
            name={name}
            value={value || ''}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            className="w-full p-3 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 resize-none"
          />
        ) : (
          <input
            type={type}
            name={name}
            value={value || ''}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full p-3 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200"
          />
        )
      ) : (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-lg text-gray-500 whitespace-pre-wrap">
            {value || placeholder}
          </p>
        </div>
      )}
    </div>
  </div>
);

// Component for medical history entries (No changes needed here)
const MedicalHistoryItem = ({ entry }) => (
  <div className="bg-white/50 border border-gray-200 rounded-xl p-4 mb-3">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center">
        <Calendar className="w-4 h-4 text-blue-600 mr-2" />
        <span className="text-sm font-semibold text-gray-700">
          {entry.date}
        </span>
      </div>
      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
        {entry.type}
      </span>
    </div>
    <p className="text-gray-800 font-medium mb-1">{entry.diagnosis}</p>
    {entry.notes && (
      <p className="text-sm text-gray-600">{entry.notes}</p>
    )}
    <p className="text-xs text-gray-500 mt-2">
      Updated by Dr. {entry.doctorName}
    </p>
  </div>
);

const HealthRecordPage = ({ userProfile, onBack }) => {
  const [healthData, setHealthData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchHealthRecord = async () => {
      if (!userProfile?.uid) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        let data = await getPatientHealthRecord(userProfile.uid);

        if (!data) {
          console.log("No record found, creating a new one...");
          data = await createNewHealthRecord(userProfile.uid);
        }
        
        setHealthData(data);
        setFormData({
          bloodType: data.bloodType || '',
          emergencyContact: data.emergencyContact || '',
          emergencyContactName: data.emergencyContactName || '',
          address: data.address || '',
          dateOfBirth: data.dateOfBirth || ''
        });
      } catch (error) {
        console.error("Error in fetchHealthRecord:", error);
        setMessage({ 
          type: 'error', 
          text: 'Failed to load health records. Please refresh the page.' 
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchHealthRecord();
  }, [userProfile?.uid]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    
    if (!userProfile?.uid) {
      setMessage({ type: 'error', text: 'User information not found.' });
      setIsSaving(false);
      return;
    }

    try {
      await updatePersonalDetails(userProfile.uid, formData);
      setHealthData(prevData => ({ ...prevData, ...formData }));
      setMessage({ type: 'success', text: 'Personal details updated successfully!' });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating health record:", error);
      setMessage({ type: 'error', text: `Failed to update details: ${error.message}` });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xl font-semibold text-gray-700">Loading health records...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center">
                <button 
                onClick={onBack}
                className="p-3 bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 hover:bg-white transition-all duration-300 group mr-4"
                >
                <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-blue-600"/>
                </button>
                <div>
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
                    Health Records
                </h1>
                <p className="text-gray-600 mt-1">Manage your personal and medical information</p>
                </div>
            </div>
          
            {/* REMOVED: Patient ID display */}
        </header>

        {/* Status Messages */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl border ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <div className="flex items-center">
              {message.type === 'success' ? <UserCheck className="w-5 h-5 mr-2" /> : <AlertTriangle className="w-5 h-5 mr-2" />}
              {message.text}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Personal Details */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/20 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <User className="w-6 h-6 mr-3 text-blue-600" />
                    Personal Details
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Information you can update yourself
                  </p>
                </div>
                <button
                  onClick={isEditing ? handleSave : () => setIsEditing(true)}
                  className="py-2 px-5 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 transform hover:scale-105 transition-all duration-300 shadow-lg flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSaving}
                >
                  {isEditing ? (
                    <>{isSaving ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} {isSaving ? 'Saving...' : 'Save Changes'}</>
                  ) : (
                    <><Edit className="w-4 h-4 mr-2" /> Edit Details</>
                  )}
                </button>
              </div>
              
              <div className="space-y-2">
                <RecordItem icon={<Activity className="w-6 h-6 text-white" />} label="Blood Type" name="bloodType" value={isEditing ? formData.bloodType : healthData?.bloodType} isEditable={isEditing} onChange={handleInputChange} placeholder="e.g., O+, A-, B+, AB-"/>
                <RecordItem icon={<User className="w-6 h-6 text-white" />} label="Emergency Contact Name" name="emergencyContactName" value={isEditing ? formData.emergencyContactName : healthData?.emergencyContactName} isEditable={isEditing} onChange={handleInputChange} placeholder="Full name of emergency contact"/>
                <RecordItem icon={<Phone className="w-6 h-6 text-white" />} label="Emergency Contact Number" name="emergencyContact" value={isEditing ? formData.emergencyContact : healthData?.emergencyContact} isEditable={isEditing} onChange={handleInputChange} placeholder="e.g., +91 98765 43210" type="tel"/>
                <RecordItem icon={<Calendar className="w-6 h-6 text-white" />} label="Date of Birth" name="dateOfBirth" value={isEditing ? formData.dateOfBirth : healthData?.dateOfBirth} isEditable={isEditing} onChange={handleInputChange} placeholder="YYYY-MM-DD" type="date"/>
                <RecordItem icon={<MapPin className="w-6 h-6 text-white" />} label="Address" name="address" value={isEditing ? formData.address : healthData?.address} isEditable={isEditing} onChange={handleInputChange} placeholder="Your complete address" type="textarea" rows={3}/>
              </div>
            </div>

            {/* Medical History Section */}
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/20 shadow-xl">
               <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <FileText className="w-6 h-6 mr-3 text-emerald-600" />
                    Medical History
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Updated by healthcare providers during appointments
                  </p>
                </div>
                {healthData?.lastUpdated && (
                  <div className="text-right text-xs text-gray-500">
                    <p>Last updated: {new Date(healthData.lastUpdated).toLocaleDateString()}</p>
                    <p>By: {healthData.lastUpdatedBy}</p>
                  </div>
                )}
              </div>
              
              {healthData?.medicalHistory && healthData.medicalHistory.length > 0 ? (
                <div className="space-y-3">
                  {healthData.medicalHistory.map((entry, index) => (
                    <MedicalHistoryItem key={index} entry={entry} />
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No medical history recorded yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Medical history will be added by your doctor during appointments
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Current Medical Information */}
          <div className="space-y-8">
            {/* Current Medications */}
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><Pill className="w-5 h-5 mr-3 text-purple-600" />Current Medications</h3>
              {healthData?.currentMedications && healthData.currentMedications.length > 0 ? (
                <div className="space-y-3">
                  {healthData.currentMedications.map((medication, index) => (
                    <div key={index} className="bg-white/50 border border-gray-200 rounded-lg p-3">
                      <p className="font-semibold text-gray-800">{medication.name}</p>
                      <p className="text-sm text-gray-600">{medication.dosage}</p>
                      {medication.frequency && <p className="text-xs text-gray-500">{medication.frequency}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4"><Pill className="w-8 h-8 text-gray-400 mx-auto mb-2" /><p className="text-gray-600">No medications recorded</p></div>
              )}
            </div>

            {/* REMOVED: Allergies Section */}

            {/* Chronic Conditions */}
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><Heart className="w-5 h-5 mr-3 text-pink-600" />Chronic Conditions</h3>
              {healthData?.chronicConditions && healthData.chronicConditions.length > 0 ? (
                <div className="space-y-2">
                  {healthData.chronicConditions.map((condition, index) => (
                    <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="font-semibold text-blue-800">{condition.name}</p>
                      {condition.diagnosedDate && <p className="text-xs text-blue-600">Diagnosed: {new Date(condition.diagnosedDate).toLocaleDateString()}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4"><Heart className="w-8 h-8 text-gray-400 mx-auto mb-2" /><p className="text-gray-600">No chronic conditions recorded</p></div>
              )}
            </div>
            
            {/* REMOVED: Doctor Access Notice */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthRecordPage;
