/**
 * Assesses incoming GPS accuracy, age, and speed consistency.
 * Performs outlier rejection (innovation testing, impossible speed/acceleration jumps).
 */
export class GPSQualityEstimator {
    constructor(options = {}) {
        this.maxNormalSpeedKmh = options.maxNormalSpeedKmh || 90;
        this.minAcceptableAccuracy = options.minAcceptableAccuracy || 30; // tighter bound for stationary tracking
    }

    /**
     * @param {Object} currentPoint { lat, lng, speed, accuracy, timestamp }
     * @param {Object} lastValidPoint { lat, lng, speed, accuracy, timestamp }
     * @returns {boolean} True if the point is valid, False if it's an outlier.
     */
    isValid(currentPoint, lastValidPoint) {
        if (currentPoint.accuracy > this.minAcceptableAccuracy) {
            return false;
        }

        if (!lastValidPoint) return true;

        const dt = (currentPoint.timestamp - lastValidPoint.timestamp) / 1000.0; // seconds
        if (dt <= 0) return false;

        const distanceMeters = this.haversine(
            lastValidPoint.lat, lastValidPoint.lng,
            currentPoint.lat, currentPoint.lng
        );

        const derivedSpeedMps = distanceMeters / dt;
        const derivedSpeedKmh = derivedSpeedMps * 3.6;

        // Impossible speed check
        if (derivedSpeedKmh > this.maxNormalSpeedKmh) {
            return false;
        }

        // Multipath Spike / Teleportation check
        // If distance jumped significantly but reported GPS speed doesn't match the derived speed
        // Or if acceleration is physically impossible (> 1G = 9.8m/s^2)
        const reportedSpeedMps = currentPoint.speed || 0;
        const lastSpeedMps = lastValidPoint.speed || 0;
        const acceleration = Math.abs(reportedSpeedMps - lastSpeedMps) / dt;

        if (acceleration > 9.8) {
            return false; // Impossible bicycle acceleration
        }

        // Stationary drift check: 
        // If derived speed is high but reported speed is 0 and accuracy is bad, it's likely drift
        if (derivedSpeedKmh > 10 && reportedSpeedMps < 0.5 && currentPoint.accuracy > 15) {
            return false; 
        }

        return true;
    }

    haversine(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
}
