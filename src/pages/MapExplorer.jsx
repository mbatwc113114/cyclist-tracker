import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, push, set } from 'firebase/database';
import { MapContainer, TileLayer, Polyline, Tooltip, useMap, useMapEvents, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon, Search, PenTool, Save, Download, Crosshair, Undo } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function MapController({ searchResult }) {
  const map = useMap();
  useEffect(() => {
    if (searchResult) {
      map.flyTo(searchResult, 14);
    }
  }, [searchResult, map]);
  return null;
}

function MapBoundsUpdater({ route }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.length > 0) {
      map.flyToBounds(route, { padding: [50, 50], maxZoom: 15, duration: 1.5 });
    }
  }, [route, map]);
  return null;
}

function RouteDrawer({ isDrawing, onAddPoint }) {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

export default function MapExplorer({ user }) {
  const [allRoutes, setAllRoutes] = useState([]);
  const savedPos = localStorage.getItem('lastKnownLocation');
  const initialPos = savedPos ? JSON.parse(savedPos) : [51.505, -0.09];
  const [currentPosition, setCurrentPosition] = useState(initialPos);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  
  // Route Builder State
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnRoute, setDrawnRoute] = useState([]);
  const [savingStatus, setSavingStatus] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
           const coords = [pos.coords.latitude, pos.coords.longitude];
           setCurrentPosition(coords);
           localStorage.setItem('lastKnownLocation', JSON.stringify(coords));
           setSearchResult(coords); // fly to user
        },
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

  const handleSearch = async () => {
     if (!searchQuery) return;
     try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data && data.length > 0) {
           setSearchResult([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        } else {
           alert("Location not found");
        }
     } catch (err) {
        console.error(err);
     }
  };

  const calculateDistance = (path) => {
     if (path.length < 2) return 0;
     let dist = 0;
     for (let i=1; i<path.length; i++) {
        const lat1 = path[i-1][0]; const lon1 = path[i-1][1];
        const lat2 = path[i][0]; const lon2 = path[i][1];
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        dist += R * c;
     }
     return (dist / 1000).toFixed(2);
  };

  const saveDrawnRoute = async () => {
     if (drawnRoute.length < 2) {
        alert("Draw at least 2 points");
        return;
     }
     setSavingStatus('Saving...');
     const rideRef = push(ref(database, `rides/${user.uid}`));
     const distance = calculateDistance(drawnRoute);
     await set(rideRef, {
        date: Date.now(),
        distance: distance,
        duration: 0,
        route: drawnRoute,
        userName: user.displayName || 'Anonymous Cyclist',
        userPhoto: user.photoURL || null,
        isCustomRoute: true
     });
     setSavingStatus('Saved!');
     setTimeout(() => {
        setSavingStatus('');
        setIsDrawing(false);
        setDrawnRoute([]);
     }, 2000);
  };

  const exportGPX = () => {
    if (drawnRoute.length < 2) {
      alert("Draw a route first to export.");
      return;
    }
    
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="K-Flow App">
  <trk>
    <name>Exported Route</name>
    <trkseg>\n`;

    drawnRoute.forEach(pt => {
      gpx += `      <trkpt lat="${pt[0]}" lon="${pt[1]}"></trkpt>\n`;
    });

    gpx += `    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kflow_route_${Date.now()}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedRoute = allRoutes.find(r => r.id === selectedRouteId);

  return (
    <div className="page-enter-active" style={{width: '100%', height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column'}}>
       {/* Top Bar */}
       <div style={{padding: '16px', background: 'var(--bg-panel)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', zIndex: 10, backdropFilter: 'var(--glass-blur)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
             <MapIcon color="var(--primary-color)" />
             <h2 style={{margin: 0, fontSize: '1.2rem'}}>Route Explorer</h2>
          </div>
          
          <div style={{display: 'flex', gap: '8px', flex: 1, minWidth: '200px', maxWidth: '400px'}}>
             <input 
                type="text" 
                placeholder="Search location..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                style={{flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)'}}
             />
             <button onClick={handleSearch} style={{background: 'var(--primary-color)', border: 'none', borderRadius: '8px', padding: '8px 12px', color: 'white', cursor: 'pointer'}}>
                <Search size={20} />
             </button>
             <button onClick={() => setSearchResult([...currentPosition])} style={{background: 'var(--accent-color)', border: 'none', borderRadius: '8px', padding: '8px 12px', color: 'white', cursor: 'pointer', title: 'Locate Me'}}>
                <Crosshair size={20} />
             </button>
          </div>
       </div>

       {/* Map */}
       <div style={{flex: 1, position: 'relative'}}>
          <MapContainer center={currentPosition} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
            {/* lyrs=s gets pure satellite view, no labels. lyrs=y gets hybrid. We will use 's' for pure satellite */}
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
            <MapController searchResult={searchResult} />
            <MapBoundsUpdater route={selectedRoute?.route} />
            <RouteDrawer isDrawing={isDrawing} onAddPoint={(pt) => setDrawnRoute(prev => [...prev, pt])} />
            <CircleMarker center={currentPosition} radius={8} pathOptions={{ color: 'white', weight: 3, fillColor: '#007AFF', fillOpacity: 1 }} />
            
            {selectedRoute && (
              <Polyline 
                 positions={selectedRoute.route} 
                 color={selectedRoute.uid === user.uid ? "var(--primary-color)" : "#FC4C02"} 
                 weight={6} 
                 opacity={0.9}
              />
            )}

            {drawnRoute.length > 0 && (
              <>
                <Polyline positions={drawnRoute} color="var(--danger-color)" weight={6} opacity={0.9} dashArray="10, 10" />
                {drawnRoute.map((pt, i) => (
                  <CircleMarker key={i} center={pt} radius={4} pathOptions={{ color: 'white', weight: 2, fillColor: 'var(--danger-color)', fillOpacity: 1 }} />
                ))}
              </>
            )}
          </MapContainer>
          
          {/* Route Builder Tools */}
          <div style={{position: 'absolute', top: '24px', right: '24px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px'}}>
             <button onClick={() => setIsDrawing(!isDrawing)} className="glass-panel" style={{padding: '12px', border: 'none', background: isDrawing ? 'var(--primary-color)' : 'var(--bg-panel)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}>
                <PenTool size={20} />
                {isDrawing ? "Stop Drawing" : "Build Route"}
             </button>

             {isDrawing && drawnRoute.length > 0 && (
               <>
                 <button onClick={() => setDrawnRoute(prev => prev.slice(0, -1))} className="glass-panel" style={{padding: '12px', border: 'none', background: 'var(--bg-panel)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <Undo size={20} /> Undo Point
                 </button>
                 {drawnRoute.length > 1 && (
                   <>
                     <button onClick={saveDrawnRoute} className="glass-panel" style={{padding: '12px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <Save size={20} /> {savingStatus || "Save Route"}
                     </button>
                     <button onClick={exportGPX} className="glass-panel" style={{padding: '12px', border: 'none', background: 'var(--bg-panel)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <Download size={20} /> Export GPX
                     </button>
                   </>
                 )}
                 <button onClick={() => setDrawnRoute([])} className="glass-panel" style={{padding: '12px', border: 'none', background: 'var(--danger-color)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}>
                    Clear
                 </button>
               </>
             )}
           </div>
           {/* Route Cards Carousel */}
           {!isDrawing && allRoutes.length > 0 && (
              <div style={{position: 'absolute', bottom: '24px', left: '0', width: '100%', display: 'flex', overflowX: 'auto', gap: '16px', padding: '0 24px', zIndex: 1000, scrollSnapType: 'x mandatory'}}>
                 {allRoutes.map(ride => {
                    const isSelected = selectedRouteId === ride.id;
                    return (
                       <div 
                          key={ride.id}
                          onClick={() => setSelectedRouteId(ride.id)}
                          style={{
                             flex: '0 0 85%', maxWidth: '320px', scrollSnapAlign: 'center',
                             background: isSelected ? 'var(--bg-panel)' : 'rgba(30, 41, 59, 0.85)',
                             padding: '16px', borderRadius: '16px',
                             border: isSelected ? '2px solid var(--primary-color)' : '2px solid transparent',
                             backdropFilter: 'var(--glass-blur)',
                             boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                             cursor: 'pointer', transition: 'all 0.2s',
                             display: 'flex', flexDirection: 'column', gap: '8px'
                          }}
                       >
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                             <div>
                                <div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>{ride.title || "Community Route"}</div>
                                <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>By {ride.userName}</div>
                             </div>
                             <div style={{fontWeight: 'bold', color: ride.uid === user.uid ? 'var(--primary-color)' : '#FC4C02'}}>{ride.distance} km</div>
                          </div>
                          
                          {isSelected && (
                             <button 
                                onClick={(e) => { e.stopPropagation(); navigate(`/ride/${ride.uid}/${ride.id}`); }}
                                className="btn-primary" 
                                style={{marginTop: '8px', padding: '8px 16px', width: '100%'}}
                             >
                                View Ride Details
                             </button>
                          )}
                       </div>
                    );
                 })}
              </div>
           )}
        </div>
    </div>
  );
}
