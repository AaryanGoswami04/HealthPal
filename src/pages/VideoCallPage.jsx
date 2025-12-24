import React, { useState, useEffect, useRef } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Phone, PhoneOff,
  Monitor, MonitorOff, Volume2, VolumeX, Loader, AlertCircle
} from 'lucide-react';
import Peer from 'peerjs';
import { ref as dbRef, onValue, set, remove, get } from 'firebase/database';
import { rtdb } from '../firebase';

const VideoCallPage = ({ userProfile, appointmentId, onEndCall }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [peerId, setPeerId] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerInstance = useRef(null);
  const callInstance = useRef(null);
  const screenStreamRef = useRef(null);
  const originalVideoTrackRef = useRef(null);
  const connectionAttempts = useRef(0);

  const isDoctor = userProfile?.role === 'doctor';
  const callRoomPath = `videoCalls/${appointmentId}`;

  // Initialize PeerJS
  useEffect(() => {
    try {
      console.log('🔗 Initializing PeerJS...');
      
      // Create a unique peer ID based on user role and appointment
      const uniquePeerId = `${isDoctor ? 'doctor' : 'patient'}-${appointmentId}-${Date.now()}`;
      
      const peer = new Peer(uniquePeerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
          ]
        },
        debug: 2 // Enable debug logs
      });

      peer.on('open', (id) => {
        console.log('✅ PeerJS connected with ID:', id);
        setPeerId(id);
        
        // Store peer ID in Firebase
        const peerData = {
          peerId: id,
          ready: false, // Not ready until media stream is available
          timestamp: Date.now()
        };
        
        set(dbRef(rtdb, `${callRoomPath}/${isDoctor ? 'doctor' : 'patient'}`), peerData)
          .then(() => console.log('✅ Peer data saved to Firebase'))
          .catch(err => console.error('❌ Failed to save peer data:', err));
      });

      peer.on('error', (err) => {
        console.error('❌ PeerJS error:', err);
        
        // More detailed error handling
        if (err.type === 'peer-unavailable') {
          setError('The other participant is not available. They may have disconnected or not joined yet.');
        } else if (err.type === 'network') {
          setError('Network error. Please check your internet connection.');
        } else if (err.type === 'server-error') {
          setError('Server connection error. Please refresh and try again.');
        } else {
          setError(`Connection error: ${err.message || err.type}`);
        }
      });

      // Listen for incoming calls (both doctor and patient can receive)
      peer.on('call', (call) => {
        console.log('📞 Receiving incoming call...');
        
        if (!localStream) {
          console.warn('⚠️ Received call but local stream not ready yet');
          return;
        }
        
        console.log('✅ Answering call with local stream');
        call.answer(localStream);
        callInstance.current = call;
        
        call.on('stream', (remoteStream) => {
          console.log('🎥 Received remote stream from caller');
          setRemoteStream(remoteStream);
          setCallStatus('connected');
          connectionAttempts.current = 0; // Reset attempts on success
        });

        call.on('close', () => {
          console.log('📞 Call closed by remote peer');
          setCallStatus('ended');
        });

        call.on('error', (err) => {
          console.error('❌ Call error:', err);
          setError(`Call error: ${err.message}`);
        });
      });

      peerInstance.current = peer;

      return () => {
        console.log('🧹 Cleaning up PeerJS...');
        if (callInstance.current) {
          callInstance.current.close();
        }
        if (peerInstance.current) {
          peerInstance.current.destroy();
        }
      };
    } catch (err) {
      console.error('❌ Failed to initialize PeerJS:', err);
      setError(`Failed to initialize: ${err.message}`);
    }
  }, [appointmentId, isDoctor]);

  // Initialize local media stream
  useEffect(() => {
    let mounted = true;

    const initializeMedia = async () => {
      try {
        console.log('🎥 Requesting camera and microphone access...');
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        console.log('✅ Media access granted');

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        setLocalStream(stream);
        originalVideoTrackRef.current = stream.getVideoTracks()[0];
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Mark as ready in Firebase once media is available
        if (peerId) {
          const peerData = {
            peerId: peerId,
            ready: true,
            timestamp: Date.now()
          };
          
          set(dbRef(rtdb, `${callRoomPath}/${isDoctor ? 'doctor' : 'patient'}`), peerData)
            .then(() => console.log('✅ Marked as ready in Firebase'))
            .catch(err => console.error('❌ Failed to update ready status:', err));
        }
        
      } catch (err) {
        console.error('❌ Error accessing media devices:', err);
        setError(`Unable to access camera/microphone: ${err.message}`);
      }
    };

    initializeMedia();

    return () => {
      mounted = false;
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [peerId]);

  // Update ready status when local stream becomes available
  useEffect(() => {
    if (localStream && peerId) {
      const peerData = {
        peerId: peerId,
        ready: true,
        timestamp: Date.now()
      };
      
      set(dbRef(rtdb, `${callRoomPath}/${isDoctor ? 'doctor' : 'patient'}`), peerData)
        .then(() => console.log('✅ Updated ready status with stream'))
        .catch(err => console.error('❌ Failed to update ready status:', err));
    }
  }, [localStream, peerId, callRoomPath, isDoctor]);

  // Doctor initiates call when patient is ready
  useEffect(() => {
    if (!isDoctor || !peerId || !localStream) return;

    console.log('👨‍⚕️ Doctor waiting for patient to be ready...');

    const patientRef = dbRef(rtdb, `${callRoomPath}/patient`);
    const unsubscribe = onValue(patientRef, (snapshot) => {
      const patientData = snapshot.val();
      
      if (!patientData) {
        console.log('⏳ Patient has not joined yet');
        return;
      }
      
      console.log('📋 Patient data:', patientData);
      
      // Only call if patient is ready and we haven't already initiated a call
      if (patientData.ready && patientData.peerId && peerInstance.current && !callInstance.current) {
        // Small delay to ensure patient's peer is fully ready
        setTimeout(() => {
          if (!callInstance.current) { // Double check we haven't called yet
            initiateCall(patientData.peerId);
          }
        }, 1000);
      } else if (!patientData.ready) {
        console.log('⏳ Patient joined but not ready yet (waiting for camera/mic)');
      }
    });

    return () => unsubscribe();
  }, [isDoctor, peerId, localStream, callRoomPath]);

  // Function to initiate call with retry logic
  const initiateCall = (targetPeerId) => {
    if (connectionAttempts.current >= 3) {
      setError('Failed to connect after multiple attempts. Please refresh and try again.');
      return;
    }
    
    connectionAttempts.current++;
    console.log(`📞 Attempting to call patient: ${targetPeerId} (attempt ${connectionAttempts.current})`);
    
    try {
      const call = peerInstance.current.call(targetPeerId, localStream);
      
      if (!call) {
        console.error('❌ Failed to create call object');
        setTimeout(() => initiateCall(targetPeerId), 2000);
        return;
      }
      
      callInstance.current = call;

      // Timeout if no stream received in 10 seconds
      const streamTimeout = setTimeout(() => {
        if (!remoteStream) {
          console.warn('⚠️ No stream received, retrying...');
          callInstance.current = null;
          initiateCall(targetPeerId);
        }
      }, 10000);

      call.on('stream', (remoteStream) => {
        clearTimeout(streamTimeout);
        console.log('🎥 Doctor received patient stream');
        setRemoteStream(remoteStream);
        setCallStatus('connected');
        connectionAttempts.current = 0; // Reset on success
      });

      call.on('close', () => {
        clearTimeout(streamTimeout);
        console.log('📞 Call closed');
        setCallStatus('ended');
      });

      call.on('error', (err) => {
        clearTimeout(streamTimeout);
        console.error('❌ Call error:', err);
        
        if (err.type === 'peer-unavailable') {
          console.log('🔄 Peer unavailable, retrying in 2 seconds...');
          callInstance.current = null;
          setTimeout(() => initiateCall(targetPeerId), 2000);
        } else {
          setError(`Call error: ${err.message}`);
        }
      });
    } catch (err) {
      console.error('❌ Failed to initiate call:', err);
      callInstance.current = null;
      
      if (connectionAttempts.current < 3) {
        setTimeout(() => initiateCall(targetPeerId), 2000);
      } else {
        setError(`Failed to start call: ${err.message}`);
      }
    }
  };

  // Patient waits for doctor to be ready (for potential patient-initiated calls)
  useEffect(() => {
    if (isDoctor || !peerId || !localStream) return;

    console.log('🧑‍🦱 Patient is ready and waiting for doctor...');

    const doctorRef = dbRef(rtdb, `${callRoomPath}/doctor`);
    const unsubscribe = onValue(doctorRef, (snapshot) => {
      const doctorData = snapshot.val();
      
      if (doctorData) {
        console.log('👨‍⚕️ Doctor status:', doctorData);
      }
    });

    return () => unsubscribe();
  }, [isDoctor, peerId, localStream, callRoomPath]);

  // Update video elements when streams change
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Monitor connection quality
  useEffect(() => {
    const interval = setInterval(() => {
      setConnectionQuality(remoteStream ? 'good' : 'poor');
    }, 3000);

    return () => clearInterval(interval);
  }, [remoteStream]);

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!callInstance.current) {
      setError('Cannot share screen: No active connection');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      if (!isScreenSharing) {
        console.log('🖥️ Starting screen share...');
        
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace video track
        const sender = callInstance.current.peerConnection
          .getSenders()
          .find(s => s.track?.kind === 'video');

        if (sender) {
          await sender.replaceTrack(screenTrack);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        console.log('🛑 Stopping screen share...');
        
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }

        const videoTrack = originalVideoTrackRef.current || localStream?.getVideoTracks()[0];
        const sender = callInstance.current.peerConnection
          .getSenders()
          .find(s => s.track?.kind === 'video');

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }

        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
        }

        setIsScreenSharing(false);
      }
    } catch (err) {
      console.error('❌ Screen sharing error:', err);
      setError(`Unable to share screen: ${err.message}`);
      setTimeout(() => setError(''), 5000);
    }
  };

  const endCall = () => {
    console.log('📞 Ending call...');
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (callInstance.current) {
      callInstance.current.close();
    }
    if (peerInstance.current) {
      peerInstance.current.destroy();
    }

    remove(dbRef(rtdb, callRoomPath))
      .then(() => console.log('✅ Call data removed'))
      .catch(err => console.error('❌ Error removing call data:', err));

    setCallStatus('ended');
    onEndCall();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto min-h-[calc(100vh-4rem)] flex flex-col">
        <header className="mb-6 bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                callStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                callStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                'bg-red-500'
              }`}></div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
                  Video Consultation
                </h1>
                <span className="text-gray-600 text-sm">
                  {callStatus === 'connected' ? '🟢 Connected' : 
                   callStatus === 'connecting' ? '🟡 Connecting...' : 
                   '🔴 Call Ended'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-gray-600 text-sm bg-white/50 px-3 py-1 rounded-full">
                Appointment #{appointmentId?.slice(-6) || 'N/A'}
              </div>
              {connectionQuality !== 'good' && callStatus === 'connected' && (
                <div className="text-yellow-600 text-sm bg-yellow-50 px-3 py-1 rounded-full">
                  ⚠️ Poor connection
                </div>
              )}
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-center">
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/20 shadow-xl min-h-[300px]">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ display: remoteStream ? 'block' : 'none' }}
            />
            
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center p-6">
                  <Loader className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
                  <p className="text-gray-700 text-lg font-semibold">
                    Waiting for {isDoctor ? 'patient' : 'doctor'} to join...
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Connection attempts: {connectionAttempts.current}
                  </p>
                </div>
              </div>
            )}
            
            <div className="absolute top-4 left-4 bg-blue-600 px-4 py-2 rounded-xl shadow-lg">
              <span className="text-white font-semibold">
                {isDoctor ? '🧑‍🦱 Patient' : '👨‍⚕️ Doctor'}
              </span>
            </div>
          </div>

          <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/20 shadow-xl min-h-[300px]">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ display: localStream && isVideoEnabled ? 'block' : 'none' }}
            />

            {(!localStream || !isVideoEnabled) && (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                  {!localStream ? (
                    <>
                      <Loader className="w-16 h-16 text-white/70 animate-spin mx-auto mb-2" />
                      <p className="text-white/90">Initializing camera...</p>
                    </>
                  ) : (
                    <>
                      <VideoOff className="w-16 h-16 text-white/70 mx-auto mb-2" />
                      <p className="text-white/90">Camera Off</p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="absolute top-4 left-4 bg-teal-600 px-4 py-2 rounded-xl shadow-lg">
              <span className="text-white font-semibold">
                {isDoctor ? '👨‍⚕️ You (Doctor)' : '🧑‍🦱 You (Patient)'}
              </span>
            </div>

            {isScreenSharing && (
              <div className="absolute top-4 right-4 bg-emerald-600 px-4 py-2 rounded-xl shadow-lg flex items-center">
                <Monitor className="w-4 h-4 mr-2" />
                <span className="text-white text-sm font-semibold">Sharing Screen</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center justify-center flex-wrap gap-4">
            <button
              onClick={toggleVideo}
              disabled={!localStream}
              className={`p-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 shadow-lg ${
                isVideoEnabled 
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600' 
                  : 'bg-gradient-to-r from-red-600 to-pink-600'
              }`}
            >
              {isVideoEnabled ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
            </button>

            <button
              onClick={toggleAudio}
              disabled={!localStream}
              className={`p-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 shadow-lg ${
                isAudioEnabled 
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600' 
                  : 'bg-gradient-to-r from-red-600 to-pink-600'
              }`}
            >
              {isAudioEnabled ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
            </button>

            {isDoctor && (
              <button
                onClick={toggleScreenShare}
                disabled={!callInstance.current}
                className={`p-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 shadow-lg ${
                  isScreenSharing 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600' 
                    : 'bg-gradient-to-r from-gray-600 to-gray-700'
                }`}
              >
                {isScreenSharing ? <MonitorOff className="w-6 h-6 text-white" /> : <Monitor className="w-6 h-6 text-white" />}
              </button>
            )}

            <button
              onClick={endCall}
              className="p-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>

          <div className="flex items-center justify-center flex-wrap gap-4 text-gray-600 text-sm">
            <div className="flex items-center bg-blue-50 px-3 py-1 rounded-full">
              <Phone className="w-4 h-4 mr-2 text-blue-600" />
              <span>In Call</span>
            </div>
            {callStatus === 'connected' && (
              <div className="flex items-center">
                {connectionQuality === 'good' ? (
                  <>
                    <Volume2 className="w-4 h-4 mr-2 text-green-600" />
                    <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full">Good Quality</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 mr-2 text-yellow-600" />
                    <span className="text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full">Poor Quality</span>
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

export default VideoCallPage;