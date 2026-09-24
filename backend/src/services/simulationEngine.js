import { Shipment } from '../db/models.js';

/**
 * Autonomous Background Simulation Engine
 * Computes deterministic elapsed progress based on actual calendar time (e.g. 7 days / 1 week).
 * Ensures simulation progresses 24/7 on the server even when the admin or customer is NOT on the website.
 */

export function advanceShipmentSimulation(shipment, now = new Date()) {
  if (!shipment || !shipment.simulation || !shipment.simulation.active) {
    return false;
  }

  const sim = shipment.simulation;

  // Only autonomously advance 'realtime' schedule mode.
  // 'manual' mode is reserved for interactive on-screen testing.
  if (sim.mode === 'manual') {
    return false;
  }

  // Ensure durationDays is a valid positive number (default 7 days)
  const durationDays = (typeof sim.durationDays === 'number' && sim.durationDays > 0) ? sim.durationDays : 7;
  sim.durationDays = durationDays;

  // Initialize startedAt if not set
  if (!sim.startedAt) {
    sim.startedAt = now.toISOString();
    sim.startProgress = typeof sim.currentProgress === 'number' ? sim.currentProgress : 0;
  }

  const startedAtMs = new Date(sim.startedAt).getTime();
  const totalDurationMs = durationDays * 24 * 60 * 60 * 1000;
  const targetMs = startedAtMs + totalDurationMs;
  sim.targetCompletionDate = new Date(targetMs).toISOString();

  const nowMs = now.getTime();
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const startProg = typeof sim.startProgress === 'number' ? sim.startProgress : 0;
  const remainingSpan = 100 - startProg;

  // Calculate elapsed progress
  const progressRatio = totalDurationMs > 0 ? Math.min(1, elapsedMs / totalDurationMs) : 1;
  const rawProgress = startProg + (progressRatio * remainingSpan);
  const calculatedProgress = Math.min(100, Math.max(0, Math.round(rawProgress * 10) / 10));

  const prevProgress = sim.currentProgress || 0;
  const prevStatus = shipment.status;
  sim.currentProgress = calculatedProgress;

  // Determine Waypoints list
  const wps = (sim.waypoints && sim.waypoints.length > 0)
    ? sim.waypoints
    : [shipment.originCode || 'CHI', shipment.destCode || 'SEA'];

  // Status & Location Milestones based on calculatedProgress
  if (calculatedProgress === 0) {
    shipment.status = 'Registered';
    shipment.currentLocationName = `Scheduled for departure at ${shipment.origin || 'Origin Terminal'}`;
    sim.logs = 'Shipment registered in logistics terminal. Manifest approved.';
  } else if (calculatedProgress > 0 && calculatedProgress < 20) {
    shipment.status = 'Warehouse';
    const hub = wps[0] || shipment.originCode || 'Origin Hub';
    shipment.currentLocationName = `Sorted at origin distribution hub (${hub})`;
    sim.logs = `Cargo cleared sorting scanner at ${hub}. Preparing for line-haul dispatch.`;
  } else if (calculatedProgress >= 20 && calculatedProgress < 85) {
    shipment.status = 'In Transit';
    // Calculate intermediate waypoint interpolation
    if (wps.length >= 2) {
      const transitFraction = (calculatedProgress - 20) / 65; // 0 to 1
      const totalSegments = wps.length - 1;
      const segmentIndex = Math.min(Math.floor(transitFraction * totalSegments), totalSegments - 1);
      const fromHub = wps[segmentIndex];
      const toHub = wps[segmentIndex + 1];
      shipment.currentLocationName = `En-route via ${shipment.vessel || 'Truck'} from ${fromHub} towards ${toHub}`;
    } else {
      shipment.currentLocationName = `En-route via ${shipment.vessel || 'Truck'} to ${shipment.destination || 'Destination'}`;
    }
    sim.logs = `Autonomous transit active (${durationDays} days schedule). Progress: ${calculatedProgress.toFixed(1)}%.`;
  } else if (calculatedProgress >= 85 && calculatedProgress < 100) {
    shipment.status = 'Out for Delivery';
    const destHub = wps[wps.length - 1] || shipment.destCode || 'Destination Hub';
    shipment.currentLocationName = `Final dispatch facility near ${destHub}`;
    sim.logs = 'Package loaded onto destination regional delivery carrier. Out for final delivery.';
  } else if (calculatedProgress >= 100) {
    shipment.status = 'Delivered';
    shipment.currentLocationName = `Arrived at recipient address: ${shipment.address || shipment.destination}`;
    sim.logs = 'Delivered safely. Electronic signature and delivery confirmation registered.';
    sim.active = false; // Simulation naturally concludes
  }

  // Automatically update shipment ETA to match target completion date
  const targetDateObj = new Date(targetMs);
  const yyyy = targetDateObj.getFullYear();
  const mm = String(targetDateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDateObj.getDate()).padStart(2, '0');
  shipment.eta = `${yyyy}-${mm}-${dd}`;

  sim.lastUpdated = now.toISOString();

  // Return true if progress or status changed
  return Math.abs(calculatedProgress - prevProgress) >= 0.1 || prevStatus !== shipment.status || (calculatedProgress >= 100 && prevProgress < 100);
}

let tickerInterval = null;

export function startSimulationEngine(broadcastFn) {
  if (tickerInterval) clearInterval(tickerInterval);

  console.log('[SimulationEngine] Autonomous background simulation engine started.');

  // Run every 20 seconds to advance any active real-time shipments
  tickerInterval = setInterval(async () => {
    try {
      const allShipments = await Shipment.find();
      const activeShipments = (allShipments || []).filter(s => s.simulation && s.simulation.active && s.simulation.mode === 'realtime');

      for (const shipment of activeShipments) {
        const changed = advanceShipmentSimulation(shipment);
        if (changed) {
          await shipment.save();
          if (broadcastFn) {
            broadcastFn(shipment);
          }
        }
      }
    } catch (err) {
      console.warn('[SimulationEngine] Ticker error:', err.message);
    }
  }, 20000);
}

export function stopSimulationEngine() {
  if (tickerInterval) {
    clearInterval(tickerInterval);
    tickerInterval = null;
  }
}
