import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Clock, User, Calendar, FileText, 
  CheckCircle, XCircle, AlertCircle, Loader, 
  Phone, Mail, Stethoscope, ClipboardList
} from 'lucide-react';
import { 
  getPendingAppointmentRequests, 
  approveAppointmentRequest, 
  rejectAppointmentRequest 
} from '../services/appointmentService';

const ScheduleAppointmentPage = ({ userProfile, onBack }) => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'today', 'upcoming'

  useEffect(() => {
    fetchPendingRequests();
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchPendingRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setError('');
      const requests = await getPendingAppointmentRequests(userProfile.uid);
      setPendingRequests(requests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      setError('Failed to load appointment requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId, requestData) => {
    setProcessingId(requestId);
    try {
      await approveAppointmentRequest(requestId, requestData);
      // Remove the approved request from the local state
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
      // Show success message briefly
      setTimeout(() => setProcessingId(null), 1000);
    } catch (error) {
      console.error('Error approving appointment:', error);
      setError('Failed to approve appointment');
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId) => {
    setProcessingId(requestId);
    try {
      await rejectAppointmentRequest(requestId);
      // Remove the rejected request from the local state
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
      // Show success message briefly
      setTimeout(() => setProcessingId(null), 1000);
    } catch (error) {
      console.error('Error rejecting appointment:', error);
      setError('Failed to reject appointment');
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getFilteredRequests = () => {
    const today = new Date().toISOString().split('T')[0];
    
    switch (filter) {
      case 'today':
        return pendingRequests.filter(req => req.appointmentDate === today);
      case 'upcoming':
        return pendingRequests.filter(req => req.appointmentDate > today);
      default:
        return pendingRequests;
    }
  };

  // Helper function to format health records into a readable string
  const getHealthRecordText = (record) => {
    if (!record || Object.keys(record).length === 0) return "No health record available for this patient.";

    let recordText = "";
    if (record.bloodType) recordText += `Blood Type: ${record.bloodType}\n`;
    if (record.dateOfBirth) recordText += `Date of Birth: ${record.dateOfBirth}\n`;
    if (record.address) recordText += `Address: ${record.address}\n`;
    if (record.emergencyContactName) recordText += `Emergency Contact Name: ${record.emergencyContactName}\n`;
    if (record.emergencyContact) recordText += `Emergency Contact: ${record.emergencyContact}\n`;
    
    const formatArray = (title, items) => {
        if (items && items.length > 0) {
            recordText += `\n--- ${title} ---\n`;
            items.forEach(item => {
                if (item.name) recordText += `- ${item.name}`;
                if (item.notes) recordText += ` (${item.notes})`;
                recordText += `\n`;
            });
        }
    };
    
    formatArray("Allergies", record.allergies);
    formatArray("Chronic Conditions", record.chronicConditions);
    formatArray("Current Medications", record.currentMedications);
    
    if (record.medicalHistory && record.medicalHistory.length > 0) {
        recordText += `\n--- Medical History ---\n`;
        record.medicalHistory.forEach(history => {
            recordText += `- Diagnosis: ${history.diagnosis}\n`;
            recordText += `  Notes: ${history.notes}\n`;
            recordText += `  Date: ${history.date}\n`;
        });
    }

    return recordText.trim();
  };


  const filteredRequests = getFilteredRequests();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-600 mt-4">Loading appointment requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
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
                Appointment Requests
              </h1>
              <p className="text-gray-600 mt-1">Review and approve patient appointment requests</p>
            </div>
          </div>
          {/* The redundant button with the loader icon has been removed */}
        </header>

        {/* Filters */}
        <div className="mb-6 flex space-x-4">
          {[
            { id: 'all', label: 'All Requests' },
            { id: 'today', label: 'Today' },
            { id: 'upcoming', label: 'Upcoming' }
          ].map(filterOption => (
            <button
              key={filterOption.id}
              onClick={() => setFilter(filterOption.id)}
              className={`px-6 py-3 rounded-2xl font-semibold transition-all duration-300 ${
                filter === filterOption.id
                  ? 'bg-gradient-to-r from-blue-600 to-teal-600 text-white shadow-lg'
                  : 'bg-white/70 text-gray-600 hover:bg-white border border-white/20'
              }`}
            >
              {filterOption.label}
              <span className="ml-2 text-sm">
                ({filterOption.id === 'all' ? pendingRequests.length : 
                  filterOption.id === 'today' ? pendingRequests.filter(req => req.appointmentDate === new Date().toISOString().split('T')[0]).length :
                  pendingRequests.filter(req => req.appointmentDate > new Date().toISOString().split('T')[0]).length})
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50/80 backdrop-blur-xl rounded-2xl p-4 border border-red-200 shadow-lg flex items-center mb-6">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {filteredRequests.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 text-center border border-white/20 shadow-xl">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Pending Requests</h3>
            <p className="text-gray-600">
              {filter === 'all' ? "You don't have any pending appointment requests at the moment." :
               filter === 'today' ? "No appointment requests for today." :
               "No upcoming appointment requests."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredRequests.map((request) => (
              <div key={request.id} className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Patient Information & Problem */}
                  <div className="lg:col-span-2">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center mr-4">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">{request.patientName}</h3>
                          <p className="text-sm text-gray-500">Patient ID: {request.patientId.slice(-8)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center text-gray-600 mb-1">
                          <Calendar className="w-4 h-4 mr-2" />
                          <span className="font-semibold">{formatDate(request.appointmentDate)}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Clock className="w-4 h-4 mr-2" />
                          <span className="font-semibold">{request.appointmentTime}</span>
                        </div>
                      </div>
                    </div>

                    {/* Problem Description */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        Patient's Concern
                      </h4>
                      <p className="text-gray-700 bg-gray-50/50 rounded-xl p-4 leading-relaxed">
                        {request.problem}
                      </p>
                    </div>

                    {/* NEW: Health Record Details */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                        <ClipboardList className="w-4 h-4 mr-2 text-purple-600" />
                        Patient's Health Records
                      </h4>
                      <textarea
                        value={getHealthRecordText(request.healthRecords)}
                        readOnly
                        rows="7"
                        className="w-full p-4 border-2 border-gray-200 rounded-2xl bg-gray-50/50 resize-none text-gray-700 font-mono"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col justify-center space-y-4">
                    <button
                      onClick={() => handleApprove(request.id, request)}
                      disabled={processingId === request.id}
                      className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-2xl hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 flex items-center justify-center"
                    >
                      {processingId === request.id ? (
                        <Loader className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Approve
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleReject(request.id)}
                      disabled={processingId === request.id}
                      className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-2xl hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 flex items-center justify-center"
                    >
                      {processingId === request.id ? (
                        <Loader className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 mr-2" />
                          Reject
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleAppointmentPage;
