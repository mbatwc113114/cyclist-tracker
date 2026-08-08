import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, push, set, get, update } from 'firebase/database';
import { MapContainer, TileLayer, Polyline, useMap, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Play, Square, X, AlertTriangle, Map as MapIcon } from 'lucide-react';
import AnalogSpeedometer from '../components/AnalogSpeedometer';
import ColoredRoute from '../components/ColoredRoute';
import { useData } from '../contexts/DataContext';
import { TrackFusionEngine } from '../utils/track-engine/TrackFusionEngine';
import { HighAccuracyCalorieEngine } from '../utils/HighAccuracyCalorieEngine';
import { Haptics } from '../utils/haptics';
// 2. OSRM Map Matching (Snap to Roads)
async function snapToRoad(points) {
    if (points.length < 2) return points;
    const coords = points.map(p => `${p[1]},${p[0]}`).join(';');
    try {
        const res = await fetch(`https://router.project-osrm.org/match/v1/bicycle/${coords}?geometries=geojson&overview=full`);
        const data = await res.json();
        if (data.code === 'Ok' && data.matchings && data.matchings.length > 0) {
            return data.matchings[0].geometry.coordinates.map(c => [c[1], c[0]]);
        }
    } catch(e) {
        console.error("OSRM Match failed", e);
    }
    return points;
}

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
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [elevationGain, setElevationGain] = useState(0);
  const wakeLockRef = useRef(null);
  const lastAltitudeRef = useRef(null);
  
  const [snappedRoute, setSnappedRoute] = useState([]);
  
  // High Accuracy Engine State
  const engineRef = useRef(null);
  const [engineCalories, setEngineCalories] = useState(0);
  const [useHighAccuracyEngine, setUseHighAccuracyEngine] = useState(true);
  
  // Load Route State
  const { allRides } = useData();
  const allRoutes = allRides.filter(r => r.route && r.route.length > 0);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [loadedRoute, setLoadedRoute] = useState(null);
  
  const watchIdRef = useRef(null);
  const trackEngineRef = useRef(null);
  const isRecordingRef = useRef(isRecording);
  const pointsSinceLastSnap = useRef([]);
  const lastSnappedPoint = useRef(null);
  const isStationaryRef = useRef(false);

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

  // IMU Sensor Fusion: Zero-Velocity Update (ZUPT) & High Accuracy Physics Engine
  useEffect(() => {
    let stationaryTimeout;
    const handleMotion = (e) => {
      if (!e.acceleration) return;
      const { x, y, z } = e.acceleration;
      const mag = Math.sqrt((x||0)*(x||0) + (y||0)*(y||0) + (z||0)*(z||0));
      
      if (engineRef.current && isRecordingRef.current) {
         engineRef.current.updateIMU(x, y, z);
      }
      
      if (mag > 0.5) { // Physical movement detected
         isStationaryRef.current = false;
         clearTimeout(stationaryTimeout);
         stationaryTimeout = setTimeout(() => {
            isStationaryRef.current = true; // No movement for 3s -> Pause GPS
         }, 3000);
      }
    };
    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      clearTimeout(stationaryTimeout);
    };
  }, []);

  // Timer & Engine Loop
  useEffect(() => {
    let timerInterval;
    let engineInterval;

    if (isRecording && sessionStartTime) {
      timerInterval = setInterval(() => {
        setTimer(Math.floor((Date.now() - sessionStartTime) / 1000));
        
        // Update UI calories at 1Hz
        if (engineRef.current) {
           const metrics = engineRef.current.getMetrics();
           setEngineCalories(metrics.calories);
        }
        
        // Update stats from track engine
        if (trackEngineRef.current) {
            const stats = trackEngineRef.current.getStats();
            setDistance(stats.distanceKm);
            setMaxSpeed(stats.maxSpeedKmh);
            
            // Sync track state for rendering
            const processed = trackEngineRef.current.getProcessedTrack();
            if (processed.length > 0) {
                // Map processed track to old [lat, lng, speed] format for existing ColoredRoute temporarily
                const mappedRoute = processed.map(p => [p.lat, p.lng, p.speed_kmh]);
                setRoute(mappedRoute);
                
                // Keep the live speed updated based on the engine
                setLiveSpeed(processed[processed.length - 1].speed_kmh);
            }
        }
      }, 1000);

      // Fast physics engine tick (10Hz)
      engineInterval = setInterval(() => {
         if (engineRef.current) {
            engineRef.current.processTick();
         }
      }, 100);
    } else {
      clearInterval(timerInterval);
      clearInterval(engineInterval);
    }
    return () => {
       clearInterval(timerInterval);
       clearInterval(engineInterval);
    }
  }, [isRecording, sessionStartTime]);

  // Handle visibility change for WakeLock
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isRecording && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch (err) {
          console.error(`WakeLock error: ${err.message}`);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording]);

  // High-Precision GPS Pre-Warming & Tracking
  useEffect(() => {
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, speed, accuracy, altitude } = position.coords;
          
          if (accuracy > 25) return; // Ignore points with poor accuracy completely

          if (isStationaryRef.current && isRecordingRef.current) return;

          const speedKmh = speed ? (speed * 3.6) : 0;
          const newPos = [latitude, longitude, speedKmh];

          setCurrentPosition(newPos); 
          localStorage.setItem('lastKnownLocation', JSON.stringify(newPos));

          if (isRecordingRef.current) {
            // Push to new Track Engine
            if (trackEngineRef.current) {
                trackEngineRef.current.pushGPS(latitude, longitude, altitude, speed, accuracy, Date.now());
            }

            if (engineRef.current) {
               engineRef.current.updateGPS(speed, altitude, accuracy);
            }

            if (altitude !== null) {
              if (lastAltitudeRef.current !== null && altitude > lastAltitudeRef.current) {
                setElevationGain(prev => prev + (altitude - lastAltitudeRef.current));
              }
              lastAltitudeRef.current = altitude;
            }
          }
        },
        (error) => {
          if (error.code === 1) setPermissionError('Location access denied. Please enable GPS.');
        },
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
      Haptics.medium();
      setIsRecording(false);
      setSessionStartTime(null);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.error);
        wakeLockRef.current = null;
      }
      
      if (distance > 0 || timer > 0) {
        const finalRouteToSave = trackEngineRef.current ? trackEngineRef.current.getProcessedTrack() : route;
        const rawTrackToSave = trackEngineRef.current ? trackEngineRef.current.getRawTrack() : [];
        const ridesRef = ref(database, `rides/${user.uid}`);
        const newRideRef = push(ridesRef);
        const avgSpeed = timer > 0 ? (distance / (timer / 3600)).toFixed(2) : 0;
        
        const rideCalories = useHighAccuracyEngine && engineRef.current 
              ? engineRef.current.getMetrics().calories 
              : (distance * 35);
        
        const endTime = Date.now();
        const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: false });
        const dateFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
        const startStr = formatter.format(new Date(sessionStartTime || (endTime - (timer * 1000))));
        const endStr = formatter.format(new Date(endTime));
        const dateStr = dateFormatter.format(new Date(sessionStartTime || (endTime - (timer * 1000))));
        const rideTitle = `${startStr} - ${endStr} - ${dateStr}`;

        await set(newRideRef, {
          title: rideTitle,
          duration: timer,
          distance: distance.toFixed(2),
          maxSpeed: maxSpeed.toFixed(2),
          averageSpeed: avgSpeed,
          elevationGain: elevationGain.toFixed(2),
          calories: rideCalories.toFixed(0),
          date: endTime,
          route: finalRouteToSave,
          rawTrack: rawTrackToSave,
          userName: user.displayName,
          userPhoto: user.photoURL
        });
        
        // Invalidate cache global
        const metaRef = ref(database, 'metadata/lastUpdated');
        await set(metaRef, Date.now());
        
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
        navigate(`/ride/${user.uid}/${newRideRef.key}`); 
      } else {
        navigate('/dashboard');
      }
    } else {
      // START RECORDING
      Haptics.medium();
      setIsRecording(true);
      setSessionStartTime(Date.now() - (timer * 1000));
      setMaxSpeed(0);
      setElevationGain(0);
      setEngineCalories(0);
      lastAltitudeRef.current = null;
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(lock => { wakeLockRef.current = lock; }).catch(console.error);
      }
      
      trackEngineRef.current = new TrackFusionEngine();
      
      engineRef.current = new HighAccuracyCalorieEngine({});
      engineRef.current.startMountCalibration();
      setTimeout(() => {
         if (engineRef.current) engineRef.current.finishMountCalibration();
      }, 5000);

      // Force an immediate plot of the current known good position
      setRoute([currentPosition]);
      pointsSinceLastSnap.current = [currentPosition];
      lastSnappedPoint.current = null;
    }
  };

  return (
    <div className="page-enter-active" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <button 
        onClick={() => navigate('/dashboard')} 
        style={{ position: 'absolute', top: 'var(--space-xxl)', left: 'var(--space-xl)', zIndex: 1000, background: 'var(--surface-card-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-card)' }}
      >
        <X size={22} color="var(--text-primary)" />
      </button>

      <button 
        className="btn btn-secondary"
        onClick={() => { Haptics.light(); setShowRouteModal(true); }} 
        style={{ position: 'absolute', top: 'var(--space-xxl)', right: 'var(--space-xl)', zIndex: 1000, height: '44px', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-card)' }}
      >
        <MapIcon size={18} />
        Load Route
      </button>

      {showRouteModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xxl)' }}>
           <div className="card" style={{ width: '100%', maxWidth: '400px', maxHeight: '80%', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                 <h3 className="text-h3" style={{ margin: 0 }}>Load a Route</h3>
                 <button onClick={() => setShowRouteModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}><X size={24} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                 {allRoutes.map(r => (
                    <div key={r.id} className="btn" onClick={() => { Haptics.light(); setLoadedRoute(r.route); setShowRouteModal(false); }} style={{ padding: 'var(--space-md)', background: 'var(--surface-card-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                       <span className="text-body-small" style={{fontWeight: 600, color: 'var(--text-primary)'}}>{r.userName}'s Route</span>
                       <span className="text-body-small" style={{ color: 'var(--primary-main)', fontWeight: 700 }}>{r.distance} km</span>
                    </div>
                 ))}
                 {allRoutes.length === 0 && <div className="text-body" style={{ color: 'var(--text-muted)' }}>No routes found.</div>}
              </div>
              {loadedRoute && (
                 <button className="btn btn-danger" onClick={() => { Haptics.warning(); setLoadedRoute(null); setShowRouteModal(false); }} style={{ marginTop: 'var(--space-lg)', width: '100%' }}>
                    Clear Loaded Route
                 </button>
              )}
           </div>
        </div>
      )}

      {permissionError && (
        <div style={{ position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--semantic-error)', color: 'white', padding: '12px 24px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '8px', width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow-floating)' }}>
          <AlertTriangle size={20} />
          <span className="text-body-small" style={{fontWeight: 600}}>{permissionError}</span>
        </div>
      )}

      {/* Map */}
      <div style={{width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0}}>
         {!currentPosition ? (
            <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', background: 'var(--bg-app)'}}>
               <div className="spinner" style={{width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-main)', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
               <div className="text-body" style={{color: 'var(--text-muted)'}}>Acquiring GPS Signal...</div>
               <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
         ) : (
            <MapContainer center={currentPosition} zoom={16} style={{ width: '100%', height: '100%' }} zoomControl={false}>
              <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
              {loadedRoute && <ColoredRoute positions={loadedRoute} />}
              <ColoredRoute positions={route} />
              <CircleMarker center={[currentPosition[0], currentPosition[1]]} radius={8} pathOptions={{ color: 'white', weight: 3, fillColor: '#6366F1', fillOpacity: 1 }} />
              <MapUpdater position={currentPosition} />
            </MapContainer>
         )}
      </div>

      {/* Fading Gradient Bottom Sheet */}
      <div style={{ position: 'absolute', bottom: '0px', left: 0, width: '100%', background: 'linear-gradient(180deg, rgba(7,11,20,0) 0%, rgba(7,11,20,0.6) 30%, rgba(7,11,20,0.95) 100%)', padding: '60px 16px 32px 16px', zIndex: 10, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gridTemplateRows: 'auto auto', gap: 'var(--space-md)', alignItems: 'center', justifyItems: 'center', boxSizing: 'border-box' }}>
         
         {/* Row 1, Col 1: Calories */}
         <div style={{textAlign: 'center', gridRow: '1', gridColumn: '1'}}>
            <div className="text-label" style={{marginBottom: '2px'}}>Calories</div>
            <div className="text-large-number" style={{color: 'var(--activity-calories)'}}>{useHighAccuracyEngine ? engineCalories.toFixed(0) : (distance * 35).toFixed(0)} <span className="text-caption" style={{color: 'var(--text-muted)'}}>kcal</span></div>
         </div>

         {/* Row 1, Col 2: Play Button */}
         <div style={{gridRow: '1', gridColumn: '2'}}>
            <button 
               className="btn"
               onClick={handleStartStop}
               style={{
                  background: isRecording ? 'var(--semantic-error)' : 'var(--semantic-success)',
                  color: 'white', border: 'none', borderRadius: '50%',
                  width: '68px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'var(--shadow-floating)'
               }}
            >
               {isRecording ? <Square size={28} fill="currentColor"/> : <Play size={32} fill="currentColor" style={{marginLeft: '4px'}}/>}
            </button>
         </div>

         {/* Row 1, Col 3: Elevation */}
         <div style={{textAlign: 'center', gridRow: '1', gridColumn: '3'}}>
            <div className="text-label" style={{marginBottom: '2px'}}>Elevation</div>
            <div className="text-large-number" style={{color: 'var(--activity-elevation)'}}>{elevationGain.toFixed(0)} <span className="text-caption" style={{color: 'var(--text-muted)'}}>m</span></div>
         </div>

         {/* Row 2, Col 1: Time */}
         <div style={{textAlign: 'center', gridRow: '2', gridColumn: '1'}}>
            <div className="text-label" style={{marginBottom: '2px'}}>Time</div>
            <div className="text-large-number" style={{color: 'var(--text-primary)'}}>{formatTime(timer)}</div>
         </div>

         {/* Row 2, Col 2: Speedometer */}
         <div style={{gridRow: '2', gridColumn: '2', marginTop: '-12px'}}>
            <AnalogSpeedometer speed={liveSpeed} scale={0.7} />
         </div>

         {/* Row 2, Col 3: Distance */}
         <div style={{textAlign: 'center', gridRow: '2', gridColumn: '3'}}>
            <div className="text-label" style={{marginBottom: '2px'}}>Distance</div>
            <div className="text-large-number" style={{color: 'var(--activity-distance)'}}>{distance.toFixed(2)} <span className="text-caption" style={{color: 'var(--text-muted)'}}>km</span></div>
         </div>

      </div>
    </div>
  );
}
