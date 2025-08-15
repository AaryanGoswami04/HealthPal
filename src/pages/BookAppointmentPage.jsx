import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Search, Calendar, Clock, User,
  Stethoscope, Star, CheckCircle, AlertCircle, Loader, Send
} from 'lucide-react';
import {
  fetchDoctors,
  createAppointmentRequest,
  getAvailableTimeSlots,
  searchDoctors,
  getHealthRecord
} from '../services/appointmentService';

const formatTo12Hour = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const formattedHours = h12 < 10 ? `0${h12}` : h12;
  return `${formattedHours}:${minutes} ${ampm}`;
};

const BookAppointmentPage = ({ userProfile, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [symptoms, setSymptoms] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDoctors = async () => {
      try {
        setLoading(true);
        const doctorsFromFirebase = await fetchDoctors();
        setAllDoctors(doctorsFromFirebase);
        setDoctors(doctorsFromFirebase);
        setError('');
      } catch (error) {
        console.error('Error loading doctors:', error);
        setError('Failed to load doctors. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadDoctors();
  }, []);

  useEffect(() => {
    if (allDoctors.length > 0) {
      const filteredDoctors = searchDoctors(searchQuery, allDoctors);
      setDoctors(filteredDoctors);
    }
  }, [searchQuery, allDoctors]);

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDoctor, selectedDate]);

  const loadAvailableSlots = async () => {
    try {
      const slots = await getAvailableTimeSlots(selectedDate, selectedDoctor.id);
      setAvailableSlots(slots);
      setSelectedTime('');
      setCustomTime('');
    } catch (error) {
      console.error('Error loading time slots:', error);
      setError('Failed to load available time slots');
    }
  };

  const handleDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor);
    setSelectedTime('');
    setCustomTime('');
  };

  // ################## MODIFIED SECTION START ##################
  // This function now returns today's date instead of tomorrow's.
  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };
  // ################## MODIFIED SECTION END ##################

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().split('T')[0];
  };

  const handleRequestAppointment = async () => {
    const finalTime = selectedTime === 'custom' ? formatTo12Hour(customTime) : selectedTime;
    if (!selectedDoctor || !selectedDate || !finalTime || !finalTime.trim() || !symptoms.trim()) {
      setError('Please fill in all required fields correctly.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const requestData = {
        patientId: userProfile.uid,
        patientName: userProfile.name,
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        doctorSpecialization: selectedDoctor.specialization,
        appointmentDate: selectedDate,
        appointmentTime: finalTime,
        problem: symptoms,
      };

      const healthRecordData = await getHealthRecord(userProfile.uid);
      await createAppointmentRequest(requestData, healthRecordData);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onBack();
      }, 4000);

    } catch (error) {
      console.error('Error submitting appointment request:', error);
      setError('Failed to submit appointment request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    const finalTime = selectedTime === 'custom' ? formatTo12Hour(customTime) : selectedTime;
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 sm:p-12 shadow-2xl border border-white/20 text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Send className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Request Sent!</h2>
          <p className="text-gray-600 mb-2">Your appointment request has been sent to</p>
          <p className="font-semibold text-gray-800 mb-2">{selectedDoctor?.name}</p>
          <p className="text-gray-600 mb-6">for {selectedDate} at {finalTime}</p>
          <div className="bg-blue-50/80 rounded-2xl p-4 mb-6">
            <p className="text-blue-800 font-medium mb-2">⏳ Waiting for Doctor's Approval</p>
            <p className="text-blue-700 text-sm">
              The doctor will review your request and approve or suggest alternative times.
              You'll be notified once there's an update.
            </p>
          </div>
          <p className="text-sm text-gray-500">Redirecting you back to the dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
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
                Request an Appointment
              </h1>
              <p className="text-gray-600 mt-1">Send an appointment request to your preferred doctor</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <Search className="w-5 h-5 mr-3 text-blue-600" />
                1. Find Your Doctor
              </h2>
              <div className="relative mb-6">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by doctor name or specialization..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-white/70"
                  disabled={loading}
                />
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto p-1">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-3 text-gray-600">Loading doctors...</span>
                  </div>
                ) : doctors.length === 0 ? (
                  <div className="text-center py-12">
                    <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {searchQuery ? 'No doctors found matching your search.' : 'No doctors available at the moment.'}
                    </p>
                  </div>
                ) : (
                  doctors.map((doctor) => (
                    <div
                      key={doctor.id}
                      onClick={() => handleDoctorSelect(doctor)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                        selectedDoctor?.id === doctor.id
                          ? 'border-blue-500 bg-blue-50/50 shadow-md'
                          : 'border-gray-200 bg-white/50 hover:bg-white/70 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div className="ml-4 flex-1">
                          <h3 className="font-semibold text-gray-800">{doctor.name}</h3>
                          <p className="text-sm text-gray-600">{doctor.specialization}</p>
                          <div className="flex items-center mt-1 text-sm text-gray-500">
                            <Star className="w-4 h-4 text-yellow-500 fill-current mr-1" />
                            <span>{doctor.rating || '4.8'}</span>
                            <span className="mx-2">•</span>
                            <span>{doctor.experience || '5+ years'}</span>
                          </div>
                        </div>
                        {selectedDoctor?.id === doctor.id && (
                          <CheckCircle className="w-6 h-6 text-blue-500 ml-2" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Stethoscope className="w-5 h-5 mr-3 text-red-500" />
                2. Describe Your Symptoms
              </h3>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Please describe your symptoms or the reason for your visit..."
                rows={4}
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-white/70 resize-none"
              />
            </div>
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-3 text-purple-500" />
                3. Choose Date & Time
              </h3>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                disabled={!selectedDoctor}
                className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-white/70 disabled:bg-gray-100"
              />
              
              {selectedDate && selectedDoctor ? (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className={`p-3 rounded-xl border-2 text-center transition-all duration-300 ${
                          selectedTime === slot
                            ? 'border-blue-500 bg-blue-50/50 text-blue-700 font-semibold'
                            : 'border-gray-200 bg-white/50 hover:bg-white/70 hover:border-gray-300'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedTime('custom')}
                      className={`p-3 rounded-xl border-2 text-center transition-all duration-300 ${
                        selectedTime === 'custom'
                          ? 'border-blue-500 bg-blue-50/50 text-blue-700 font-semibold'
                          : 'border-gray-200 bg-white/50 hover:bg-white/70 hover:border-gray-300'
                      }`}
                    >
                      Other...
                    </button>
                  </div>
                  
                  {selectedTime === 'custom' && (
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Enter Custom Time</label>
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-white/70"
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500 text-center py-4 mt-2 bg-gray-50 rounded-xl">
                  {!selectedDoctor ? 'Please select a doctor first' : 'Please select a date to see available times'}
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50/80 backdrop-blur-xl rounded-2xl p-4 border border-red-200 shadow-lg flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}

            <button
              onClick={handleRequestAppointment}
              disabled={
                isSubmitting || 
                !selectedDoctor || 
                !selectedDate || 
                (selectedTime !== 'custom' && !selectedTime) || 
                (selectedTime === 'custom' && !customTime.trim()) || 
                !symptoms.trim() || 
                loading
              }
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-teal-600 text-white font-semibold rounded-2xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 flex items-center justify-center text-lg"
            >
              {isSubmitting ? (
                <Loader className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Send className="w-6 h-6 mr-3" />
                  Send Appointment Request
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookAppointmentPage;