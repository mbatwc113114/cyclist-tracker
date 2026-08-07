import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, push, set, get, update } from 'firebase/database';
import { MapContainer, TileLayer, Polyline, useMap, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Play, Square, X, AlertTriangle } from 'lucide-react';
import AnalogSpeedometer from '../components/AnalogSpeedometer';

// Haversine distance
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

// Map Updater Component to ensure map follows user
function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom());
  }, [position, map]);
  return null;
}

export default function Record({ user }) {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [timer, setTimer] = useState(0);
  const [distance, setDistance] = useState(0); 
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [route, setRoute] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(() => {
    const saved = localStorage.getItem('lastKnownLocation');
    return saved ? JSON.parse(saved) : null;
  });
  const [permissionError, setPermissionError] = useState('');
  
  const watchIdRef = useRef(null);
  const isRecordingRef = useRef(isRecording);

  // Keep ref in sync with state for the GPS closure
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Check permissions on mount
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'denied') setPermissionError('Location access is denied. Please enable it.');
      });
    }
  }, []);

  // Timer
  useEffect(() => {
    let interval;
    if (isRecording && sessionStartTime) {
      interval = setInterval(() => {
        setTimer(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording, sessionStartTime]);

  // High-Precision GPS Pre-Warming & Tracking
  useEffect(() => {
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, speed, accuracy } = position.coords;
          
          // 1. STRAVA ALGORITHM: Reject highly inaccurate GPS bounces
          // Relaxed to 100 meters to ensure it locks on even if you are indoors or have a weak signal
          if (accuracy > 100) return; 

          const newPos = [latitude, longitude];
          setCurrentPosition(newPos); // Always update map center (Pre-warming)
          localStorage.setItem('lastKnownLocation', JSON.stringify(newPos));

          // 2. Only log to route and update stats IF the user pressed Start
          if (isRecordingRef.current) {
            const speedKmh = speed ? (speed * 3.6) : 0;
            setLiveSpeed(speedKmh);
            
            setRoute(prevRoute => {
              if (prevRoute.length > 0) {
                const lastPos = prevRoute[prevRoute.length - 1];
                const dist = getDistanceFromLatLonInKm(lastPos[0], lastPos[1], latitude, longitude);
                
                // 3. STRAVA ALGORITHM: Drift Filtering
                // Only plot the point if we moved more than 2 meters (0.002 km) to prevent static squiggling
                if (dist < 0.002) return prevRoute;

                setDistance(d => d + dist);
              }
              return [...prevRoute, newPos];
            });
          }
        },
        (error) => {
          // Gracefully ignore timeout/unavailable errors to prevent flashing red banners
          if (error.code === 1) {
            setPermissionError('Location access denied. Please enable GPS.');
          }
        },
        // maximumAge: 0 forces it to not use cached positions. enableHighAccuracy triggers device GPS/IMU fusion.
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      setPermissionError('Geolocation is not supported by your browser.');
    }

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartStop = async () => {
    if (!currentPosition && !isRecording) {
      setPermissionError('Waiting for GPS lock... Please wait.');
      return;
    }

    if (permissionError) {
      navigator.geolocation.getCurrentPosition(
        pos => { setPermissionError(''); setCurrentPosition([pos.coords.latitude, pos.coords.longitude]); },
        err => setPermissionError('Please enable location access in settings.')
      );
      return;
    }

    if (isRecording) {
      // STOP RECORDING & SAVE
      setIsRecording(false);
      setSessionStartTime(null);
      if (distance > 0 || timer > 0) {
        const ridesRef = ref(database, `rides/${user.uid}`);
        await set(push(ridesRef), {
          duration: timer,
          distance: distance.toFixed(2),
          date: Date.now(),
          route: route,
          userName: user.displayName,
          userPhoto: user.photoURL
        });
        
        // Update user stats
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const u = snapshot.val();
          await update(userRef, {
            totalDistance: (u.totalDistance || 0) + distance,
            totalTime: (u.totalTime || 0) + timer
          });
        }
      }
      navigate('/dashboard'); 
    } else {
      // START RECORDING
      setIsRecording(true);
      setSessionStartTime(Date.now() - (timer * 1000));
      // Force an immediate plot of the current known good position
      setRoute([currentPosition]);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <button 
        onClick={() => navigate('/dashboard')} 
        style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 1000, background: 'var(--bg-panel)', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'var(--glass-blur)' }}
      >
        <X size={24} color="white" />
      </button>

      {permissionError && (
        <div style={{ position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--danger-color)', color: 'white', padding: '12px 24px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', width: '90%', maxWidth: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <AlertTriangle size={20} />
          <span style={{fontSize: '14px'}}>{permissionError}</span>
        </div>
      )}

      {/* Map */}
      <div style={{width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0}}>
         {!currentPosition ? (
            <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', background: 'var(--bg-dark)'}}>
               <div className="spinner" style={{width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
               <div style={{color: 'var(--text-muted)'}}>Acquiring GPS Signal...</div>
               <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
         ) : (
            <MapContainer center={currentPosition} zoom={16} style={{ width: '100%', height: '100%' }} zoomControl={false}>
              <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
              <Polyline positions={route} color="var(--primary-color)" weight={6} opacity={0.9} />
              <CircleMarker center={currentPosition} radius={8} pathOptions={{ color: 'white', weight: 3, fillColor: '#007AFF', fillOpacity: 1 }} />
              <MapUpdater position={currentPosition} />
            </MapContainer>
         )}
      </div>

      {/* Fading Gradient Bottom Sheet */}
      <div style={{ position: 'absolute', bottom: '0px', left: 0, width: '100%', background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.85) 100%)', padding: '60px 0 32px 0', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
         
         <AnalogSpeedometer speed={liveSpeed} />

         <div style={{display: 'flex', justifyContent: 'space-evenly', width: '100%', marginTop: '16px', marginBottom: '24px'}}>
            <div style={{textAlign: 'center'}}>
               <div style={{fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Time</div>
               <div style={{fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace', color: 'white'}}>{formatTime(timer)}</div>
            </div>
            <div style={{textAlign: 'center'}}>
               <div style={{fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Distance</div>
               <div style={{fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace', color: 'white'}}>{distance.toFixed(2)} <span style={{fontSize: '1rem', color: 'var(--text-muted)'}}>km</span></div>
            </div>
         </div>

         <button 
            onClick={handleStartStop}
            style={{
               background: isRecording ? 'var(--danger-color)' : 'var(--primary-color)',
               color: 'white', border: 'none', borderRadius: '50%',
               width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center',
               cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
            }}
         >
            {isRecording ? <Square size={28}/> : <Play size={28} style={{marginLeft: '6px'}}/>}
         </button>
      </div>
    </div>
  );
}
