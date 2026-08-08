import React from 'react';
import { Polyline } from 'react-leaflet';

const speedColors = [
  { speed: 0, color: '#3B4252' },
  { speed: 10, color: '#2563EB' },
  { speed: 20, color: '#06B6D4' },
  { speed: 30, color: '#22C55E' },
  { speed: 40, color: '#FACC15' },
  { speed: 50, color: '#F97316' },
  { speed: 60, color: '#EF4444' }
];

// Linear interpolation between hex colors
function interpolateColor(color1, color2, factor) {
    if (arguments.length < 3) { factor = 0.5; }
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color1);
    var rgb1 = result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;

    result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color2);
    var rgb2 = result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
    
    if (!rgb1 || !rgb2) return color1;

    var r = Math.round(rgb1.r + factor * (rgb2.r - rgb1.r));
    var g = Math.round(rgb1.g + factor * (rgb2.g - rgb1.g));
    var b = Math.round(rgb1.b + factor * (rgb2.b - rgb1.b));

    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

const getSpeedColor = (speedKmh) => {
    if (speedKmh <= 0) return speedColors[0].color;
    if (speedKmh >= 60) return speedColors[6].color;

    for (let i = 0; i < speedColors.length - 1; i++) {
        if (speedKmh >= speedColors[i].speed && speedKmh <= speedColors[i+1].speed) {
            const range = speedColors[i+1].speed - speedColors[i].speed;
            const factor = (speedKmh - speedColors[i].speed) / range;
            return interpolateColor(speedColors[i].color, speedColors[i+1].color, factor);
        }
    }
    return speedColors[6].color;
};

export default function ColoredRoute({ positions }) {
  if (!positions || positions.length < 2) return null;

  const lines = [];
  
  // To avoid drawing 1000s of tiny segments causing lag, we merge segments of similar color
  // However, the spec asks for continuous color gradient. We group by color rounding.
  let currentLine = [positions[0]];
  let currentColor = getSpeedColor(positions[0][2] || 0);

  for (let i = 1; i < positions.length; i++) {
    const p = positions[i];
    const speed = p.speed_kmh !== undefined ? p.speed_kmh : (p[2] || 0);
    const exactColor = getSpeedColor(speed);
    
    currentLine.push(p);

    // If color changes significantly or at the end, draw the line segment
    // To make it look "gradient", we only break lines when color shifts
    if (exactColor !== currentColor || i === positions.length - 1) {
      
      // The outline (black translucent)
      lines.push(
        <Polyline 
            key={`outline-${i}`} 
            positions={currentLine.map(pt => [pt.lat !== undefined ? pt.lat : pt[0], pt.lng !== undefined ? pt.lng : pt[1]])} 
            color="rgba(0,0,0,0.18)" 
            weight={8} 
            lineCap="round"
            lineJoin="round"
        />
      );
      
      // The inner gradient color
      lines.push(
        <Polyline 
            key={`inner-${i}`} 
            positions={currentLine.map(pt => [pt.lat !== undefined ? pt.lat : pt[0], pt.lng !== undefined ? pt.lng : pt[1]])} 
            color={currentColor} 
            weight={5} 
            lineCap="round"
            lineJoin="round"
        />
      );
      currentLine = [p]; // start new line with current point to connect
      currentColor = exactColor;
    }
  }

  return <>{lines}</>;
}
