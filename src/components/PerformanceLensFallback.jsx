import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { toPng } from 'html-to-image';
import { Share, Navigation2, Camera } from 'lucide-react';
import { tryLaunchSnapchatLens } from '../utils/snapkit';
import { Haptics } from '../utils/haptics';

const PerformanceLensFallback = forwardRef(({ ride }, ref) => {
  const containerRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useImperativeHandle(ref, () => ({
    shareRide: async () => {
      if (!ride) return;
      Haptics.light();
      
      const launchData = {
         distance_km: ride.distance,
         average_speed_kmh: ride.averageSpeed,
         duration_formatted: formatDuration(ride.duration),
         calories: ride.calories,
         elevation_gain_m: ride.elevationGain,
         max_speed_kmh: ride.maxSpeed
      };
      
      // Try to open deep link. If it fails, generate the fallback image.
      tryLaunchSnapchatLens(launchData, async () => {
         await generateAndShareFallback();
      });
    }
  }));

  const formatDuration = (seconds) => {
    if (!seconds) return '0h 0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const generateAndShareFallback = async () => {
     if (!containerRef.current) return;
     setIsGenerating(true);
     
     try {
       // Briefly make it visible in the DOM (but hidden offscreen) to render properly
       containerRef.current.style.display = 'block';
       
       const dataUrl = await toPng(containerRef.current, { 
          quality: 0.95,
          width: 1080,
          height: 1920,
          pixelRatio: 1
       });
       
       containerRef.current.style.display = 'none';
       
       const blob = await (await fetch(dataUrl)).blob();
       const file = new File([blob], 'performance_ride.png', { type: 'image/png' });
       
       if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
             title: 'My Ride on Velora',
             text: 'Check out my latest ride performance! #Velora',
             files: [file]
          });
       } else {
          // Fallback if browser doesn't support file sharing
          const link = document.createElement('a');
          link.download = 'performance_ride.png';
          link.href = dataUrl;
          link.click();
       }
     } catch (err) {
       console.error("Error generating share image", err);
       alert("Could not generate share image.");
     } finally {
       setIsGenerating(false);
     }
  };

  // Convert GPS track to simple SVG polyline
  const renderSvgRoute = () => {
     if (!ride || !ride.route || ride.route.length < 2) return null;
     
     let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
     ride.route.forEach(([lat, lng]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
     });
     
     const latRange = maxLat - minLat || 0.0001;
     const lngRange = maxLng - minLng || 0.0001;
     
     const width = 800;
     const height = 800;
     const padding = 100;
     
     const points = ride.route.map(([lat, lng]) => {
        // Reverse Y because lat increases going north, but SVG Y increases going south
        const x = padding + ((lng - minLng) / lngRange) * (width - padding * 2);
        const y = height - padding - ((lat - minLat) / latRange) * (height - padding * 2);
        return `${x},${y}`;
     }).join(' ');
     
     return (
        <svg viewBox={`0 0 ${width} ${height}`} style={{width: '100%', height: '100%', opacity: 0.9}}>
           <defs>
              <linearGradient id="routeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                 <stop offset="0%" stopColor="#2563EB" />
                 <stop offset="33%" stopColor="#06B6D4" />
                 <stop offset="66%" stopColor="#22C55E" />
                 <stop offset="100%" stopColor="#F97316" />
              </linearGradient>
              <filter id="glow">
                 <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                 <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                 </feMerge>
              </filter>
           </defs>
           <polyline 
              points={points} 
              fill="none" 
              stroke="url(#routeGradient)" 
              strokeWidth="12" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              filter="url(#glow)"
           />
        </svg>
     );
  };

  if (!ride) return null;

  return (
    <>
       {isGenerating && (
          <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'}}>
             <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'}}>
                <div className="spinner" style={{width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-main)', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
                <div style={{fontFamily: 'var(--main-font)', fontWeight: 600}}>Generating Share Card...</div>
             </div>
          </div>
       )}

       {/* Offscreen container for HTML-to-Image */}
       <div 
         ref={containerRef} 
         style={{
            position: 'absolute', 
            top: '-9999px', 
            left: '-9999px', 
            width: '1080px', 
            height: '1920px', 
            display: 'none',
            background: 'linear-gradient(to bottom, #1E293B, #0F172A)',
            fontFamily: "'Inter', sans-serif",
            overflow: 'hidden'
         }}
       >
          {/* Subtle Map/Route Background */}
          <div style={{position: 'absolute', top: '10%', left: 0, width: '100%', height: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
             {renderSvgRoute()}
          </div>
          
          <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '60px', boxSizing: 'border-box'}}>
             
             <div style={{flex: 1}}></div> {/* Spacer to push card to bottom */}
             
             {/* PERFORMANCE CARD */}
             <div style={{
                background: 'linear-gradient(135deg, rgba(7,11,20,0.88), rgba(15,18,42,0.82) 50%, rgba(20,15,45,0.78))',
                border: '2px solid rgba(139,92,246,0.35)',
                borderRadius: '52px',
                padding: '60px',
                boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(20px)',
                width: '100%',
                boxSizing: 'border-box',
                position: 'relative'
             }}>
                {/* Brand Header */}
                <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px'}}>
                   <div style={{background: 'var(--primary-main)', padding: '12px', borderRadius: '50%'}}>
                      <Camera size={36} color="white" />
                   </div>
                   <div style={{fontSize: '24px', fontWeight: 800, letterSpacing: '2px', color: '#CBD5E1', textTransform: 'uppercase'}}>VELORA</div>
                </div>

                {/* Distance Hero */}
                <div style={{marginBottom: '60px'}}>
                   <div style={{fontSize: '24px', fontWeight: 600, letterSpacing: '2.6px', color: '#94A3B8', marginBottom: '8px'}}>DISTANCE</div>
                   <div style={{fontSize: '140px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1}}>
                      {Number(ride.distance || 0).toFixed(1)} <span style={{fontSize: '60px', color: '#94A3B8', fontWeight: 700}}>km</span>
                   </div>
                   <div style={{
                      marginTop: '20px',
                      height: '8px',
                      width: '100%',
                      background: 'linear-gradient(90deg, #7C3AED, #6366F1, #22D3EE)',
                      borderRadius: '4px'
                   }}></div>
                </div>

                {/* Secondary Stats (3 Column Grid) */}
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '40px'}}>
                   <div>
                      <div style={{fontSize: '22px', fontWeight: 600, letterSpacing: '1.6px', color: '#64748B', marginBottom: '12px'}}>AVG SPEED</div>
                      <div style={{fontSize: '48px', fontWeight: 800, color: '#22D3EE'}}>
                         {Number(ride.averageSpeed || 0).toFixed(1)} <span style={{fontSize: '28px', opacity: 0.8}}>km/h</span>
                      </div>
                   </div>
                   
                   <div>
                      <div style={{fontSize: '22px', fontWeight: 600, letterSpacing: '1.6px', color: '#64748B', marginBottom: '12px'}}>TIME</div>
                      <div style={{fontSize: '48px', fontWeight: 800, color: '#A78BFA'}}>
                         {formatDuration(ride.duration)}
                      </div>
                   </div>
                   
                   {ride.calories !== undefined && (
                      <div>
                         <div style={{fontSize: '22px', fontWeight: 600, letterSpacing: '1.6px', color: '#64748B', marginBottom: '12px'}}>CALORIES</div>
                         <div style={{fontSize: '48px', fontWeight: 800, color: '#F97316'}}>
                            {ride.calories} <span style={{fontSize: '28px', opacity: 0.8}}>kcal</span>
                         </div>
                      </div>
                   )}
                </div>

                {/* Optional Elevation */}
                {ride.elevationGain !== undefined && ride.elevationGain > 0 && (
                   <div style={{marginTop: '40px', paddingTop: '40px', borderTop: '2px solid rgba(255,255,255,0.1)'}}>
                      <div style={{fontSize: '22px', fontWeight: 600, letterSpacing: '1.6px', color: '#64748B', marginBottom: '12px'}}>ELEVATION</div>
                      <div style={{fontSize: '48px', fontWeight: 800, color: '#22C55E'}}>
                         {Math.round(ride.elevationGain)} <span style={{fontSize: '28px', opacity: 0.8}}>m</span>
                      </div>
                   </div>
                )}
             </div>
          </div>
       </div>
    </>
  );
});

export default PerformanceLensFallback;
