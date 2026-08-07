import React, { useState, useEffect, useRef } from 'react';
import { database } from '../firebase';
import { ref, onValue, push, set } from 'firebase/database';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Play, Square, Flame, Activity, Map as MapIcon, Bike } from 'lucide-react';

// Haversine distance formula (returns km)
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

export default function Dashboard({ user }) {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [timer, setTimer] = useState(0);
  const [distance, setDistance] = useState(0); 
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [route, setRoute] = useState([]);
  const [currentPosition, setCurrentPosition] = useState([51.505, -0.09]);
  const [streak, setStreak] = useState(0);
  const [pastRides, setPastRides] = useState([]);
  
  const watchIdRef = useRef(null);
  const mapRef = useRef(null);

  // Background-safe Timer Logic
  useEffect(() => {
    let interval;
    if (isRecording && sessionStartTime) {
      interval = setInterval(() => {
        setTimer(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000); // 1s tick just to update the UI
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording, sessionStartTime]);

  // GPS Tracking Logic
  useEffect(() => {
    if (isRecording) {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, speed } = position.coords;
            const newPos = [latitude, longitude];
            
            // Update Speed (m/s to km/h)
            const speedKmh = speed ? (speed * 3.6) : 0;
            setLiveSpeed(speedKmh);
            
            setRoute(prevRoute => {
              if (prevRoute.length > 0) {
                const lastPos = prevRoute[prevRoute.length - 1];
                const dist = getDistanceFromLatLonInKm(lastPos[0], lastPos[1], latitude, longitude);
                setDistance(d => d + dist);
              }
              return [...prevRoute, newPos];
            });
            
            setCurrentPosition(newPos);

            // Pan map to current location
            if (mapRef.current) {
               mapRef.current.setView(newPos, mapRef.current.getZoom());
            }
          },
          (error) => {
            console.error("GPS Error:", error);
          },
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );
      }
    } else {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      setLiveSpeed(0);
    }

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isRecording]);

  // Fetch past rides and calculate streak
  useEffect(() => {
    const ridesRef = ref(database, `rides/${user.uid}`);
    const unsubscribe = onValue(ridesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const rideList = Object.keys(data).map(key => ({id: key, ...data[key]})).sort((a,b) => b.date - a.date);
        setPastRides(rideList);
        calculateStreak(rideList);
      } else {
        setPastRides([]);
      }
    });
    return () => unsubscribe();
  }, [user.uid]);

  const calculateStreak = (rideList) => {
    if (!rideList || rideList.length === 0) return;
    
    const uniqueDates = [...new Set(rideList.map(ride => {
      const d = new Date(ride.date);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }))];

    let currentStreak = 0;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

    if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
       let checkDate = new Date(uniqueDates[0]);
       for (const dateStr of uniqueDates) {
          const dStr = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
          if (dateStr === dStr) {
             currentStreak++;
             checkDate.setDate(checkDate.getDate() - 1);
          } else {
             break;
          }
       }
    }
    setStreak(currentStreak);
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      setSessionStartTime(null);
      if (distance > 0) {
        const ridesRef = ref(database, `rides/${user.uid}`);
        await set(push(ridesRef), {
          duration: timer,
          distance: distance.toFixed(2),
          date: Date.now(),
          route: route
        });
      }
      setTimer(0);
      setDistance(0);
      setRoute([]);
    } else {
      setIsRecording(true);
      setSessionStartTime(Date.now() - (timer * 1000));
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(pos => {
           setCurrentPosition([pos.coords.latitude, pos.coords.longitude]);
           setRoute([[pos.coords.latitude, pos.coords.longitude]]);
        }, err => console.error(err), { enableHighAccuracy: true });
      }
    }
  };

  return (
    <div className="page-enter-active" style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
      
      {/* User Profile Header */}
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border-color)', backdropFilter: 'var(--glass-blur)'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          {user.photoURL ? (
            <img src={user.photoURL} alt="Profile" style={{width: '56px', height: '56px', borderRadius: '50%', border: '2px solid var(--primary-color)'}} referrerPolicy="no-referrer" />
          ) : (
            <div style={{width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold'}}>
              {user.displayName ? user.displayName[0].toUpperCase() : 'C'}
            </div>
          )}
          <div>
            <h2 style={{margin: 0, fontSize: '1.2rem'}}>Hello, {user.displayName?.split(' ')[0] || 'Cyclist'}!</h2>
            <p style={{color: 'var(--text-muted)', margin: 0, fontSize: '14px'}}>Ready for your next ride?</p>
          </div>
        </div>
        
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <Flame size={24} color="var(--accent-color)" />
          <div>
            <div style={{fontSize: '1.2rem', fontWeight: 700, lineHeight: 1}}>{streak} <span style={{fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal'}}>Days</span></div>
          </div>
        </div>
      </div>

      <div className="mobile-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px'}}>
        {/* Main Recording UI */}
        <div className="glass-panel" style={{textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
           
           <div className="stats-grid" style={{display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '32px'}}>
              <div>
                 <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Time</div>
                 <div className="stats-value" style={{fontSize: '4rem', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1}}>{formatTime(timer)}</div>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div>
                   <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Dist (km)</div>
                   <div className="stats-value" style={{fontSize: '2.5rem', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1}}>{distance.toFixed(2)}</div>
                </div>
                <div>
                   <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Spd (km/h)</div>
                   <div className="stats-value" style={{fontSize: '2.5rem', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1, color: isRecording ? 'var(--accent-color)' : 'var(--text-main)'}}>{liveSpeed.toFixed(1)}</div>
                </div>
              </div>
           </div>

           <button 
              onClick={handleToggleRecording}
              style={{
                 background: isRecording ? 'var(--danger-color)' : 'var(--primary-color)',
                 color: 'white', border: 'none', borderRadius: '50px',
                 padding: '16px 40px', fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase',
                 cursor: 'pointer', transition: 'all 0.2s ease', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
              }}
           >
              {isRecording ? <><Square size={20}/> Stop</> : <><Play size={20}/> Start</>}
           </button>
        </div>

        {/* Map Panel */}
        <div className="glass-panel" style={{display: 'flex', flexDirection: 'column'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
            <MapIcon size={20} color="var(--primary-color)" />
            <h3 style={{margin: 0, fontSize: '1rem'}}>Live Route Tracking</h3>
          </div>
          <div className="map-container" style={{flex: 1, minHeight: '300px', marginTop: 0}}>
            <MapContainer center={currentPosition} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false} ref={mapRef}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Polyline positions={route} color="var(--primary-color)" weight={5} opacity={0.8} />
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="glass-panel">
         <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <Activity size={20} color="var(--accent-color)" />
            <h3 style={{margin: 0}}>Activity Feed</h3>
         </div>
         <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {pastRides.map(ride => (
               <div key={ride.id} style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                     <div style={{fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '4px'}}>
                        {new Date(ride.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} Ride
                     </div>
                     <div style={{color: 'var(--text-muted)', fontSize: '14px', display: 'flex', gap: '12px'}}>
                       <span><strong style={{color: 'var(--text-main)'}}>{formatTime(ride.duration)}</strong> Time</span>
                       <span><strong style={{color: 'var(--text-main)'}}>{ride.distance}</strong> km</span>
                     </div>
                  </div>
                  <div style={{background: 'var(--bg-dark)', padding: '12px', borderRadius: '50%'}}>
                     <Bike size={20} color="var(--primary-color)" />
                  </div>
               </div>
            ))}
            {pastRides.length === 0 && <div style={{color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0'}}>No past rides found. Start riding!</div>}
         </div>
      </div>

    </div>
  );
}
