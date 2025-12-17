import React, { useState, useEffect, useRef } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Phone, PhoneOff,
  Monitor, MonitorOff, Volume2, VolumeX, Loader, AlertCircle
} from 'lucide-react';
import SimplePeer from 'simple-peer';
import { ref as dbRef, onValue, set, remove } from 'firebase/database';
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
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const screenStreamRef = useRef(null);
  const originalVideoTrackRef = useRef(null);

  const isDoctor = userProfile?.role === 'doctor';
  const callRoomPath = `videoCalls/${appointmentId}`;

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
        
        console.log('✅ Media access granted:', {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        setLocalStream(stream);
        originalVideoTrackRef.current = stream.getVideoTracks()[0];
        
        // Set local video immediately
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          console.log('✅ Local video element updated');
        }
        
      } catch (err) {
        console.error('❌ Error accessing media devices:', err);
        setError(`Unable to access camera/microphone: ${err.message}`);
      }
    };

    initializeMedia();

    return () => {
      mounted = false;
      console.log('🧹 Cleaning up media streams...');
      
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped ${track.kind} track`);
        });
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  // Update video element when localStream changes
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      console.log('✅ Updated local video element with stream');
    }
  }, [localStream]);

  // Update remote video element when remoteStream changes
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      console.log('✅ Updated remote video element with stream');
    }
  }, [remoteStream]);

  // WebRTC signaling logic
  useEffect(() => {
    if (!localStream) {
      console.log('⏳ Waiting for local stream before setting up WebRTC...');
      return;
    }

    let unsubscribeAnswer;
    let unsubscribeOffer;
    const callRef = dbRef(rtdb, callRoomPath);
    
    console.log(`🔗 Setting up WebRTC for ${isDoctor ? 'DOCTOR' : 'PATIENT'}`);
    
    // Doctor initiates the call (creates offer)
    if (isDoctor) {
      console.log('👨‍⚕️ Doctor creating peer connection...');
      
      try {
        const peer = new SimplePeer({
          initiator: true,
          trickle: false,
          stream: localStream,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' }
            ]
          }
        });

        peer.on('signal', (signal) => {
          console.log('📡 Doctor sending offer signal to Firebase...');
          set(dbRef(rtdb, `${callRoomPath}/offer`), signal)
            .then(() => console.log('✅ Offer saved to Firebase'))
            .catch(err => console.error('❌ Failed to save offer:', err));
        });

        peer.on('stream', (stream) => {
          console.log('🎥 Doctor receiving patient stream:', {
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length
          });
          setRemoteStream(stream);
          setCallStatus('connected');
        });

        peer.on('connect', () => {
          console.log('✅ Doctor peer connection established');
        });

        peer.on('error', (err) => {
          console.error('❌ Doctor peer error:', err);
          setError(`Connection error: ${err.message}`);
        });

        peer.on('close', () => {
          console.log('🔌 Doctor peer connection closed');
        });

        // Listen for patient's answer
        const answerRef = dbRef(rtdb, `${callRoomPath}/answer`);
        unsubscribeAnswer = onValue(answerRef, (snapshot) => {
          const answer = snapshot.val();
          if (answer && !peer.destroyed) {
            console.log('📨 Doctor received answer from patient');
            try {
              peer.signal(answer);
            } catch (err) {
              console.error('❌ Error signaling answer:', err);
            }
          }
        });

        peerRef.current = peer;
      } catch (err) {
        console.error('❌ FATAL: Failed to create peer connection:', err);
        setError(`Failed to initialize video call: ${err.message}. Please refresh and try again.`);
      }

    } else {
      // Patient joins and creates answer
      console.log('🧑‍🦱 Patient waiting for doctor offer...');
      
      const offerRef = dbRef(rtdb, `${callRoomPath}/offer`);
      unsubscribeOffer = onValue(offerRef, (snapshot) => {
        const offer = snapshot.val();
        
        if (offer && !peerRef.current) {
          console.log('📨 Patient received offer from doctor');
          
          try {
            const peer = new SimplePeer({
              initiator: false,
              trickle: false,
              stream: localStream,
              config: {
                iceServers: [
                  { urls: 'stun:stun.l.google.com:19302' },
                  { urls: 'stun:stun1.l.google.com:19302' },
                  { urls: 'stun:stun2.l.google.com:19302' },
                  { urls: 'stun:stun3.l.google.com:19302' },
                  { urls: 'stun:stun4.l.google.com:19302' }
                ]
              }
            });

            peer.on('signal', (signal) => {
              console.log('📡 Patient sending answer signal to Firebase...');
              set(dbRef(rtdb, `${callRoomPath}/answer`), signal)
                .then(() => console.log('✅ Answer saved to Firebase'))
                .catch(err => console.error('❌ Failed to save answer:', err));
            });

            peer.on('stream', (stream) => {
              console.log('🎥 Patient receiving doctor stream:', {
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length
              });
              setRemoteStream(stream);
              setCallStatus('connected');
            });

            peer.on('connect', () => {
              console.log('✅ Patient peer connection established');
            });

            peer.on('error', (err) => {
              console.error('❌ Patient peer error:', err);
              setError(`Connection error: ${err.message}`);
            });

            peer.on('close', () => {
              console.log('🔌 Patient peer connection closed');
            });

            try {
              peer.signal(offer);
            } catch (err) {
              console.error('❌ Error signaling offer:', err);
            }

            peerRef.current = peer;
          } catch (err) {
            console.error('❌ FATAL: Failed to create peer connection:', err);
            setError(`Failed to join video call: ${err.message}. Please refresh and try again.`);
          }
        }
      });
    }

    // Monitor connection quality
    const qualityInterval = setInterval(() => {
      if (peerRef.current && !peerRef.current.destroyed) {
        setConnectionQuality(remoteStream ? 'good' : 'poor');
      }
    }, 3000);

    return () => {
      console.log('🧹 Cleaning up WebRTC signaling...');
      clearInterval(qualityInterval);
      
      if (unsubscribeAnswer) unsubscribeAnswer();
      if (unsubscribeOffer) unsubscribeOffer();
      
      // Clean up Firebase references
      remove(callRef).catch(err => console.error('Error removing call data:', err));
    };
  }, [localStream, isDoctor, appointmentId, callRoomPath]);

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log(`📹 Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log(`🎤 Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!peerRef.current) {
      setError('Cannot share screen: No active connection');
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
        
        // Replace video track with screen track
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerRef.current._pc.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender) {
          await sender.replaceTrack(screenTrack);
          console.log('✅ Screen track replaced');
        }

        // Update local video display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Listen for screen share stop (user clicks "Stop sharing" in browser)
        screenTrack.onended = () => {
          console.log('🛑 Screen share stopped by user');
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        
      } else {
        console.log('🛑 Stopping screen share...');
        
        // Stop screen sharing tracks
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }

        // Return to camera
        const videoTrack = originalVideoTrackRef.current || localStream.getVideoTracks()[0];
        const sender = peerRef.current._pc.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
          console.log('✅ Camera track restored');
        }

        // Update local video display
        if (localVideoRef.current) {
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
    
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Destroy peer connection
    if (peerRef.current) {
      peerRef.current.destroy();
      console.log('Peer connection destroyed');
    }

    // Clean up Firebase
    remove(dbRef(rtdb, callRoomPath))
      .then(() => console.log('✅ Call data removed from Firebase'))
      .catch(err => console.error('❌ Error removing call data:', err));

    setCallStatus('ended');
    onEndCall();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto min-h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
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
                Appointment #{appointmentId.slice(-6)}
              </div>
              {connectionQuality !== 'good' && callStatus === 'connected' && (
                <div className="text-yellow-600 text-sm bg-yellow-50 px-3 py-1 rounded-full flex items-center">
                  ⚠️ Poor connection
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-center shadow-lg">
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Video Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Remote Video (Doctor/Patient) */}
          <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/20 shadow-xl">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ display: remoteStream ? 'block' : 'none' }}
            />
            
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                  <Loader className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
                  <p className="text-gray-700 text-lg font-semibold">
                    Waiting for {isDoctor ? 'patient' : 'doctor'} to join...
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Make sure they've clicked "Join Video Call"
                  </p>
                </div>
              </div>
            )}
            
            {/* Remote user label */}
            <div className="absolute top-4 left-4 bg-blue-600 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg">
              <span className="text-white font-semibold">
                {isDoctor ? '🧑‍🦱 Patient' : '👨‍⚕️ Doctor'}
              </span>
            </div>
          </div>

          {/* Local Video (You) */}
          <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/20 shadow-xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ display: localStream && isVideoEnabled ? 'block' : 'none' }}
            />

            {/* Video off overlay */}
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

            {/* Local user label */}
            <div className="absolute top-4 left-4 bg-teal-600 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg">
              <span className="text-white font-semibold">
                {isDoctor ? '👨‍⚕️ You (Doctor)' : '🧑‍🦱 You (Patient)'}
              </span>
            </div>

            {/* Screen sharing indicator */}
            {isScreenSharing && (
              <div className="absolute top-4 right-4 bg-emerald-600 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg flex items-center">
                <Monitor className="w-4 h-4 mr-2" />
                <span className="text-white text-sm font-semibold">Sharing Screen</span>
              </div>
            )}
          </div>
        </div>

        {/* Control Bar */}
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center justify-center space-x-4">
            {/* Toggle Video */}
            <button
              onClick={toggleVideo}
              disabled={!localStream}
              className={`p-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                isVideoEnabled 
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' 
                  : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700'
              }`}
              title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              {isVideoEnabled ? (
                <Video className="w-6 h-6 text-white" />
              ) : (
                <VideoOff className="w-6 h-6 text-white" />
              )}
            </button>

            {/* Toggle Audio */}
            <button
              onClick={toggleAudio}
              disabled={!localStream}
              className={`p-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                isAudioEnabled 
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' 
                  : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700'
              }`}
              title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {isAudioEnabled ? (
                <Mic className="w-6 h-6 text-white" />
              ) : (
                <MicOff className="w-6 h-6 text-white" />
              )}
            </button>

            {/* Screen Share (Doctor only) */}
            {isDoctor && (
              <button
                onClick={toggleScreenShare}
                disabled={!localStream || !peerRef.current}
                className={`p-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                  isScreenSharing 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' 
                    : 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800'
                }`}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              >
                {isScreenSharing ? (
                  <MonitorOff className="w-6 h-6 text-white" />
                ) : (
                  <Monitor className="w-6 h-6 text-white" />
                )}
              </button>
            )}

            {/* End Call */}
            <button
              onClick={endCall}
              className="p-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all duration-300 transform hover:scale-105 shadow-lg"
              title="End call"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Call Info */}
          <div className="flex items-center justify-center space-x-6 text-gray-600 text-sm">
            <div className="flex items-center bg-blue-50 px-3 py-1 rounded-full">
              <Phone className="w-4 h-4 mr-2 text-blue-600" />
              <span>In Call</span>
            </div>
            {callStatus === 'connected' && (
              <div className="flex items-center">
                {connectionQuality === 'good' ? (
                  <>
                    <Volume2 className="w-4 h-4 mr-2 text-green-600" />
                    <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full">
                      Good Quality
                    </span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 mr-2 text-yellow-600" />
                    <span className="text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full">
                      Poor Quality
                    </span>
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