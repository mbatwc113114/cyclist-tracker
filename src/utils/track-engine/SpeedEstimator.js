/**
 * Calculates true riding speed by prioritizing valid GPS reported speed, 
 * falling back to fused velocity, and filtering anomalies.
 */
export class SpeedEstimator {
    constructor() {
        this.lastSpeedKmh = 0;
        this.smoothingFactor = 0.3; // Simple low-pass filter
    }

    /**
     * @param {Object} rawGpsPoint { speed (m/s), accuracy }
     * @param {number} fusedVelocityMagnitude (m/s)
     * @param {number} distanceDerivedSpeed (m/s)
     * @returns {number} Speed in km/h
     */
    estimateSpeed(rawGpsPoint, fusedVelocityMagnitude, distanceDerivedSpeed) {
        let speedMps = 0;

        // 1. Trust GPS reported speed if valid
        if (rawGpsPoint && rawGpsPoint.speed !== undefined && rawGpsPoint.speed !== null && rawGpsPoint.speed >= 0) {
            // Speed spike removal (if reported speed suddenly jumps impossibly)
            if (rawGpsPoint.speed < 30) { // Max ~108km/h
               speedMps = rawGpsPoint.speed;
            } else {
               speedMps = fusedVelocityMagnitude || distanceDerivedSpeed || 0;
            }
        } 
        // 2. Fallback to Fused Velocity (from EKF/IMU)
        else if (fusedVelocityMagnitude !== undefined && fusedVelocityMagnitude >= 0) {
            speedMps = fusedVelocityMagnitude;
        } 
        // 3. Fallback to Coordinate distance derivative
        else if (distanceDerivedSpeed !== undefined && distanceDerivedSpeed >= 0) {
            speedMps = distanceDerivedSpeed;
        }

        let speedKmh = speedMps * 3.6;

        // Apply low-pass filter for visual stability
        if (this.lastSpeedKmh === 0) {
            this.lastSpeedKmh = speedKmh;
        } else {
            this.lastSpeedKmh = (this.smoothingFactor * speedKmh) + ((1 - this.smoothingFactor) * this.lastSpeedKmh);
        }

        // Snap to 0 if very slow (stationary drift)
        if (this.lastSpeedKmh < 1.0) {
            this.lastSpeedKmh = 0;
        }

        return this.lastSpeedKmh;
    }
}
