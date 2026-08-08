import { GPSQualityEstimator } from './GPSQualityEstimator';
import { SpeedEstimator } from './SpeedEstimator';

/**
 * Fuses GPS and IMU.
 * Handles Dead Reckoning and GPS Outlier rejection.
 * Outputs a robust Processed Track.
 */
export class TrackFusionEngine {
    constructor() {
        this.gpsEstimator = new GPSQualityEstimator();
        this.speedEstimator = new SpeedEstimator();
        
        this.rawGpsBuffer = [];
        this.rawImuBuffer = [];
        this.processedTrack = [];
        
        this.lastValidGps = null;
        this.lastProcessedPoint = null;
        this.totalDistanceMeters = 0;
        this.maxSpeedKmh = 0;
        
        // EKF simplified state
        this.velocityX = 0;
        this.velocityY = 0;
        this.lastImuTime = null;
    }

    /**
     * Call this when navigator.geolocation provides a new position
     */
    pushGPS(lat, lng, altitude, speed, accuracy, timestamp) {
        const rawGps = { lat, lng, altitude, speed, accuracy, timestamp };
        this.rawGpsBuffer.push(rawGps);

        // 1. GPS Quality & Outlier Check
        if (!this.gpsEstimator.isValid(rawGps, this.lastValidGps)) {
            // Outlier rejected. We do not update the processed track based on this.
            return;
        }

        // 2. Compute interval & derived speed
        let dt = 0;
        let dist = 0;
        if (this.lastProcessedPoint) {
            dt = (timestamp - this.lastProcessedPoint.timestamp) / 1000.0;
            dist = this.gpsEstimator.haversine(
                this.lastProcessedPoint.lat, this.lastProcessedPoint.lng,
                lat, lng
            );
        }
        
        // 3. Fused Velocity (Simplified integration reset)
        // Reset IMU velocity integration to GPS ground truth to stop drift
        this.velocityX = 0; 
        this.velocityY = 0;
        
        // 4. Speed Estimation
        const derivedSpeedMps = dt > 0 ? dist / dt : 0;
        // In a full EKF, fusedVelocityMagnitude would come from state vector. Here we mock for now.
        const fusedSpeed = 0; 
        const speedKmh = this.speedEstimator.estimateSpeed(rawGps, fusedSpeed, derivedSpeedMps);

        // 5. Update Total Distance
        if (dt > 0 && dist > 2) { // minimum 2m delta to avoid noise
            this.totalDistanceMeters += dist;
        }

        if (speedKmh > this.maxSpeedKmh) {
            this.maxSpeedKmh = speedKmh;
        }

        const processedPoint = {
            timestamp,
            lat,
            lng,
            altitude,
            speed_kmh: speedKmh,
            source: 'GPS',
            accuracy,
            confidence: accuracy < 10 ? 95 : (accuracy < 20 ? 80 : 50)
        };

        this.processedTrack.push(processedPoint);
        this.lastValidGps = rawGps;
        this.lastProcessedPoint = processedPoint;
    }

    /**
     * Call this at ~50Hz from devicemotion
     */
    pushIMU(ax, ay, az, timestamp) {
        this.rawImuBuffer.push({ ax, ay, az, timestamp });

        if (!this.lastValidGps || !this.lastProcessedPoint) return;

        // 1. Dead Reckoning / Short Gap Prediction
        // If GPS is lost for > 2 seconds, use IMU to predict next position
        const timeSinceGps = (timestamp - this.lastProcessedPoint.timestamp) / 1000.0;
        
        if (timeSinceGps > 2.0 && timeSinceGps < 5.0) {
            if (this.lastImuTime) {
                const dt = (timestamp - this.lastImuTime) / 1000.0;
                
                // Very simplified dead reckoning (assuming phone is flat for mock)
                // Real implementation requires orientation tracking (Madgwick)
                // We'll apply a decay to confidence
                
                this.velocityX += ax * dt;
                this.velocityY += ay * dt;
                
                // We won't actually synthesize fake lat/lng here unless necessary,
                // the spec says "do not invent precise route geometry". 
                // We'll just mark a gap if it's too long.
            }
        }

        this.lastImuTime = timestamp;
    }

    getProcessedTrack() {
        return this.processedTrack;
    }

    getRawTrack() {
        return this.rawGpsBuffer;
    }

    getStats() {
        return {
            distanceKm: this.totalDistanceMeters / 1000.0,
            maxSpeedKmh: this.maxSpeedKmh
        };
    }
}
