import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { MapContainer, TileLayer, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MapExplorer({ user }) {
  const [allRoutes, setAllRoutes] = useState([]);
  const [currentPosition, setCurrentPosition] = useState([51.505, -0.09]);
  const navigate = useNavigate();

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentPosition([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.log(err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  useEffect(() => {
    const ridesRef = ref(database, 'rides');
    const unsubscribe = onValue(ridesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let routes = [];
        Object.keys(data).forEach(uid => {
          Object.keys(data[uid]).forEach(rideId => {
            const ride = data[uid][rideId];
            if (ride.route && ride.route.length > 0) {
              routes.push({
                 id: rideId,
                 uid: uid,
                 route: ride.route,
                 userName: ride.userName || 'Anonymous Cyclist',
                 distance: ride.distance
              });
            }
          });
        });
        setAllRoutes(routes);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'column'}}>
       <div style={{padding: '16px', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 10, backdropFilter: 'var(--glass-blur)'}}>
          <MapIcon color="var(--primary-color)" />
          <h2 style={{margin: 0, fontSize: '1.2rem'}}>Route Explorer</h2>
       </div>

       <div style={{flex: 1, position: 'relative'}}>
          <MapContainer center={currentPosition} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
            <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
            
            {allRoutes.map(ride => (
              <Polyline 
                 key={ride.id} 
                 positions={ride.route} 
                 color={ride.uid === user.uid ? "var(--primary-color)" : "#888888"} 
                 weight={5} 
                 opacity={0.8}
                 eventHandlers={{
                   click: () => navigate(`/ride/${ride.uid}/${ride.id}`)
                 }}
              >
                 <Tooltip sticky>{ride.userName} ({ride.distance}km)</Tooltip>
              </Polyline>
            ))}
          </MapContainer>
          
          <div style={{position: 'absolute', bottom: '24px', left: '24px', zIndex: 1000, background: 'var(--bg-panel)', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '8px'}}>
             <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px'}}><div style={{width: '12px', height: '12px', background: 'var(--primary-color)', borderRadius: '50%'}}></div> Your Routes</div>
             <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px'}}><div style={{width: '12px', height: '12px', background: '#888888', borderRadius: '50%'}}></div> Community Routes</div>
          </div>
       </div>
    </div>
  );
}
