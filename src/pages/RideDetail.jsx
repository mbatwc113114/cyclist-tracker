import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';
import { MapContainer, TileLayer, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, MapPin, Clock } from 'lucide-react';

export default function RideDetail() {
  const { uid, rideId } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="page-enter-active" style={{padding: '24px', color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading ride details...</div>;
  if (!ride) return <div className="page-enter-active" style={{padding: '24px', color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Ride not found.</div>;

  const center = ride.route && ride.route.length > 0 ? ride.route[Math.floor(ride.route.length / 2)] : [51.505, -0.09];

  return (
    <div className="page-enter-active" style={{display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', position: 'relative'}}>
      
      {/* Header */}
      <div style={{position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000, background: 'linear-gradient(to bottom, rgba(15,23,42,0.9), rgba(15,23,42,0))', padding: '24px', display: 'flex', alignItems: 'center'}}>
         <button onClick={() => navigate(-1)} style={{background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', padding: '12px', color: 'white', display: 'flex', cursor: 'pointer', backdropFilter: 'blur(10px)'}}>
            <ArrowLeft size={24} />
         </button>
         <h2 style={{margin: '0 0 0 16px', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>{ride.userName || 'Cyclist'}'s Ride</h2>
      </div>

      {/* Map */}
      <div style={{flex: 1, position: 'relative'}}>
         <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
            {ride.route && <Polyline positions={ride.route} color="var(--primary-color)" weight={5} opacity={0.8} />}
            {ride.route && ride.route.length > 0 && <CircleMarker center={ride.route[0]} radius={6} pathOptions={{ color: 'white', weight: 2, fillColor: '#34C759', fillOpacity: 1 }} />}
            {ride.route && ride.route.length > 1 && <CircleMarker center={ride.route[ride.route.length - 1]} radius={6} pathOptions={{ color: 'white', weight: 2, fillColor: '#FF3B30', fillOpacity: 1 }} />}
         </MapContainer>
      </div>

      {/* Stats Panel */}
      <div className="glass-panel" style={{margin: '16px', borderRadius: '16px', padding: '24px', position: 'absolute', bottom: '80px', width: 'calc(100% - 32px)', zIndex: 1000, backdropFilter: 'blur(20px)', background: 'rgba(15, 23, 42, 0.85)'}}>
         <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
            {ride.userPhoto ? (
              <img src={ride.userPhoto} alt="Profile" style={{width: '48px', height: '48px', borderRadius: '50%'}} referrerPolicy="no-referrer" />
            ) : (
              <div style={{width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>
                {ride.userName ? ride.userName[0].toUpperCase() : 'U'}
              </div>
            )}
            <div>
               <div style={{fontWeight: 'bold', fontSize: '1.2rem'}}>{ride.userName}</div>
               <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>{new Date(ride.date).toLocaleString()}</div>
            </div>
         </div>

         <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
               <MapPin size={24} color="var(--accent-color)" />
               <div>
                  <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Distance</div>
                  <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{ride.distance} km</div>
               </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
               <Clock size={24} color="var(--primary-color)" />
               <div>
                  <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Time</div>
                  <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{formatTime(ride.duration)}</div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
