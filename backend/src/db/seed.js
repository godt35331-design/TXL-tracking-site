import mongoose from 'mongoose';
import { Customer, Shipment } from './models.js';
import { connectDatabase } from './connection.js';

const SEED_CUSTOMERS = [
  { name: "John Doe", email: "customer@txlglobaltracking.com", volume: 2 },
  { name: "Jane Smith", email: "jane.smith@corporation.com", volume: 1 }
];

const SEED_SHIPMENTS = [
  {
    id: "TXL-78361092",
    customerName: "John Doe",
    customerEmail: "customer@txlglobaltracking.com",
    customerPhone: "+1 555 0199",
    address: "1024 Airport Way, Seattle, WA",
    weight: 820,
    desc: "Precision Calibration Instrumentation & Avionics",
    vessel: "Plane",
    origin: "Frankfurt, Germany",
    destination: "Seattle, WA",
    originCode: "FRA",
    destCode: "SEA",
    eta: "2026-07-22",
    status: "In Transit",
    currentLocationName: "In Transit near Chicago Air Hub",
    simulation: {
      active: false,
      currentProgress: 42,
      waypoints: ["FRA", "LHR", "ORD", "SEA"],
      speedMultiplier: 2,
      status: "In Transit",
      logs: "Departed O'Hare Air Cargo facility; en route to Seattle."
    }
  },
  {
    id: "TXL-10492837",
    customerName: "John Doe",
    customerEmail: "customer@txlglobaltracking.com",
    customerPhone: "+1 555 0199",
    address: "300 Tech Center Blvd, Los Angeles, CA",
    weight: 12450,
    desc: "Modular Cooling Racks & High-Density Compute Servers",
    vessel: "Truck",
    origin: "New York, NY",
    destination: "Los Angeles, CA",
    originCode: "NY",
    destCode: "LA",
    eta: "2026-07-25",
    status: "Warehouse",
    currentLocationName: "Processing at TXL Regional Hub Frankfurt/NY",
    simulation: {
      active: false,
      currentProgress: 25,
      waypoints: ["NY", "CLE", "CHI", "LA"],
      speedMultiplier: 1,
      status: "Warehouse",
      logs: "Shipment sorting completed; scheduled for express line-haul dispatch."
    }
  },
  {
    id: "TXL-99238472",
    customerName: "Jane Smith",
    customerEmail: "jane.smith@corporation.com",
    customerPhone: "+1 555 0341",
    address: "88 Market St, San Francisco, CA",
    weight: 6400,
    desc: "Automotive Lithium Traction Batteries",
    vessel: "Ship",
    origin: "Miami, FL",
    destination: "San Francisco, CA",
    originCode: "MIA",
    destCode: "SF",
    eta: "2026-07-18",
    status: "Delivered",
    currentLocationName: "Delivered at warehouse dock B",
    simulation: {
      active: false,
      currentProgress: 100,
      waypoints: ["MIA", "ATL", "PHX", "SF"],
      speedMultiplier: 1,
      status: "Delivered",
      logs: "Signature received. Delivered by TXL Express courier."
    }
  },
  {
    id: "TXL-44821903",
    customerName: "John Doe",
    customerEmail: "customer@txlglobaltracking.com",
    customerPhone: "+44 20 7946 0912",
    address: "24 Princess St, Edinburgh, Scotland, UK",
    weight: 340,
    desc: "Critical Aerospace Components & Microelectronics",
    vessel: "Truck",
    origin: "London Heathrow Superhub, UK",
    destination: "Edinburgh Turnhouse Hub, UK",
    originCode: "LHR",
    destCode: "EDI",
    eta: "2026-08-04",
    status: "In Transit",
    currentLocationName: "In Transit near East Midlands Superhub",
    simulation: {
      active: true,
      currentProgress: 55,
      waypoints: ["LHR", "EMA", "MAN", "EDI"],
      speedMultiplier: 1.5,
      status: "In Transit",
      logs: "Passed Manchester Northwest Hub; proceeding north toward Scotland."
    }
  }
];

async function runSeeder() {
  try {
    console.log('Seeder process started...');
    await connectDatabase();
    
    console.log('Clearing existing collections (Customers and Shipments)...');
    await Customer.deleteMany({});
    await Shipment.deleteMany({});
    
    console.log('Seeding Customers...');
    await Customer.insertMany(SEED_CUSTOMERS);
    
    console.log('Seeding Shipments...');
    await Shipment.insertMany(SEED_SHIPMENTS);
    
    console.log('Database successfully seeded with TXL test data!');
  } catch (error) {
    console.error('Seeding encountered an error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Seeder process completed and connection closed.');
    process.exit(0);
  }
}

runSeeder();
