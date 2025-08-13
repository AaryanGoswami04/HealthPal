import React, { useState } from 'react';
import { updateProfile, updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from '../firebase';
import { User, Lock, ArrowLeft, Save, Stethoscope, Briefcase, GraduationCap } from 'lucide-react';

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

const SettingsPage = ({ userProfile, onBack, onProfileUpdated }) => {
  // Add new state for doctor-specific fields
  const [formData, setFormData] = useState({
    name: userProfile.name || '',
    specialization: userProfile.specialization || '',
    yearsOfExperience: userProfile.yearsOfExperience || '',
    education: userProfile.education || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);
  const user = auth.currentUser;

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage({ type: '', text: '' }); // Clear message on new input
  };

  // Handle updating profile details (like name and new doctor fields)
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    // Check if any changes were made before saving
    if (
      formData.name === userProfile.name &&
      formData.specialization === userProfile.specialization &&
      formData.yearsOfExperience === userProfile.yearsOfExperience &&
      formData.education === userProfile.education
    ) {
      setMessage({ type: 'error', text: 'No changes to save.' });
      setIsLoading(false);
      return;
    }

    try {
      // Update display name in Firebase Auth
      await updateProfile(user, { displayName: formData.name });
      
      // Update name and other fields in Firestore document
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { 
        name: formData.name,
        specialization: formData.specialization,
        yearsOfExperience: formData.yearsOfExperience,
        education: formData.education
      });

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      
      // Notify the parent component of the name change
      if (onProfileUpdated) {
        onProfileUpdated(formData.name);
      }

    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    }
    setIsLoading(false);
  };

  // Handle password change
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      setIsLoading(false);
      return;
    }
    if (formData.newPassword.length < 6) {
        setMessage({ type: 'error', text: 'Password should be at least 6 characters.'});
        setIsLoading(false);
        return;
    }

    try {
      // Firebase's updatePassword function handles security.
      await updatePassword(user, formData.newPassword);
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (error) {
      console.error("Error updating password:", error);
      setMessage({ type: 'error', text: 'Failed to update password. You may need to sign out and sign in again.' });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 flex justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl">
        <header className="mb-8 flex items-center">
            <button 
                onClick={onBack}
                className="p-3 bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 hover:bg-white transition-all duration-300 group"
            >
                <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-blue-600"/>
            </button>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent ml-4">
                Settings
            </h1>
        </header>

        {/* Success/Error Message Display */}
        {message.text && (
            <div className={`p-4 rounded-2xl mb-6 text-center font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                {message.text}
            </div>
        )}

        <div className="space-y-8">
            {/* Profile Information Card */}
            <form onSubmit={handleProfileUpdate} className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/20 shadow-xl">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Profile Information</h2>
                <div className="space-y-6">
                    <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 group-hover:bg-white"
                            />
                            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                                <User className="w-3 h-3 text-white" />
                            </div>
                        </div>
                    </div>
                    {/* Display additional fields only if the user is a doctor */}
                    {userProfile.role === 'doctor' && (
                        <>
                            <div className="group">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Specialty</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        name="specialization"
                                        value={formData.specialization}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Cardiology, Pediatrics"
                                        className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 group-hover:bg-white"
                                    />
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                                        <Stethoscope className="w-3 h-3 text-white" />
                                    </div>
                                </div>
                            </div>
                            <div className="group">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Years of Experience</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        name="yearsOfExperience"
                                        value={formData.yearsOfExperience}
                                        onChange={handleInputChange}
                                        placeholder="e.g., 15"
                                        className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 group-hover:bg-white"
                                    />
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                                        <Briefcase className="w-3 h-3 text-white" />
                                    </div>
                                </div>
                            </div>
                            <div className="group">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Education</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        name="education"
                                        value={formData.education}
                                        onChange={handleInputChange}
                                        placeholder="e.g., MD, Harvard Medical School"
                                        className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 group-hover:bg-white"
                                    />
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                                        <GraduationCap className="w-3 h-3 text-white" />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                        <p className="w-full pl-12 pr-4 py-4 text-gray-500 bg-gray-100/80 rounded-2xl relative">
                            {user.email}
                            <span className="text-xs absolute right-4 top-1/2 transform -translate-y-1/2">(Cannot be changed)</span>
                        </p>
                    </div>
                </div>
                <div className="mt-8 flex justify-end">
                    <button type="submit" disabled={isLoading} className="py-3 px-6 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 transform hover:scale-105 transition-all duration-300 shadow-lg flex items-center justify-center disabled:opacity-50">
                        <Save className="w-4 h-4 mr-2"/>
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>

            {/* Change Password Card */}
            <form onSubmit={handlePasswordUpdate} className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/20 shadow-xl">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Change Password</h2>
                <div className="space-y-6">
                    <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                         <div className="relative">
                            <input 
                                type="password"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleInputChange}
                                placeholder="Enter new password"
                                className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 group-hover:bg-white"
                            />
                            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                                <Lock className="w-3 h-3 text-white" />
                            </div>
                        </div>
                    </div>
                    <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                        <div className="relative">
                            <input 
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                placeholder="Confirm new password"
                                className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 group-hover:bg-white"
                            />
                            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                                <Lock className="w-3 h-3 text-white" />
                            </div>
                        </div>
                    </div>
                </div>
                 <div className="mt-8 flex justify-end">
                    <button type="submit" disabled={isLoading} className="py-3 px-6 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 transform hover:scale-105 transition-all duration-300 shadow-lg flex items-center justify-center disabled:opacity-50">
                        <Save className="w-4 h-4 mr-2"/>
                        {isLoading ? 'Updating...' : 'Update Password'}
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
