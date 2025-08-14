import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, User, Search, Calendar, Clock, 
  FileText, Heart, Pill, AlertTriangle, 
  ClipboardList, Phone, Mail, MapPin, 
  Filter, Loader, ChevronDown, ChevronUp
} from 'lucide-react';
import { getDoctorPatients, getPatientHealthRecord } from '../services/doctorPatientService';

const DoctorPatientRecordsPage = ({ userProfile, onBack }) => {
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHealthRecord, setPatientHealthRecord] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    allergies: false,
    medications: false,
    conditions: false,
    history: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDoctorPatients();
  }, []);

  useEffect(() => {
    // Filter patients based on search term
    if (searchTerm.trim() === '') {
      setFilteredPatients(patients);
    } else {
      const filtered = patients.filter(patient =>
        patient.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.patientId.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPatients(filtered);
    }
  }, [searchTerm, patients]);

  const fetchDoctorPatients = async () => {
    try {
      setLoading(true);
      setError('');
      const patientsList = await getDoctorPatients(userProfile.uid);
      setPatients(patientsList);
      setFilteredPatients(patientsList);
    } catch (error) {
      console.error('Error fetching doctor patients:', error);
      setError('Failed to load patient records');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = async (patient) => {
    setSelectedPatient(patient);
    setLoadingRecord(true);
    try {
      const healthRecord = await getPatientHealthRecord(patient.patientId);
      setPatientHealthRecord(healthRecord);
    } catch (error) {
      console.error('Error fetching patient health record:', error);
      setError('Failed to load patient health record');
    } finally {
      setLoadingRecord(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading patient records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
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
                Patient Records
              </h1>
              <p className="text-gray-600 mt-1">View health records of your scheduled patients</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-50/80 backdrop-blur-xl rounded-2xl p-4 border border-red-200 shadow-lg flex items-center mb-6">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Patient List */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Your Patients</h2>
                <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">
                  {filteredPatients.length}
                </span>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/70 border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Patient List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredPatients.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">
                      {searchTerm ? 'No patients found matching your search' : 'No patients with scheduled appointments'}
                    </p>
                  </div>
                ) : (
                  filteredPatients.map((patient) => (
                    <button
                      key={patient.patientId}
                      onClick={() => handlePatientSelect(patient)}
                      className={`w-full p-4 rounded-2xl border-2 transition-all duration-300 text-left ${
                        selectedPatient?.patientId === patient.patientId
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-white/50 border-gray-200 hover:bg-white hover:border-blue-200'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center mr-3">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{patient.patientName}</p>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            <span>{formatDate(patient.appointmentDate)}</span>
                            <Clock className="w-3 h-3 ml-3 mr-1" />
                            <span>{patient.appointmentTime}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Patient Details */}
          <div className="lg:col-span-2">
            {!selectedPatient ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 border border-white/20 shadow-xl text-center">
                <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Select a Patient</h3>
                <p className="text-gray-600">Choose a patient from the list to view their health records</p>
              </div>
            ) : loadingRecord ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 border border-white/20 shadow-xl text-center">
                <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading patient health record...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Patient Header */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-teal-500 rounded-2xl flex items-center justify-center mr-4">
                        <User className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800">{selectedPatient.patientName}</h2>
                        <p className="text-gray-500">Patient ID: {selectedPatient.patientId.slice(-8)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-gray-600 mb-1">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span className="font-semibold">{formatDate(selectedPatient.appointmentDate)}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Clock className="w-4 h-4 mr-2" />
                        <span className="font-semibold">{selectedPatient.appointmentTime}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personal Information */}
                {patientHealthRecord && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Personal Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center p-3 bg-gray-50/50 rounded-xl">
                        <Heart className="w-5 h-5 text-red-500 mr-3" />
                        <div>
                          <p className="text-sm text-gray-500">Blood Type</p>
                          <p className="font-semibold">{patientHealthRecord.bloodType || 'Not specified'}</p>
                        </div>
                      </div>
                      <div className="flex items-center p-3 bg-gray-50/50 rounded-xl">
                        <Calendar className="w-5 h-5 text-blue-500 mr-3" />
                        <div>
                          <p className="text-sm text-gray-500">Date of Birth</p>
                          <p className="font-semibold">{formatDate(patientHealthRecord.dateOfBirth)}</p>
                        </div>
                      </div>
                      <div className="flex items-center p-3 bg-gray-50/50 rounded-xl">
                        <MapPin className="w-5 h-5 text-green-500 mr-3" />
                        <div>
                          <p className="text-sm text-gray-500">Address</p>
                          <p className="font-semibold">{patientHealthRecord.address || 'Not specified'}</p>
                        </div>
                      </div>
                      <div className="flex items-center p-3 bg-gray-50/50 rounded-xl">
                        <Phone className="w-5 h-5 text-purple-500 mr-3" />
                        <div>
                          <p className="text-sm text-gray-500">Emergency Contact</p>
                          <p className="font-semibold">{patientHealthRecord.emergencyContactName || 'Not specified'}</p>
                          <p className="text-sm text-gray-500">{patientHealthRecord.emergencyContact || ''}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Medical Information Sections */}
                {patientHealthRecord && (
                  <>
                    {/* Allergies */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl overflow-hidden">
                      <button
                        onClick={() => toggleSection('allergies')}
                        className="w-full p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center">
                          <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
                          <h3 className="text-xl font-bold text-gray-800">Allergies</h3>
                          <span className="ml-3 bg-red-100 text-red-800 text-sm font-semibold px-2 py-1 rounded-full">
                            {patientHealthRecord.allergies?.length || 0}
                          </span>
                        </div>
                        {expandedSections.allergies ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                      {expandedSections.allergies && (
                        <div className="px-6 pb-6">
                          {patientHealthRecord.allergies?.length > 0 ? (
                            <div className="space-y-3">
                              {patientHealthRecord.allergies.map((allergy, index) => (
                                <div key={index} className="p-4 bg-red-50/50 rounded-xl border border-red-200">
                                  <p className="font-semibold text-red-800">{allergy.name}</p>
                                  {allergy.notes && <p className="text-sm text-red-600 mt-1">{allergy.notes}</p>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 italic">No known allergies</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Current Medications */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl overflow-hidden">
                      <button
                        onClick={() => toggleSection('medications')}
                        className="w-full p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center">
                          <Pill className="w-6 h-6 text-blue-500 mr-3" />
                          <h3 className="text-xl font-bold text-gray-800">Current Medications</h3>
                          <span className="ml-3 bg-blue-100 text-blue-800 text-sm font-semibold px-2 py-1 rounded-full">
                            {patientHealthRecord.currentMedications?.length || 0}
                          </span>
                        </div>
                        {expandedSections.medications ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                      {expandedSections.medications && (
                        <div className="px-6 pb-6">
                          {patientHealthRecord.currentMedications?.length > 0 ? (
                            <div className="space-y-3">
                              {patientHealthRecord.currentMedications.map((medication, index) => (
                                <div key={index} className="p-4 bg-blue-50/50 rounded-xl border border-blue-200">
                                  <p className="font-semibold text-blue-800">{medication.name}</p>
                                  {medication.notes && <p className="text-sm text-blue-600 mt-1">{medication.notes}</p>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 italic">No current medications</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Chronic Conditions */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl overflow-hidden">
                      <button
                        onClick={() => toggleSection('conditions')}
                        className="w-full p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center">
                          <Heart className="w-6 h-6 text-orange-500 mr-3" />
                          <h3 className="text-xl font-bold text-gray-800">Chronic Conditions</h3>
                          <span className="ml-3 bg-orange-100 text-orange-800 text-sm font-semibold px-2 py-1 rounded-full">
                            {patientHealthRecord.chronicConditions?.length || 0}
                          </span>
                        </div>
                        {expandedSections.conditions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                      {expandedSections.conditions && (
                        <div className="px-6 pb-6">
                          {patientHealthRecord.chronicConditions?.length > 0 ? (
                            <div className="space-y-3">
                              {patientHealthRecord.chronicConditions.map((condition, index) => (
                                <div key={index} className="p-4 bg-orange-50/50 rounded-xl border border-orange-200">
                                  <p className="font-semibold text-orange-800">{condition.name}</p>
                                  {condition.notes && <p className="text-sm text-orange-600 mt-1">{condition.notes}</p>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 italic">No chronic conditions</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Medical History */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl overflow-hidden">
                      <button
                        onClick={() => toggleSection('history')}
                        className="w-full p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center">
                          <FileText className="w-6 h-6 text-green-500 mr-3" />
                          <h3 className="text-xl font-bold text-gray-800">Medical History</h3>
                          <span className="ml-3 bg-green-100 text-green-800 text-sm font-semibold px-2 py-1 rounded-full">
                            {patientHealthRecord.medicalHistory?.length || 0}
                          </span>
                        </div>
                        {expandedSections.history ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                      {expandedSections.history && (
                        <div className="px-6 pb-6">
                          {patientHealthRecord.medicalHistory?.length > 0 ? (
                            <div className="space-y-4">
                              {patientHealthRecord.medicalHistory.map((entry, index) => (
                                <div key={index} className="p-4 bg-green-50/50 rounded-xl border border-green-200">
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="font-semibold text-green-800">{entry.diagnosis}</p>
                                    <span className="text-sm text-green-600">{formatDate(entry.date)}</span>
                                  </div>
                                  {entry.notes && <p className="text-sm text-green-700">{entry.notes}</p>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 italic">No medical history recorded</p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorPatientRecordsPage;