import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase'; // Correct path

// Corrected paths assuming components are in the same directory
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged returns an unsubscribe function
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []);

  // Show a loading message while checking for user authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* If user is not logged in, show LoginPage, otherwise redirect to Home */}
        <Route 
          path="/login" 
          element={!currentUser ? <LoginPage /> : <Navigate to="/" />} 
        />
        {/* If user is logged in, show HomePage, otherwise redirect to Login */}
        <Route 
          path="/" 
          element={currentUser ? <HomePage /> : <Navigate to="/login" />} 
        />
      </Routes>
    </Router>
  );
}

export default App;
