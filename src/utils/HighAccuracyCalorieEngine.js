/**
 * High Accuracy Cycling Calorie Engine
 * Physics-based energy model using GPS + IMU sensor fusion.
 */

export class HighAccuracyCalorieEngine {
  constructor(userProfile = {}) {
    // 1. Constants & Environment
    this.g = 9.80665;
    this.airDensity = 1.225; // rho
    this.drivetrainEfficiency = 0.95;
    this.metabolicEfficiency = userProfile.metabolicEfficiency || 0.23;
    
    // 2. Rider & Bike Parameters
    this.bodyMass = userProfile.bodyMass || 75.0; // kg
    this.bikeMass = userProfile.bikeMass || 10.0; // kg
    this.additionalLoad = userProfile.additionalLoad || 0.0;
    this.totalMass = this.bodyMass + this.bikeMass + this.additionalLoad;
    this.effectiveMass = this.totalMass * 1.015; // 1.5% rotational inertia
    
    // Bike Type defaults
    const bikeType = userProfile.bikeType || 'road';
    this.Crr = this.getDefaultCrr(bikeType);
    this.CdA = this.getDefaultCdA(bikeType);

    // 3. Sensor State
    this.lastGPSUpdate = 0;
    this.velocityMPS = 0; // m/s
    this.accelerationMPS2 = 0;
    this.gradient = 0; // dh/ds
    
    // Mount Calibration State
    this.isCalibrating = false;
    this.calibrationSamples = [];
    this.gravityVector = [0, 9.81, 0]; // Default assuming upright, but will be calibrated
    
    // Fusion / Filter State
    this.lastVelocityMPS = 0;
    this.lastIMUUpdate = 0;
    this.smoothedGPSAltitude = null;
    this.lastGPSAltitude = null;

    // 4. Output Metrics
    this.mechanicalEnergyJoules = 0;
    this.metabolicEnergyJoules = 0;
    this.calories = 0;
    this.confidenceScore = 50; // starts midway, increases with good GPS
    this.lastPower = 0;
    
    // Status
    this.isStationary = true;
    this.lastProcessTime = performance.now();
  }

  getDefaultCrr(type) {
    const map = { 'road': 0.005, 'hybrid': 0.006, 'mountain': 0.010, 'city': 0.006, 'gravel': 0.008, 'ebike': 0.007 };
    return map[type] || 0.005;
  }

  getDefaultCdA(type) {
    const map = { 'road': 0.35, 'hybrid': 0.40, 'mountain': 0.50, 'city': 0.45, 'gravel': 0.40, 'ebike': 0.45 };
    return map[type] || 0.35;
  }

  // CALIBRATION: Determine how phone is mounted
  startMountCalibration() {
    this.isCalibrating = true;
    this.calibrationSamples = [];
  }

  finishMountCalibration() {
    this.isCalibrating = false;
    if (this.calibrationSamples.length > 10) {
      // Average the acceleration vectors to find gravity vector
      let sumX = 0, sumY = 0, sumZ = 0;
      this.calibrationSamples.forEach(s => {
        sumX += s[0]; sumY += s[1]; sumZ += s[2];
      });
      const n = this.calibrationSamples.length;
      this.gravityVector = [sumX/n, sumY/n, sumZ/n];
    }
  }

  // SENSOR INPUTS
  updateIMU(accelX, accelY, accelZ) {
    const now = performance.now();
    if (this.isCalibrating) {
      this.calibrationSamples.push([accelX, accelY, accelZ]);
    }
    this.lastIMUUpdate = now;
  }

