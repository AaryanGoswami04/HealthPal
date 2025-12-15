import React, { useState, useEffect, useRef } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Phone, PhoneOff,
  Monitor, MonitorOff, Camera, Volume2, VolumeX, Loader
} from 'lucide-react';
import SimplePeer from 'simple-peer';
import { ref as dbRef, onValue, set, remove, push } from 'firebase/database';
import { rtdb } from '../firebase';

const VideoCallPage = ({ userProfile, appointmentId, onEndCall }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState('connecting'); // connecting, connected, ended
  const [error, setError] = useState('');
  const [connectionQuality, setConnectionQuality] = useState('good');
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const screenStreamRef = useRef(null);

  const isDoctor = userProfile?.role === 'doctor';
  const callRoomPath = `videoCalls/${appointmentId}`;

  // Initialize local media stream
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        console.log('✅ Local media initialized');
      } catch (err) {
        console.error('❌ Error accessing media devices:', err);
        setError('Unable to access camera/microphone. Please check permissions.');
      }
    };

    initializeMedia();

    return () => {
      // Cleanup on unmount
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  // WebRTC signaling logic
  useEffect(() => {
    if (!localStream) return;

    const callRef = dbRef(rtdb, callRoomPath);
    
    // Doctor initiates the call (creates offer)
    if (isDoctor) {
      console.log('👨‍⚕️ Doctor initiating call...');
      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: localStream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });

      peer.on('signal', (signal) => {
        console.log('📡 Doctor sending signal...');
        set(dbRef(rtdb, `${callRoomPath}/offer`), signal);
      });

      peer.on('stream', (stream) => {
        console.log('🎥 Doctor receiving patient stream');
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
        setCallStatus('connected');
      });

      peer.on('error', (err) => {
        console.error('❌ Peer error:', err);
        setError('Connection error occurred');
      });

      // Listen for patient's answer
      const answerRef = dbRef(rtdb, `${callRoomPath}/answer`);
      onValue(answerRef, (snapshot) => {
        const answer = snapshot.val();
        if (answer && !peer.destroyed) {
          console.log('📨 Doctor received answer from patient');
          peer.signal(answer);
        }
      });

      peerRef.current = peer;

    } else {
      // Patient joins and creates answer
      console.log('🧑‍🦱 Patient joining call...');
      
      const offerRef = dbRef(rtdb, `${callRoomPath}/offer`);
      onValue(offerRef, (snapshot) => {
        const offer = snapshot.val();
        if (offer && !peerRef.current) {
          console.log('📨 Patient received offer from doctor');
          
          const peer = new SimplePeer({
            initiator: false,
            trickle: false,
            stream: localStream,
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
              ]
            }
          });

          peer.on('signal', (signal) => {
            console.log('📡 Patient sending answer...');
            set(dbRef(rtdb, `${callRoomPath}/answer`), signal);
          });

          peer.on('stream', (stream) => {
            console.log('🎥 Patient receiving doctor stream');
            setRemoteStream(stream);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            }
            setCallStatus('connected');
          });

          peer.on('error', (err) => {
            console.error('❌ Peer error:', err);
            setError('Connection error occurred');
          });

          peer.signal(offer);
          peerRef.current = peer;
        }
      });
    }

    // Monitor connection quality
    const qualityInterval = setInterval(() => {
      if (peerRef.current) {
        // Simple quality monitoring based on connection state
        setConnectionQuality(remoteStream ? 'good' : 'poor');
      }
    }, 3000);

    return () => {
      clearInterval(qualityInterval);
      // Clean up Firebase references when call ends
      remove(callRef);
    };
  }, [localStream, isDoctor, appointmentId]);

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
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });

        screenStreamRef.current = screenStream;
        
        // Replace video track with screen track
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerRef.current._pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }

        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Listen for screen share stop
        screenTrack.onended = () => {
          toggleScreenShare(); // Stop screen sharing
        };

        setIsScreenSharing(true);
      } else {
        // Stop screen sharing, return to camera
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
        }

        const videoTrack = localStream.getVideoTracks()[0];
        const sender = peerRef.current._pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        setIsScreenSharing(false);
      }
    } catch (err) {
      console.error('Screen sharing error:', err);
      setError('Unable to share screen');
    }
  };

  const endCall = () => {
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Destroy peer connection
    if (peerRef.current) {
      peerRef.current.destroy();
    }

    // Clean up Firebase
    remove(dbRef(rtdb, callRoomPath));

    setCallStatus('ended');
    onEndCall();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 h-screen flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              callStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
              callStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
              'bg-red-500'
            }`}></div>
            <span className="text-white font-semibold">
              {callStatus === 'connected' ? '🟢 Connected' : 
               callStatus === 'connecting' ? '🟡 Connecting...' : 
               '🔴 Call Ended'}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-white/70 text-sm">
              Appointment #{appointmentId.slice(-6)}
            </div>
            {connectionQuality !== 'good' && (
              <div className="text-yellow-400 text-sm">⚠️ Poor connection</div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500 text-white p-4 rounded-xl">
            ⚠️ {error}
          </div>
        )}

        {/* Video Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Remote Video (Doctor/Patient) */}
          <div className="relative bg-gray-900/50 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Loader className="w-16 h-16 text-white/50 animate-spin mx-auto mb-4" />
                  <p className="text-white/70">Waiting for {isDoctor ? 'patient' : 'doctor'} to join...</p>
                </div>
              </div>
            )}
            
            {/* Remote user label */}
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full">
              <span className="text-white font-semibold">
                {isDoctor ? '🧑‍🦱 Patient' : '👨‍⚕️ Doctor'}
              </span>
            </div>
          </div>

          {/* Local Video (You) */}
          <div className="relative bg-gray-900/50 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            {localStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader className="w-16 h-16 text-white/50 animate-spin" />
              </div>
            )}

            {/* Video off overlay */}
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <VideoOff className="w-16 h-16 text-white/50 mx-auto mb-2" />
                  <p className="text-white/70">Camera Off</p>
                </div>
              </div>
            )}

            {/* Local user label */}
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full">
              <span className="text-white font-semibold">
                {isDoctor ? '👨‍⚕️ You (Doctor)' : '🧑‍🦱 You (Patient)'}
              </span>
            </div>

            {/* Screen sharing indicator */}
            {isScreenSharing && (
              <div className="absolute top-4 right-4 bg-blue-500/80 backdrop-blur-md px-4 py-2 rounded-full flex items-center">
                <Monitor className="w-4 h-4 mr-2" />
                <span className="text-white text-sm">Sharing Screen</span>
              </div>
            )}
          </div>
        </div>

        {/* Control Bar */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-6">
          <div className="flex items-center justify-center space-x-4">
            {/* Toggle Video */}
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
                isVideoEnabled 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-red-600 hover:bg-red-700'
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
              className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
                isAudioEnabled 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-red-600 hover:bg-red-700'
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
                className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
                  isScreenSharing 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-600 hover:bg-gray-700'
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
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all duration-300 transform hover:scale-110"
              title="End call"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Call Duration & Quality */}
          <div className="mt-4 flex items-center justify-center space-x-6 text-white/60 text-sm">
            <div className="flex items-center">
              <Phone className="w-4 h-4 mr-2" />
              <span>In Call</span>
            </div>
            {callStatus === 'connected' && (
              <div className="flex items-center">
                {connectionQuality === 'good' ? (
                  <Volume2 className="w-4 h-4 mr-2 text-green-500" />
                ) : (
                  <VolumeX className="w-4 h-4 mr-2 text-yellow-500" />
                )}
                <span className={connectionQuality === 'good' ? 'text-green-500' : 'text-yellow-500'}>
                  {connectionQuality === 'good' ? 'Good Quality' : 'Poor Quality'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCallPage;