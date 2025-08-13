import React, { useState } from 'react';
import { User, Stethoscope, Mail, Lock, Eye, EyeOff, ArrowRight, Heart, Shield, Activity } from 'lucide-react';
import { auth, db } from '../firebase'; // Corrected path
import { doc, setDoc } from "firebase/firestore"; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import medicalBackground from '../assets/medical-background.jpg';
const LoginPage = () => {
  const [userType, setUserType] = useState('patient');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: '',
    verificationId: ''
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState(''); // For post-signup message

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccessMessage(''); // Clear messages on new input
  };

  const clearMessagesAndSetLogin = (loginState) => {
    setError('');
    setSuccessMessage('');
    setIsLogin(loginState);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Validate Doctor Verification ID format
    if (userType === 'doctor' && formData.verificationId) {
      const verificationIdRegex = /^\d{6}$/;
      if (!verificationIdRegex.test(formData.verificationId)) {
        setError("Verification ID must be a 6-digit number.");
        return;
      }
    }

    if (isLogin) {
      try {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        // onAuthStateChanged in App.jsx will handle navigation
      } catch (error) {
        console.error("Error signing in:", error);
        setError("Failed to sign in. Please check your credentials.");
      }
    } else { // Sign-up logic
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match!");
        return;
      }
      try {
        // Keep track of the user type during signup to set it correctly after.
        const signedUpUserType = userType;

        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        
        const userData = {
          name: formData.name,
          email: user.email,
          role: signedUpUserType
        };

        if (signedUpUserType === 'doctor') {
          userData.verificationId = formData.verificationId;
          userData.isVerified = true;
        }

        await setDoc(doc(db, "users", user.uid), userData);

        // Sign the user out to prevent automatic navigation to home page
        await auth.signOut();

        // Reset form, switch to Sign In view, and show success message
        setFormData({ email: '', password: '', name: '', confirmPassword: '', verificationId: '' });
        setIsLogin(true);
        setSuccessMessage("Account created successfully! Please sign in.");
        
        // Ensure the user type toggle is set correctly for the login form
        setUserType(signedUpUserType);

      } catch (error) {
        console.error("Error signing up:", error);
        setError("Failed to create an account: " + error.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 relative overflow-hidden">
      {/* Background Pattern and Icons... */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-blue-400 to-teal-400 rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-gradient-to-br from-emerald-400 to-blue-400 rounded-full blur-2xl"></div>
        <div className="absolute bottom-32 left-1/3 w-40 h-40 bg-gradient-to-br from-teal-400 to-emerald-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-28 h-28 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full blur-2xl"></div>
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <Heart className="absolute top-1/4 left-1/4 w-6 h-6 text-red-200 opacity-60 animate-pulse" style={{animationDelay: '0s'}} />
        <Shield className="absolute top-1/3 right-1/4 w-5 h-5 text-blue-200 opacity-50 animate-pulse" style={{animationDelay: '1s'}} />
        <Activity className="absolute bottom-1/3 left-1/5 w-4 h-4 text-emerald-200 opacity-70 animate-pulse" style={{animationDelay: '2s'}} />
        <Stethoscope className="absolute bottom-1/4 right-1/3 w-5 h-5 text-teal-200 opacity-60 animate-pulse" style={{animationDelay: '0.5s'}} />
      </div>

      <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 rounded-3xl mb-6 shadow-2xl transform hover:scale-105 transition-transform duration-300">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent mb-2">
              HealthPal
            </h1>
            <p className="text-gray-600 font-medium">Your trusted healthcare companion</p>
            <div className="w-16 h-0.5 bg-gradient-to-r from-blue-600 to-teal-600 mx-auto mt-3"></div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 p-6">
              <div className="flex justify-center space-x-8">
                <button
                  onClick={() => clearMessagesAndSetLogin(true)}
                  className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
                    isLogin 
                      ? 'bg-white/20 text-white backdrop-blur-sm shadow-lg' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => clearMessagesAndSetLogin(false)}
                  className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
                    !isLogin 
                      ? 'bg-white/20 text-white backdrop-blur-sm shadow-lg' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            <div className="p-8">
              <div className="mb-6">
                <div className="flex justify-center bg-gray-100 p-1 rounded-full border-2 border-gray-200">
                  <button
                    type="button"
                    onClick={() => setUserType('patient')}
                    className={`w-1/2 px-4 py-2 rounded-full font-medium transition-all duration-300 ${userType === 'patient' ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow' : 'text-gray-500 hover:bg-gray-200'}`}
                  >
                    Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserType('doctor')}
                    className={`w-1/2 px-4 py-2 rounded-full font-medium transition-all duration-300 ${userType === 'doctor' ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow' : 'text-gray-500 hover:bg-gray-200'}`}
                  >
                    Doctor
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {!isLogin && (
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleInputChange} 
                        className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 group-hover:bg-white" 
                        placeholder="Enter your full name" 
                        required={!isLogin} 
                      />
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                        <User className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <div className="relative">
                    <input 
                      type="email" 
                      name="email" 
                      value={formData.email} 
                      onChange={handleInputChange} 
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 group-hover:bg-white" 
                      placeholder="Enter your email" 
                      required 
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                      <Mail className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>

                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      name="password" 
                      value={formData.password} 
                      onChange={handleInputChange} 
                      className="w-full pl-12 pr-12 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 group-hover:bg-white" 
                      placeholder="Enter your password" 
                      required 
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                      <Lock className="w-3 h-3 text-white" />
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {!isLogin && (
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        name="confirmPassword" 
                        value={formData.confirmPassword} 
                        onChange={handleInputChange} 
                        className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 group-hover:bg-white" 
                        placeholder="Confirm your password" 
                        required={!isLogin} 
                      />
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                        <Lock className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  </div>
                )}
                
                {userType === 'doctor' && (
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Doctor Verification ID</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        name="verificationId" 
                        value={formData.verificationId} 
                        onChange={handleInputChange} 
                        className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 group-hover:bg-white" 
                        placeholder="Enter your 6-digit ID"
                        required={userType === 'doctor'} 
                        maxLength="6"
                      />
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                        <Shield className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  </div>
                )}

                {successMessage && (
                  <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
                    <p className="text-green-700 text-sm font-medium">{successMessage}</p>
                  </div>
                )}
                {error && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                )}

                <button 
                  type="submit" 
                  className="w-full py-4 px-6 rounded-2xl text-white font-semibold bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 hover:from-blue-700 hover:via-teal-700 hover:to-emerald-700 transform hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl flex items-center justify-center group"
                >
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="ml-3 w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