  updateGPS(speedMPS, altitude, accuracyMeters) {
    const now = performance.now();
    const dt = (now - this.lastGPSUpdate) / 1000;
    
    // GPS Quality check
    if (accuracyMeters > 30) {
      this.confidenceScore = Math.max(0, this.confidenceScore - 10);
      return; // Too inaccurate to use for physics
    } else {
      this.confidenceScore = Math.min(100, this.confidenceScore + 5);
    }

    if (speedMPS !== null && !isNaN(speedMPS)) {
      this.lastVelocityMPS = this.velocityMPS;
      
      // Low-Pass Filter on GPS Speed
      this.velocityMPS = this.velocityMPS * 0.3 + speedMPS * 0.7;
      
      // Derive acceleration from GPS
      if (dt > 0 && dt < 5) {
        let rawAccel = (this.velocityMPS - this.lastVelocityMPS) / dt;
        // Clamp acceleration to physically reasonable cycling limits (-5 to +5 m/s2)
        rawAccel = Math.max(-5, Math.min(5, rawAccel));
        this.accelerationMPS2 = this.accelerationMPS2 * 0.5 + rawAccel * 0.5;
      }
    }

    // Altitude & Gradient
    if (altitude !== null && !isNaN(altitude)) {
      if (this.smoothedGPSAltitude === null) {
        this.smoothedGPSAltitude = altitude;
      } else {
        // Slowly track altitude
        const oldAlt = this.smoothedGPSAltitude;
        this.smoothedGPSAltitude = this.smoothedGPSAltitude * 0.9 + altitude * 0.1;
        
        if (dt > 0 && this.velocityMPS > 1.0) {
           const dh = this.smoothedGPSAltitude - oldAlt;
           const ds = this.velocityMPS * dt;
           if (ds > 0) {
              const rawGradient = dh / ds;
              // Clamp gradient to reasonable limits (-35% to +35%)
              const clampedGrad = Math.max(-0.35, Math.min(0.35, rawGradient));
              this.gradient = this.gradient * 0.8 + clampedGrad * 0.2;
           }
        }
      }
    }
    
    this.isStationary = (this.velocityMPS < 0.8);
    this.lastGPSUpdate = now;
  }

  // REAL-TIME ENGINE TICK (runs at e.g. 10Hz)
  processTick() {
    const now = performance.now();
    const dt = (now - this.lastProcessTime) / 1000.0;
    this.lastProcessTime = now;

    if (dt <= 0 || dt > 1.0 || this.isStationary) {
      return; // Don't accumulate energy if stationary or app was suspended
    }

    // 1. Environmental Forces
    const theta = Math.atan(this.gradient);
    
    // Rolling Resistance
    const F_rr = this.Crr * this.totalMass * this.g * Math.cos(theta);
    
    // Aerodynamic Drag (Assuming zero wind for now)
    const v_relative = this.velocityMPS;
    const F_aero = 0.5 * this.airDensity * this.CdA * (v_relative * v_relative);
    
    // Gravity Force
    const F_gravity = this.totalMass * this.g * Math.sin(theta);
    
    // Acceleration Force
    const F_acc = this.effectiveMass * this.accelerationMPS2;

    // Total Force
    const F_total = F_rr + F_aero + F_gravity + F_acc;

    // 2. Power
    const P_wheel = F_total * this.velocityMPS;
    
    // Rider Power (Accounting for drivetrain loss)
    let P_rider = P_wheel / this.drivetrainEfficiency;
    
    // Coasting / Braking: If rider power is negative, they aren't pedaling.
    // Metabolic cost of coasting is baseline (ignored here, only accounting for active mechanical work)
    if (P_rider < 0) {
      P_rider = 0;
    }
    
    // Clamp to superhuman limits
    P_rider = Math.min(P_rider, 2000);
    this.lastPower = P_rider;

    // 3. Energy Integration
    const mechanicalWorkJoules = P_rider * dt;
    this.mechanicalEnergyJoules += mechanicalWorkJoules;
    
    const metabolicWorkJoules = mechanicalWorkJoules / this.metabolicEfficiency;
    this.metabolicEnergyJoules += metabolicWorkJoules;
    
    this.calories = this.metabolicEnergyJoules / 4184.0;
  }

  getMetrics() {
    return {
      calories: this.calories,
      mechanicalEnergy: this.mechanicalEnergyJoules,
      metabolicEnergy: this.metabolicEnergyJoules,
      confidence: this.confidenceScore,
      power: this.velocityMPS > 0.8 ? this.lastPower : 0
    };
  }
}
