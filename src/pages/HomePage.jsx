import React, { useState, useEffect } from 'react';
import { signOut } from "firebase/auth";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from '../firebase';
import { 
  Calendar, User, Stethoscope, 
  Activity, Search, Settings, LogOut, Video, ClipboardList
} from 'lucide-react';
import AppointmentSession from './AppointmentSession';
import SettingsPage from './SettingsPage';
import HealthRecordPage from './HealthRecordPage';
import DoctorPatientRecordsPage from './DoctorPatientRecordsPage';
import BookAppointmentPage from './BookAppointmentPage';
import ScheduleAppointmentPage from './ScheduleAppointmentPage';
// Import your background image
import medicalBackground from '../assets/medical-background.jpg';

const HomePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [view, setView] = useState('home'); // 'home', 'session', 'settings', 'records', 'book-appointment', 'schedule-appointment'
  const [appointments, setAppointments] = useState([]); // Changed from single appointmentData to appointments array
  const [currentAppointmentId, setCurrentAppointmentId] = useState(null); // Track which appointment session to join
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser; 

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setUserProfile({ ...docSnap.data(), uid: user.uid });
        } else {
          console.log("No such user profile!");
        }
      }
    };

    fetchUserProfile();
  }, [user]);

  // Load real appointments from Firebase
  useEffect(() => {
    if (!userProfile) return;

    let appointmentsQuery;
    
    if (userProfile.role === 'doctor') {
      // For doctors, get appointments where they are the doctor
      appointmentsQuery = query(
        collection(db, "appointments"),
        where("doctorId", "==", userProfile.uid),
        where("status", "==", "upcoming")
      );
    } else {
      // For patients, get appointments where they are the patient
      appointmentsQuery = query(
        collection(db, "appointments"),
        where("patientId", "==", userProfile.uid),
        where("status", "==", "upcoming")
      );
    }

    // Listen for real-time updates to appointments
    const unsubscribe = onSnapshot(appointmentsQuery, 
      (snapshot) => {
        const appointmentsList = [];
        snapshot.forEach((doc) => {
          appointmentsList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Sort appointments by date and time
        appointmentsList.sort((a, b) => {
          const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`);
          const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`);
          return dateA - dateB;
        });
        
        setAppointments(appointmentsList);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching appointments:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile]);

  const handleLogout = () => {
    signOut(auth).catch(error => console.error("Logout Error:", error));
  };
  
  const handleNavigate = (newView) => {
    console.log(`Navigating to: ${newView}`); // Debug log
    setView(newView);
  };

  const handleJoinSession = (appointmentId) => {
    console.log('Joining session with appointment ID:', appointmentId);
    setCurrentAppointmentId(appointmentId);
    setView('session');
  };

  // Updated session end callback with better logging and state management
  const handleEndSessionCallback = () => {
    console.log('Session ended, returning to home...');
    setCurrentAppointmentId(null);
    setView('home');
    
    // Force a small delay to ensure state updates properly
    setTimeout(() => {
      console.log('View state after session end:', view);
    }, 100);
  };

  const handleProfileUpdate = (newName) => {
    setUserProfile(currentProfile => ({
      ...currentProfile,
      name: newName
    }));
  };

  // Debug: Log current view
  console.log(`Current view: ${view}`);

  if (!userProfile || loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-xl text-gray-600">Loading...</p>
          </div>
        </div>
      );
  }

  // --- View Router ---
  // Updated session view with proper validation
  if (view === 'session' && currentAppointmentId) {
      console.log('Rendering AppointmentSession with ID:', currentAppointmentId);
      return (
        <AppointmentSession 
          userProfile={userProfile} 
          appointmentId={currentAppointmentId}
          onEndSession={handleEndSessionCallback}
        />
      );
  }

  // If view is session but no appointment ID, redirect to home
  if (view === 'session' && !currentAppointmentId) {
    console.log('Session view requested but no appointment ID, redirecting to home');
    setView('home');
    return null; // Return null while redirecting
  }

  if (view === 'settings') {
      return <SettingsPage userProfile={userProfile} onBack={() => handleNavigate('home')} onProfileUpdated={handleProfileUpdate} />;
  }
  if (view === 'records') {
      if (userProfile.role === 'doctor') {
          return <DoctorPatientRecordsPage userProfile={userProfile} onBack={() => handleNavigate('home')} />;
      } else {
          return <HealthRecordPage userProfile={userProfile} onBack={() => handleNavigate('home')} />;
      }
  }
  if (view === 'book-appointment') {
      console.log('Rendering BookAppointmentPage'); // Debug log
      return <BookAppointmentPage userProfile={userProfile} onBack={() => handleNavigate('home')} />;
  }
  if (view === 'schedule-appointment') {
      console.log('Rendering ScheduleAppointmentPage'); // Debug log
      return <ScheduleAppointmentPage userProfile={userProfile} onBack={() => handleNavigate('home')} />;
  }
  // --- End View Router ---

  const isDoctor = userProfile.role === 'doctor';
  // Updated quick actions to have a white background for the doctor role as well
  const quickActions = isDoctor 
    ? [
        { id: 'schedule', icon: Calendar, label: 'Appointment Requests', color: 'bg-white/70 border border-gray-200 text-gray-800 hover:bg-white' },
        { id: 'records', icon: ClipboardList, label: 'Patient Records', color: 'bg-white/70 border border-gray-200 text-gray-800 hover:bg-white' }
      ]
    : [
        { id: 'book', icon: Calendar, label: 'Book Appointment', color: 'bg-white/70 border border-gray-200 text-gray-800 hover:bg-white' },
        { id: 'records', icon: Activity, label: 'Health Records', color: 'bg-white/70 border border-gray-200 text-gray-800 hover:bg-white' }
      ];
  const searchPlaceholder = isDoctor ? "Search patients..." : "Search doctors...";
  const welcomeMessage = isDoctor ? "Manage your patients and schedule." : "Let's take care of your health today.";

  const handleQuickAction = (actionId) => {
    console.log(`Quick action clicked: ${actionId}`); // Debug log
    
    switch (actionId) {
      case 'records':
        handleNavigate('records');
        break;
      case 'book':
        handleNavigate('book-appointment');
        break;
      case 'schedule':
        handleNavigate('schedule-appointment');
        break;
      default:
        console.log(`Unhandled action: ${actionId}`);
    }
  };

  // Helper function to format date for display
  const formatAppointmentDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        weekday: 'short'
      });
    }
  };

  // ################## MODIFIED SECTION START ##################
  // This function now handles the button's disabled state for patients.

  const getJoinButtonProps = (appointment) => {
    const isSessionActive = appointment.sessionStatus === 'active';

    if (isDoctor) {
      if (isSessionActive) {
        return {
          text: 'Join Session',
          icon: Video,
          disabled: false, // Doctor can always join an active session
          className: 'py-3 px-6 bg-gradient-to-r from-blue-600 to-teal-600 text-white font-semibold rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center'
        };
      } else {
        return {
          text: 'Start Session',
          icon: null, // No icon for "Start"
          disabled: false, // Doctor can always start a session
          className: 'py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center'
        };
      }
    } else {
      // Logic for the patient
      if (isSessionActive) {
        return {
          text: 'Join Session',
          icon: Video,
          disabled: false, // Enable the button because the session is active
          className: 'py-3 px-6 bg-gradient-to-r from-blue-600 to-teal-600 text-white font-semibold rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center'
        };
      } else {
        return {
          text: 'Waiting for Doctor',
          icon: null, // No icon for waiting state
          disabled: true, // Disable the button because the session is not active yet
          className: 'py-3 px-6 bg-gray-400 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center cursor-not-allowed'
        };
      }
    }
  };
  // ################## MODIFIED SECTION END ##################


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 relative">
      {/* Background Image - Only for main content area, not header */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50 z-0"
        style={{
          backgroundImage: `url(${medicalBackground})`,
          top: '80px' // Start below the header (header height is h-20 = 80px)
        }}
      ></div>
      
      {/* Content Overlay */}
      <div className="relative z-10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                      <Stethoscope className="w-7 h-7 text-white" />
                    </div>
                    <div className="ml-4">
                        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
                            HealthPal
                        </span>
                        <div className="w-12 h-0.5 bg-gradient-to-r from-blue-600 to-teal-600"></div>
                    </div>
                </div>
            </div>

            <div className="flex items-center">
                <div className="relative group">
                    <button onClick={() => handleNavigate('settings')} className="flex items-center space-x-3 p-2 bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 hover:bg-white transition-all duration-300">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-teal-500 flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-sm font-semibold text-gray-800">{userProfile.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{userProfile.role}</p>
                        </div>
                    </button>
                </div>
                <button onClick={handleLogout} className="ml-4 p-3 bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 hover:bg-red-50 transition-all duration-300 group">
                    <LogOut className="w-5 h-5 text-gray-600 group-hover:text-red-600"/>
                </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Message */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-800">
            Welcome back, <span className="text-gray-800">{userProfile.name.split(' ')[0]}</span>!
          </h1>
          <p className="text-lg text-gray-600 mt-2">{welcomeMessage}</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {quickActions.map(action => (
            <button 
              key={action.id} 
              onClick={() => handleQuickAction(action.id)}
              className={`p-6 rounded-3xl shadow-xl transform hover:-translate-y-2 transition-transform duration-300 flex flex-col justify-between ${action.color}`}
            >
              <div className="flex justify-between items-start">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  // Updated the icon background for doctor to match patient's card
                  isDoctor ? 'bg-gradient-to-r from-blue-500 to-teal-500' : 'bg-gradient-to-r from-blue-500 to-teal-500'
                }`}>
                  <action.icon className={`w-7 h-7 text-white`} />
                </div>
              </div>
              {/* Updated the text color for doctor to match patient's card */}
              <p className={`text-xl font-semibold mt-12 text-gray-800`}>{action.label}</p>
            </button>
          ))}
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/20 shadow-xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Upcoming Appointments</h2>
          
          {appointments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Upcoming Appointments</h3>
              <p className="text-gray-600">
                {isDoctor 
                  ? "No upcoming appointments scheduled. Check your appointment requests."
                  : "You don't have any upcoming appointments. Book an appointment with a doctor."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => {
                const buttonProps = getJoinButtonProps(appointment);
                
                return (
                  <div key={appointment.id} className="bg-white/80 p-5 rounded-2xl border-2 border-blue-200 shadow-lg flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center mr-5">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">
                          {isDoctor ? appointment.patientName : appointment.doctorName}
                        </p>
                        
                        {!isDoctor && (
                            <p className="text-sm text-gray-600">
                                {appointment.doctorSpecialization || 'General Consultation'}
                            </p>
                        )}

                        <div className="flex items-center mt-1">
                          <div className={`w-2 h-2 rounded-full mr-2 ${
                            appointment.sessionStatus === 'active' ? 'bg-green-500' :
                            'bg-blue-500'
                          }`}></div>
                          <span className="text-xs text-gray-500 capitalize">
                            {appointment.sessionStatus === 'active' ? 'Session Active' : (isDoctor ? 'Ready to Start' : 'Waiting for Doctor')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center">
                      <div className="mr-8">
                        <p className="font-semibold text-gray-800">{appointment.appointmentTime}</p>
                        <p className="text-sm text-gray-500">{formatAppointmentDate(appointment.appointmentDate)}</p>
                      </div>
                      <button 
                        onClick={() => handleJoinSession(appointment.id)}
                        disabled={buttonProps.disabled} // Use the new disabled property
                        className={buttonProps.className}
                      >
                        {buttonProps.icon && <buttonProps.icon className="w-5 h-5 mr-2" />}
                        {buttonProps.text}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      </div>
    </div>
  );
};

export default HomePage;