import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CallAggregatedDashboard from './components/CallAggregatedDashboard';
import CallReportsList from './components/CallReportsList';
import CallReportDetail from './components/CallReportDetail';
import AudioCallUpload from './components/AudioCallUpload';
import VideoCallsList from './components/VideoCallsList';
import VideoCallDetail from './components/VideoCallDetail';
import VideoAggregatedDashboard from './components/VideoAggregatedDashboard';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          {/* Public Route */}
          <Route path="/" element={<Login />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />


          {/* Audio Call Reports Routes */}
          <Route path="/call-reports" element={<ProtectedRoute><CallReportsList /></ProtectedRoute>} />
          <Route path="/call-reports/upload" element={<ProtectedRoute><AudioCallUpload /></ProtectedRoute>} />
          <Route path="/call-reports/:callId" element={<ProtectedRoute><CallReportDetail /></ProtectedRoute>} />
          <Route path="/call-reports/analytics" element={<ProtectedRoute><CallAggregatedDashboard /></ProtectedRoute>} />

          {/* Video Call Reports Routes */}
          <Route path="/video-reports" element={<ProtectedRoute><VideoCallsList /></ProtectedRoute>} />
          <Route path="/video-reports/:reportId" element={<ProtectedRoute><VideoCallDetail /></ProtectedRoute>} />
          <Route path="/video-reports/analytics" element={<ProtectedRoute><VideoAggregatedDashboard /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
