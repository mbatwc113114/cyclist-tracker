import React from 'react';

export default function AnalogSpeedometer({ speed, maxSpeed = 60 }) {
  const clampedSpeed = Math.min(Math.max(speed, 0), maxSpeed);
  
  // Angle from -90 (left) to 90 (right)
  const angle = -90 + (clampedSpeed / maxSpeed) * 180;
  
  return (
    <div style={{ position: 'relative', width: '160px', height: '110px', margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
      <svg width="160" height="90" viewBox="0 0 160 90">
        <defs>
          <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#007AFF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="1" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Background Arc */}
        <path d="M 15 80 A 65 65 0 0 1 145 80" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
        
        {/* Active Arc to show progress behind needle */}
        <path d="M 15 80 A 65 65 0 0 1 145 80" fill="none" stroke="url(#speedGrad)" strokeWidth="8" strokeLinecap="round" strokeDasharray="204" strokeDashoffset={204 - (204 * (clampedSpeed / maxSpeed))} style={{transition: 'stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1)'}} />
        
        {/* Ticks */}
        {[0, 20, 40, 60].map(tick => {
           const tickAngle = -90 + (tick / maxSpeed) * 180;
           const rad = (tickAngle - 90) * (Math.PI / 180);
           const x1 = 80 + 55 * Math.cos(rad);
           const y1 = 80 + 55 * Math.sin(rad);
           const x2 = 80 + 60 * Math.cos(rad);
           const y2 = 80 + 60 * Math.sin(rad);
           return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.2)" strokeWidth="2" />;
        })}

        {/* Labels */}
        <text x="15" y="92" fill="var(--text-muted)" fontSize="10" textAnchor="middle" fontWeight="bold">0</text>
        <text x="145" y="92" fill="var(--text-muted)" fontSize="10" textAnchor="middle" fontWeight="bold">60</text>
        
        {/* Needle */}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '80px 80px', transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <polygon points="78,80 82,80 80,25" fill="#fff" filter="url(#glow)" opacity="0.9" />
          <circle cx="80" cy="80" r="5" fill="#222" stroke="#fff" strokeWidth="2" />
        </g>
      </svg>
      
      {/* Digital Speed below needle */}
      <div style={{ position: 'absolute', bottom: '0px', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', fontWeight: '900', lineHeight: '1', color: 'white', textShadow: '0 0 10px rgba(0,229,255,0.3)' }}>
          {speed.toFixed(1)}
        </div>
        <div style={{ fontSize: '10px', color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', marginTop: '2px', opacity: 0.8 }}>
          km/h
        </div>
      </div>
    </div>
  );
}
