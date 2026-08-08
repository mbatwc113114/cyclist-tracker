import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';
import { MapContainer, TileLayer, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, MapPin, Clock, Activity, TrendingUp, Zap, Share2 } from 'lucide-react';
import { Haptics } from '../utils/haptics';
import ColoredRoute from '../components/ColoredRoute';
import PerformanceLensFallback from '../components/PerformanceLensFallback';



export default function RideDetail() {
  const { uid, rideId } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const shareRef = React.useRef(null);

  useEffect(() => {
    const fetchRide = async () => {
      const rideRef = ref(database, `rides/${uid}/${rideId}`);
      const snapshot = await get(rideRef);
      if (snapshot.exists()) {
        setRide(snapshot.val());
      }
      setLoading(false);
    };
    fetchRide();
  }, [uid, rideId]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  if (loading) return (
     <div className="page-enter-active" style={{padding: 'var(--space-xxl)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw'}}>
        <div className="spinner" style={{width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-main)', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
     </div>
  );
  if (!ride) return <div className="page-enter-active" style={{padding: 'var(--space-xxl)', color: 'var(--text-primary)', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Ride not found.</div>;

  const center = ride.route && ride.route.length > 0 ? ride.route[Math.floor(ride.route.length / 2)] : [51.505, -0.09];

  return (
    <div className="page-enter-active" style={{display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', position: 'relative'}}>
      
      {/* Header */}
      <div style={{position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000, background: 'linear-gradient(to bottom, rgba(7,11,20,0.9), rgba(7,11,20,0))', padding: 'var(--space-xl)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
         <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-md)', overflow: 'hidden'}}>
            <button onClick={() => { Haptics.light(); navigate(-1); }} className="btn" style={{background: 'var(--surface-card-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '50%', padding: '10px', color: 'var(--text-primary)', display: 'flex', cursor: 'pointer', boxShadow: 'var(--shadow-card)', flexShrink: 0}}>
               <ArrowLeft size={22} />
            </button>
            <h2 className="text-h2" style={{margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {ride.title || `${ride.userName || 'Cyclist'}'s Ride`}
            </h2>
         </div>
         <button onClick={() => shareRef.current?.shareRide()} className="btn btn-primary" style={{borderRadius: 'var(--radius-pill)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', flexShrink: 0, background: '#FFFC00', color: 'black', border: 'none', fontWeight: 'bold'}}>
            <Share2 size={16} /> Share
         </button>
      </div>

      <PerformanceLensFallback ref={shareRef} ride={ride} />

      {/* Map */}
      <div style={{flex: 1, position: 'relative'}}>
         <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
            {ride.route && <ColoredRoute positions={ride.route} />}
            {ride.route && ride.route.length > 0 && <CircleMarker center={[ride.route[0][0], ride.route[0][1]]} radius={6} pathOptions={{ color: 'white', weight: 2, fillColor: 'var(--semantic-success)', fillOpacity: 1 }} />}
            {ride.route && ride.route.length > 1 && <CircleMarker center={[ride.route[ride.route.length - 1][0], ride.route[ride.route.length - 1][1]]} radius={6} pathOptions={{ color: 'white', weight: 2, fillColor: 'var(--semantic-error)', fillOpacity: 1 }} />}
         </MapContainer>
      </div>

      {/* Stats Panel */}
      <div className="card" style={{margin: 'var(--space-md)', padding: 'var(--space-lg)', position: 'absolute', bottom: '80px', width: 'calc(100% - 32px)', zIndex: 1000, boxShadow: 'var(--shadow-floating)'}}>
         <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xxl)'}}>
            {ride.userPhoto ? (
              <img src={ride.userPhoto} alt="Profile" style={{width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--primary-main)'}} referrerPolicy="no-referrer" />
            ) : (
              <div style={{width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>
                {ride.userName ? ride.userName[0].toUpperCase() : 'U'}
              </div>
            )}
            <div>
               <div className="text-body" style={{fontWeight: 700}}>{ride.userName}</div>
               <div className="text-caption" style={{color: 'var(--text-muted)'}}>{new Date(ride.date).toLocaleString()}</div>
            </div>
         </div>

         <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)'}}>
               <MapPin size={24} color="var(--activity-distance)" />
               <div>
                  <div className="text-label">Distance</div>
                  <div className="text-h3">{ride.distance} km</div>
               </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)'}}>
               <Clock size={24} color="var(--text-primary)" />
               <div>
                  <div className="text-label">Time</div>
                  <div className="text-h3">{formatTime(ride.duration)}</div>
               </div>
            </div>
            {ride.averageSpeed !== undefined && (
               <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)'}}>
                  <Activity size={24} color="var(--activity-speed)" />
                  <div>
                     <div className="text-label">Avg Speed</div>
                     <div className="text-h3">{ride.averageSpeed} km/h</div>
                  </div>
               </div>
            )}
            {ride.elevationGain !== undefined && (
               <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)'}}>
                  <TrendingUp size={24} color="var(--activity-elevation)" />
                  <div>
                     <div className="text-label">Elevation</div>
                     <div className="text-h3">{ride.elevationGain} m</div>
                  </div>
               </div>
            )}
            <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)'}}>
               <Zap size={24} color="var(--activity-calories)" />
               <div>
                  <div className="text-label">Calories</div>
                  <div className="text-h3">{ride.calories !== undefined ? ride.calories : '--'} kcal</div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
