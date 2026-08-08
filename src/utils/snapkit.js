/**
 * Snap Kit Creative Kit Integration Utilities for Web/PWA
 * Handles generating deep links for Dynamic Lenses with launch data.
 */

// NOTE: Replace this with the production Lens UUID after creating it in Lens Studio
export const LENS_UUID = import.meta.env.VITE_SNAP_LENS_UUID || ""; 

export const generateSnapchatDeepLink = (lensUUID, launchData) => {
  if (!lensUUID) {
    console.warn("Snapchat Lens UUID is missing");
    return null;
  }
  
  const formattedData = {};
  
  // Format launch data values according to DATA_PAYLOAD spec
  if (launchData.distance_km !== undefined) formattedData.distance_km = launchData.distance_km.toString();
  if (launchData.average_speed_kmh !== undefined) formattedData.average_speed_kmh = launchData.average_speed_kmh.toString();
  if (launchData.duration_formatted) formattedData.duration_formatted = launchData.duration_formatted;
  if (launchData.calories !== undefined) formattedData.calories = launchData.calories.toString();
  
  // Optional values
  if (launchData.elevation_gain_m !== undefined) formattedData.elevation_gain_m = launchData.elevation_gain_m.toString();
  if (launchData.max_speed_kmh !== undefined) formattedData.max_speed_kmh = launchData.max_speed_kmh.toString();
  
  // URL Encode the launch data JSON
  const launchDataString = encodeURIComponent(JSON.stringify(formattedData));
  
  // Official deep link format for launching a Lens with data
  return `snapchat://lens/${lensUUID}?launchData=${launchDataString}`;
};

export const tryLaunchSnapchatLens = (launchData, onFallback) => {
   const deepLink = generateSnapchatDeepLink(LENS_UUID, launchData);
   
   // If no Lens UUID is configured, immediately use the fallback
   if (!deepLink) {
     if (onFallback) onFallback();
     return;
   }
   
   // We use a timeout to detect if the deep link failed (meaning Snapchat isn't installed)
   const start = Date.now();
   let fallbackTriggered = false;
   
   const timeout = setTimeout(() => {
     // If the browser is still focused after 1000ms, the deep link likely failed or was ignored
     if (!document.hidden && Date.now() - start < 1500) {
       if (!fallbackTriggered && onFallback) {
         fallbackTriggered = true;
         onFallback();
       }
     }
   }, 1000);
   
   // If the app successfully switches to Snapchat, the page becomes hidden. Clear the timeout.
   const onVisibilityChange = () => {
      if (document.hidden) {
         clearTimeout(timeout);
      }
   };
   document.addEventListener('visibilitychange', onVisibilityChange);
   
   // Clean up listener after 2 seconds
   setTimeout(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
   }, 2000);
   
   // Attempt to open deep link
   window.location.href = deepLink;
};
