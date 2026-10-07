import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Truck, Plane, Ship, Activity, ClipboardList, PlusCircle, CheckCircle, 
  MapPin, LogOut, ArrowRight, Eye, EyeOff, Shield, Users, Package, RefreshCw, Mail, Lock,
  SlidersHorizontal, Download, Printer, Search, Trash, MessageSquare, MessageCircle, Send, User,
  Clock, Zap
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://127.0.0.1:5000/api' 
    : `${window.location.origin}/api`);

// Attach the signed-in user's session token to every call to our own API; drop the session if it expires
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  if (!url.startsWith(API_BASE)) return nativeFetch(input, init);
  let token = null;
  try { token = JSON.parse(localStorage.getItem('txl_user') || 'null')?.token || null; } catch (e) { token = null; }
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  return nativeFetch(input, { ...init, headers }).then(res => {
    if (res.status === 401 && token && !url.includes('/auth/login')) {
      localStorage.removeItem('txl_user');
      localStorage.removeItem('ups_user');
      window.location.hash = '#home';
      window.location.reload();
    }
    return res;
  });
};

const WS_BASE = import.meta.env.VITE_WS_BASE || 
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'ws://127.0.0.1:5000' 
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);

// Comprehensive global database of US States, US Freight Superhubs, UK Cities & Checkpoints, and International Gateways
const GLOBAL_LOGISTICS_HUBS = {
  // ==========================================
  // 🇬🇧 UNITED KINGDOM — CITIES, PORTS & HUBS
  // ==========================================
  // --- London & Southeast ---
  'LHR': { name: 'London Heathrow Air Cargo Superhub', stateName: 'Greater London', country: 'UK', region: 'UK-London', coords: [51.4700, -0.4543], hub: 'LHR', flag: '🇬🇧', type: 'Air Cargo Superhub' },
  'LGW': { name: 'London Gatwick Freight Terminal', stateName: 'West Sussex / London', country: 'UK', region: 'UK-London', coords: [51.1537, -0.1821], hub: 'LGW', flag: '🇬🇧', type: 'Air Freight' },
  'LON': { name: 'Central London Distribution Hub', stateName: 'City of London', country: 'UK', region: 'UK-London', coords: [51.5074, -0.1278], hub: 'LON', flag: '🇬🇧', type: 'Metropolitan Logistics' },
  'STN': { name: 'London Stansted International Cargo Terminal', stateName: 'Essex', country: 'UK', region: 'UK-London', coords: [51.8860, 0.2389], hub: 'STN', flag: '🇬🇧', type: 'Express Air Cargo' },
  'LTN': { name: 'London Luton Logistics Center', stateName: 'Bedfordshire', country: 'UK', region: 'UK-London', coords: [51.8747, -0.3683], hub: 'LTN', flag: '🇬🇧', type: 'Regional Hub' },
  'DVR': { name: 'Port of Dover Ferry Terminal', stateName: 'Kent', country: 'UK', region: 'UK-London', coords: [51.1279, 1.3134], hub: 'DVR', flag: '🇬🇧', type: 'Channel Maritime Gateway' },
  'SOU': { name: 'Port of Southampton Container Terminal', stateName: 'Hampshire', country: 'UK', region: 'UK-London', coords: [50.9097, -1.4044], hub: 'SOU', flag: '🇬🇧', type: 'Deep Sea Container Port' },
  'FXT': { name: 'Port of Felixstowe Ocean Gateway', stateName: 'Suffolk', country: 'UK', region: 'UK-London', coords: [51.9540, 1.3060], hub: 'FXT', flag: '🇬🇧', type: 'Major Container Terminal' },

  // --- Midlands (The Logistics Golden Triangle) ---
  'EMA': { name: 'East Midlands Airport Freight Superhub', stateName: 'Leicestershire / Derby', country: 'UK', region: 'UK-Midlands', coords: [52.8311, -1.3281], hub: 'EMA', flag: '🇬🇧', type: 'UK #1 Pure Air Cargo Hub', note: 'UK Superhub' },
  'BHX': { name: 'Birmingham International & West Midlands Hub', stateName: 'West Midlands', country: 'UK', region: 'UK-Midlands', coords: [52.4524, -1.7435], hub: 'BHX', flag: '🇬🇧', type: 'Central Sorting Hub' },
  'COV': { name: 'Coventry Central National Sorting Hub', stateName: 'Warwickshire', country: 'UK', region: 'UK-Midlands', coords: [52.4068, -1.5197], hub: 'COV', flag: '🇬🇧', type: 'National Parcel Hub' },
  'NOT': { name: 'Nottingham Freight Depot', stateName: 'Nottinghamshire', country: 'UK', region: 'UK-Midlands', coords: [52.9548, -1.1581], hub: 'NOT', flag: '🇬🇧', type: 'Regional Depot' },
  'LEI': { name: 'Leicester National Distribution Center', stateName: 'Leicestershire', country: 'UK', region: 'UK-Midlands', coords: [52.6369, -1.1398], hub: 'LEI', flag: '🇬🇧', type: 'Distribution Center' },
  'NTH': { name: 'Northampton Logistics Spine (Golden Triangle)', stateName: 'Northamptonshire', country: 'UK', region: 'UK-Midlands', coords: [52.2405, -0.9027], hub: 'NTH', flag: '🇬🇧', type: 'Logistics Corridor' },
  'STK': { name: 'Stoke-on-Trent Distribution Hub', stateName: 'Staffordshire', country: 'UK', region: 'UK-Midlands', coords: [53.0027, -2.1794], hub: 'STK', flag: '🇬🇧', type: 'Regional Sorting' },
  'DER': { name: 'Derby Rail & Road Freight Hub', stateName: 'Derbyshire', country: 'UK', region: 'UK-Midlands', coords: [52.9225, -1.4746], hub: 'DER', flag: '🇬🇧', type: 'Intermodal Freight' },

  // --- North of England ---
  'MAN': { name: 'Manchester Airport & Northwest Hub', stateName: 'Greater Manchester', country: 'UK', region: 'UK-North', coords: [53.3653, -2.2727], hub: 'MAN', flag: '🇬🇧', type: 'Transatlantic & Regional Air' },
  'LPL': { name: 'Liverpool Port & Mersey Gateway', stateName: 'Merseyside', country: 'UK', region: 'UK-North', coords: [53.4084, -2.9916], hub: 'LPL', flag: '🇬🇧', type: 'Atlantic Container Port' },
  'LBA': { name: 'Leeds Bradford & Yorkshire Hub', stateName: 'West Yorkshire', country: 'UK', region: 'UK-North', coords: [53.8659, -1.6606], hub: 'LBA', flag: '🇬🇧', type: 'Yorkshire Freight Hub' },
  'SHF': { name: 'Sheffield South Yorkshire Logistics', stateName: 'South Yorkshire', country: 'UK', region: 'UK-North', coords: [53.3811, -1.4701], hub: 'SHF', flag: '🇬🇧', type: 'Logistics Park' },
  'NCL': { name: 'Newcastle upon Tyne & Northeast Hub', stateName: 'Tyne and Wear', country: 'UK', region: 'UK-North', coords: [55.0375, -1.6917], hub: 'NCL', flag: '🇬🇧', type: 'Northeast Cargo Gateway' },
  'HUL': { name: 'Port of Hull Humber Maritime Terminal', stateName: 'East Yorkshire', country: 'UK', region: 'UK-North', coords: [53.7457, -0.3367], hub: 'HUL', flag: '🇬🇧', type: 'North Sea Maritime' },
  'MDB': { name: 'Teesport & Middlesbrough Container Terminal', stateName: 'North Yorkshire', country: 'UK', region: 'UK-North', coords: [54.5742, -1.2350], hub: 'MDB', flag: '🇬🇧', type: 'Container Seaport' },
  'CRX': { name: 'Carlisle Scottish Border Checkpoint', stateName: 'Cumbria', country: 'UK', region: 'UK-North', coords: [54.8925, -2.9329], hub: 'CRX', flag: '🇬🇧', type: 'Border Transit Depot' },

  // --- Scotland & Northern Ireland ---
  'EDI': { name: 'Edinburgh Turnhouse International Hub', stateName: 'Scotland', country: 'UK', region: 'UK-Scotland-NI', coords: [55.9508, -3.3615], hub: 'EDI', flag: '🇬🇧', type: 'Scottish Air Hub' },
  'GLA': { name: 'Glasgow Airport & Central Scotland Gateway', stateName: 'Scotland', country: 'UK', region: 'UK-Scotland-NI', coords: [55.8719, -4.4331], hub: 'GLA', flag: '🇬🇧', type: 'Air & Line-Haul' },
  'ABZ': { name: 'Aberdeen North Sea Cargo Terminal', stateName: 'Scotland', country: 'UK', region: 'UK-Scotland-NI', coords: [57.2019, -2.1978], hub: 'ABZ', flag: '🇬🇧', type: 'Energy & Maritime Cargo' },
  'PIK': { name: 'Glasgow Prestwick Heavy Freight Gateway', stateName: 'Scotland', country: 'UK', region: 'UK-Scotland-NI', coords: [55.5094, -4.5867], hub: 'PIK', flag: '🇬🇧', type: 'Heavy Cargo Hub' },
  'DND': { name: 'Dundee & Tayside Distribution Hub', stateName: 'Scotland', country: 'UK', region: 'UK-Scotland-NI', coords: [56.4620, -2.9707], hub: 'DND', flag: '🇬🇧', type: 'Regional Depot' },
  'INV': { name: 'Inverness Highlands Logistics Outpost', stateName: 'Scotland', country: 'UK', region: 'UK-Scotland-NI', coords: [57.4778, -4.2247], hub: 'INV', flag: '🇬🇧', type: 'Highlands Distribution' },
  'BFS': { name: 'Belfast International & Harbour Port', stateName: 'Northern Ireland', country: 'UK', region: 'UK-Scotland-NI', coords: [54.6575, -6.2158], hub: 'BFS', flag: '🇬🇧', type: 'Irish Sea Gateway' },
  'BHD': { name: 'Belfast City Freight Depot', stateName: 'Northern Ireland', country: 'UK', region: 'UK-Scotland-NI', coords: [54.6181, -5.8725], hub: 'BHD', flag: '🇬🇧', type: 'Urban Distribution' },
  'LDY': { name: 'Derry / Londonderry Freight Hub', stateName: 'Northern Ireland', country: 'UK', region: 'UK-Scotland-NI', coords: [54.9966, -7.3086], hub: 'LDY', flag: '🇬🇧', type: 'Northwest NI Depot' },

  // --- Wales & Southwest England ---
  'CWL': { name: 'Cardiff Airport & South Wales Gateway', stateName: 'Wales', country: 'UK', region: 'UK-Wales-SW', coords: [51.3967, -3.3433], hub: 'CWL', flag: '🇬🇧', type: 'Welsh National Gateway' },
  'SWA': { name: 'Swansea West Wales Distribution Depot', stateName: 'Wales', country: 'UK', region: 'UK-Wales-SW', coords: [51.6214, -3.9436], hub: 'SWA', flag: '🇬🇧', type: 'Regional Hub' },
  'BRS': { name: 'Bristol Severnside Distribution Gateway', stateName: 'Bristol / Somerset', country: 'UK', region: 'UK-Wales-SW', coords: [51.4545, -2.5879], hub: 'BRS', flag: '🇬🇧', type: 'Severnside Logistics Hub' },
  'PLY': { name: 'Plymouth & Southwest Maritime Gateway', stateName: 'Devon', country: 'UK', region: 'UK-Wales-SW', coords: [50.3755, -4.1427], hub: 'PLY', flag: '🇬🇧', type: 'Maritime & Road Depot' },
  'EXT': { name: 'Exeter Regional Freight Depot', stateName: 'Devon', country: 'UK', region: 'UK-Wales-SW', coords: [50.7260, -3.5275], hub: 'EXT', flag: '🇬🇧', type: 'Southwest Hub' },
  'OXF': { name: 'Oxford Logistics Distribution Depot', stateName: 'Oxfordshire', country: 'UK', region: 'UK-Wales-SW', coords: [51.7520, -1.2577], hub: 'OXF', flag: '🇬🇧', type: 'Technology Corridor' },
  'CAM': { name: 'Cambridge Logistics & Tech Distribution', stateName: 'Cambridgeshire', country: 'UK', region: 'UK-Wales-SW', coords: [52.2053, 0.1218], hub: 'CAM', flag: '🇬🇧', type: 'Tech & Pharma Hub' },

  // ==========================================
  // 🇺🇸 UNITED STATES — MAJOR NATIONAL HUBS
  // ==========================================
  'MEM': { name: 'Memphis World Air Cargo Superhub', stateName: 'Tennessee', country: 'US', region: 'US-Major', coords: [35.0424, -89.9767], hub: 'MEM', flag: '🇺🇸', type: 'Global Air Cargo Superhub', note: 'World Air Hub' },
  'SDF': { name: 'Louisville Worldport Cargo Superhub', stateName: 'Kentucky', country: 'US', region: 'US-Major', coords: [38.1744, -85.7360], hub: 'SDF', flag: '🇺🇸', type: 'Global Air Superhub', note: 'Worldport' },
  'CVG': { name: 'Cincinnati / Northern KY Superhub', stateName: 'Kentucky', country: 'US', region: 'US-Major', coords: [39.0488, -84.6678], hub: 'CVG', flag: '🇺🇸', type: 'TXL Americas Superhub', note: 'Americas Superhub' },
  'ORD': { name: 'Chicago O\'Hare Air Cargo Center', stateName: 'Illinois', country: 'US', region: 'US-Major', coords: [41.9742, -87.9073], hub: 'ORD', flag: '🇺🇸', type: 'Midwest Air Gateway' },
  'JFK': { name: 'New York JFK International Air Cargo', stateName: 'New York', country: 'US', region: 'US-Major', coords: [40.6413, -73.7781], hub: 'JFK', flag: '🇺🇸', type: 'Transatlantic Air Gateway' },
  'EWR': { name: 'Newark Liberty Container Port & Air Hub', stateName: 'New Jersey', country: 'US', region: 'US-Major', coords: [40.6895, -74.1745], hub: 'EWR', flag: '🇺🇸', type: 'Intermodal Port' },
  'LAX': { name: 'Los Angeles International Air Cargo', stateName: 'California', country: 'US', region: 'US-Major', coords: [33.9416, -118.4085], hub: 'LAX', flag: '🇺🇸', type: 'Pacific Air Gateway' },
  'LGB': { name: 'Port of Long Beach Maritime Gateway', stateName: 'California', country: 'US', region: 'US-Major', coords: [33.7542, -118.2165], hub: 'LGB', flag: '🇺🇸', type: 'Premier Pacific Container Port' },
  'DFW': { name: 'Dallas/Fort Worth Central Superhub', stateName: 'Texas', country: 'US', region: 'US-Major', coords: [32.8998, -97.0403], hub: 'DFW', flag: '🇺🇸', type: 'Central US Air Hub' },
  'IAH': { name: 'Houston Bush & Port of Houston', stateName: 'Texas', country: 'US', region: 'US-Major', coords: [29.9902, -95.3368], hub: 'IAH', flag: '🇺🇸', type: 'Gulf Coast Port & Air' },
  'ATL': { name: 'Atlanta Hartsfield Air Cargo Hub', stateName: 'Georgia', country: 'US', region: 'US-Major', coords: [33.6407, -84.4277], hub: 'ATL', flag: '🇺🇸', type: 'Southeast Superhub' },
  'MIA': { name: 'Miami Americas Gateway & Air Cargo', stateName: 'Florida', country: 'US', region: 'US-Major', coords: [25.7959, -80.2870], hub: 'MIA', flag: '🇺🇸', type: 'Latin America Gateway', note: 'Americas Gateway' },
  'SEA': { name: 'Seattle/Tacoma Pacific Gateway', stateName: 'Washington', country: 'US', region: 'US-Major', coords: [47.4502, -122.3088], hub: 'SEA', flag: '🇺🇸', type: 'Pacific Northwest Hub' },
  'IND': { name: 'Indianapolis Logistics Central Hub', stateName: 'Indiana', country: 'US', region: 'US-Major', coords: [39.7173, -86.2944], hub: 'IND', flag: '🇺🇸', type: 'National Distribution Spine' },

  // ==========================================
  // 🇺🇸 UNITED STATES — ALL 50 STATES + DC
  // ==========================================
  // --- South & Southeast ---
  'TX': { name: 'Dallas / Houston Logistics Hub', stateName: 'Texas', country: 'US', region: 'US-South', coords: [32.8998, -97.0403], hub: 'DFW', flag: '🇺🇸' },
  'FL': { name: 'Miami Americas Gateway / Orlando', stateName: 'Florida', country: 'US', region: 'US-South', coords: [25.7959, -80.2870], hub: 'MIA', flag: '🇺🇸', note: 'Americas Gateway' },
  'GA': { name: 'Atlanta Hartsfield Cargo', stateName: 'Georgia', country: 'US', region: 'US-South', coords: [33.6407, -84.4277], hub: 'ATL', flag: '🇺🇸' },
  'NC': { name: 'Charlotte / Raleigh', stateName: 'North Carolina', country: 'US', region: 'US-South', coords: [35.2144, -80.9473], hub: 'CLT', flag: '🇺🇸' },
  'TN': { name: 'Nashville / Memphis Superhub', stateName: 'Tennessee', country: 'US', region: 'US-South', coords: [36.1263, -86.6774], hub: 'BNA', flag: '🇺🇸' },
  'VA': { name: 'Richmond / Norfolk Port', stateName: 'Virginia', country: 'US', region: 'US-South', coords: [37.5052, -77.3197], hub: 'RIC', flag: '🇺🇸' },
  'KY': { name: 'Cincinnati/Northern KY Hub', stateName: 'Kentucky', country: 'US', region: 'US-South', coords: [39.0488, -84.6678], hub: 'CVG', flag: '🇺🇸' },
  'SC': { name: 'Charleston Container Port / Columbia', stateName: 'South Carolina', country: 'US', region: 'US-South', coords: [32.8986, -80.0405], hub: 'CHS', flag: '🇺🇸' },
  'AL': { name: 'Birmingham Logistics Center', stateName: 'Alabama', country: 'US', region: 'US-South', coords: [33.5629, -86.7535], hub: 'BHM', flag: '🇺🇸' },
  'LA': { name: 'New Orleans Armstrong & Mississippi Port', stateName: 'Louisiana', country: 'US', region: 'US-South', coords: [29.9911, -90.2592], hub: 'MSY', flag: '🇺🇸' },
  'OK': { name: 'Oklahoma City Will Rogers Hub', stateName: 'Oklahoma', country: 'US', region: 'US-South', coords: [35.3931, -97.6007], hub: 'OKC', flag: '🇺🇸' },
  'AR': { name: 'Little Rock Clinton National', stateName: 'Arkansas', country: 'US', region: 'US-South', coords: [34.7294, -92.2243], hub: 'LIT', flag: '🇺🇸' },
  'MS': { name: 'Jackson Medgar Evers Hub', stateName: 'Mississippi', country: 'US', region: 'US-South', coords: [32.3112, -90.0759], hub: 'JAN', flag: '🇺🇸' },
  'WV': { name: 'Charleston Yeager Logistics Depot', stateName: 'West Virginia', country: 'US', region: 'US-South', coords: [38.3731, -81.5932], hub: 'CRW', flag: '🇺🇸' },

  // --- Midwest & Great Lakes ---
  'IL': { name: 'Chicago O\'Hare & Midwest Center', stateName: 'Illinois', country: 'US', region: 'US-Midwest', coords: [41.9742, -87.9073], hub: 'ORD', flag: '🇺🇸' },
  'OH': { name: 'Columbus Rickenbacker / Cleveland', stateName: 'Ohio', country: 'US', region: 'US-Midwest', coords: [39.9980, -82.8919], hub: 'CMH', flag: '🇺🇸' },
  'MI': { name: 'Detroit Metro International', stateName: 'Michigan', country: 'US', region: 'US-Midwest', coords: [42.2162, -83.3554], hub: 'DTW', flag: '🇺🇸' },
  'IN': { name: 'Indianapolis Air & Ground Hub', stateName: 'Indiana', country: 'US', region: 'US-Midwest', coords: [39.7173, -86.2944], hub: 'IND', flag: '🇺🇸' },
  'WI': { name: 'Milwaukee Mitchell Freight Center', stateName: 'Wisconsin', country: 'US', region: 'US-Midwest', coords: [42.9472, -87.8966], hub: 'MKE', flag: '🇺🇸' },
  'MN': { name: 'Minneapolis / St. Paul Twin Cities', stateName: 'Minnesota', country: 'US', region: 'US-Midwest', coords: [44.8848, -93.2223], hub: 'MSP', flag: '🇺🇸' },
  'MO': { name: 'Kansas City Logistics / St. Louis', stateName: 'Missouri', country: 'US', region: 'US-Midwest', coords: [39.2976, -94.7139], hub: 'MCI', flag: '🇺🇸' },
  'IA': { name: 'Des Moines Central Depot', stateName: 'Iowa', country: 'US', region: 'US-Midwest', coords: [41.5340, -93.6631], hub: 'DSM', flag: '🇺🇸' },
  'KS': { name: 'Wichita Eisenhower Logistics', stateName: 'Kansas', country: 'US', region: 'US-Midwest', coords: [37.6499, -97.4331], hub: 'ICT', flag: '🇺🇸' },
  'NE': { name: 'Omaha Eppley Freight Center', stateName: 'Nebraska', country: 'US', region: 'US-Midwest', coords: [41.3025, -95.8941], hub: 'OMA', flag: '🇺🇸' },
  'ND': { name: 'Fargo Hector Northern Hub', stateName: 'North Dakota', country: 'US', region: 'US-Midwest', coords: [46.9207, -96.8158], hub: 'FAR', flag: '🇺🇸' },
  'SD': { name: 'Sioux Falls Distribution Center', stateName: 'South Dakota', country: 'US', region: 'US-Midwest', coords: [43.5814, -96.7417], hub: 'FSD', flag: '🇺🇸' },

  // --- Northeast & Mid-Atlantic ---
  'NY': { name: 'New York City / JFK Gateway', stateName: 'New York', country: 'US', region: 'US-Northeast', coords: [40.6413, -73.7781], hub: 'JFK', flag: '🇺🇸' },
  'PA': { name: 'Philadelphia / Pittsburgh Logistics', stateName: 'Pennsylvania', country: 'US', region: 'US-Northeast', coords: [39.8744, -75.2424], hub: 'PHL', flag: '🇺🇸' },
  'NJ': { name: 'Newark Liberty Port / Jersey City', stateName: 'New Jersey', country: 'US', region: 'US-Northeast', coords: [40.6895, -74.1745], hub: 'EWR', flag: '🇺🇸' },
  'MA': { name: 'Boston Logan International Hub', stateName: 'Massachusetts', country: 'US', region: 'US-Northeast', coords: [42.3656, -71.0096], hub: 'BOS', flag: '🇺🇸' },
  'MD': { name: 'Baltimore Port & BWI Cargo', stateName: 'Maryland', country: 'US', region: 'US-Northeast', coords: [39.1774, -76.6684], hub: 'BWI', flag: '🇺🇸' },
  'CT': { name: 'Hartford / Bradley Cargo Center', stateName: 'Connecticut', country: 'US', region: 'US-Northeast', coords: [41.9388, -72.6832], hub: 'BDL', flag: '🇺🇸' },
  'RI': { name: 'Providence / Green Airport Hub', stateName: 'Rhode Island', country: 'US', region: 'US-Northeast', coords: [41.7240, -71.4282], hub: 'PVD', flag: '🇺🇸' },
  'NH': { name: 'Manchester-Boston Regional Hub', stateName: 'New Hampshire', country: 'US', region: 'US-Northeast', coords: [42.9345, -71.4371], hub: 'MHT', flag: '🇺🇸' },
  'VT': { name: 'Burlington Northern Gateway', stateName: 'Vermont', country: 'US', region: 'US-Northeast', coords: [44.4730, -73.1503], hub: 'BTV', flag: '🇺🇸' },
  'ME': { name: 'Portland Jetport Freight Terminal', stateName: 'Maine', country: 'US', region: 'US-Northeast', coords: [43.6462, -70.3093], hub: 'PWM', flag: '🇺🇸' },
  'DE': { name: 'Wilmington / New Castle Logistics', stateName: 'Delaware', country: 'US', region: 'US-Northeast', coords: [39.6787, -75.6065], hub: 'ILG', flag: '🇺🇸' },
  'DC': { name: 'Washington D.C. / Dulles Gateway', stateName: 'District of Columbia', country: 'US', region: 'US-Northeast', coords: [38.9531, -77.4565], hub: 'IAD', flag: '🇺🇸' },

  // --- West & Pacific ---
  'CA': { name: 'Los Angeles / San Francisco / Long Beach', stateName: 'California', country: 'US', region: 'US-West', coords: [33.9416, -118.4085], hub: 'LAX', flag: '🇺🇸' },
  'WA': { name: 'Seattle / Tacoma Pacific Port', stateName: 'Washington', country: 'US', region: 'US-West', coords: [47.4502, -122.3088], hub: 'SEA', flag: '🇺🇸' },
  'CO': { name: 'Denver International Air Hub', stateName: 'Colorado', country: 'US', region: 'US-West', coords: [39.8561, -104.6737], hub: 'DEN', flag: '🇺🇸' },
  'AZ': { name: 'Phoenix Sky Harbor Southwest Gateway', stateName: 'Arizona', country: 'US', region: 'US-West', coords: [33.4352, -112.0101], hub: 'PHX', flag: '🇺🇸' },
  'NV': { name: 'Las Vegas / Reno Distribution Spine', stateName: 'Nevada', country: 'US', region: 'US-West', coords: [36.0840, -115.1537], hub: 'LAS', flag: '🇺🇸' },
  'OR': { name: 'Portland International & Columbia Port', stateName: 'Oregon', country: 'US', region: 'US-West', coords: [45.5898, -122.5951], hub: 'PDX', flag: '🇺🇸' },
  'UT': { name: 'Salt Lake City Western Crossroads', stateName: 'Utah', country: 'US', region: 'US-West', coords: [40.7899, -111.9791], hub: 'SLC', flag: '🇺🇸' },
  'NM': { name: 'Albuquerque Sunport Cargo Depot', stateName: 'New Mexico', country: 'US', region: 'US-West', coords: [35.0402, -106.6092], hub: 'ABQ', flag: '🇺🇸' },
  'ID': { name: 'Boise Air Terminal Logistics', stateName: 'Idaho', country: 'US', region: 'US-West', coords: [43.5644, -116.2228], hub: 'BOI', flag: '🇺🇸' },
  'MT': { name: 'Billings Logan Northern Hub', stateName: 'Montana', country: 'US', region: 'US-West', coords: [45.8077, -108.5429], hub: 'BIL', flag: '🇺🇸' },
  'WY': { name: 'Cheyenne / Casper Distribution Depot', stateName: 'Wyoming', country: 'US', region: 'US-West', coords: [42.9080, -106.4645], hub: 'CPR', flag: '🇺🇸' },
  'AK': { name: 'Anchorage Cargo Gateway (Pacific Crossroads)', stateName: 'Alaska', country: 'US', region: 'US-West', coords: [61.1760, -149.9901], hub: 'ANC', flag: '🇺🇸', note: 'Pacific Air Hub' },
  'HI': { name: 'Honolulu International & Pacific Port', stateName: 'Hawaii', country: 'US', region: 'US-West', coords: [21.3187, -157.9225], hub: 'HNL', flag: '🇺🇸' },

  // ==========================================
  // 🌐 INTERNATIONAL INTERCONTINENTAL GATEWAYS
  // ==========================================
  'FRA': { name: 'Frankfurt CargoCity European Hub', stateName: 'Hesse', country: 'Germany', region: 'Global', coords: [50.0379, 8.5622], hub: 'FRA', flag: '🌐', type: 'European Air Superhub' },
  'AMS': { name: 'Amsterdam Schiphol & Rotterdam Seaport', stateName: 'North Holland', country: 'Netherlands', region: 'Global', coords: [52.3105, 4.7683], hub: 'AMS', flag: '🌐', type: 'Gateway Seaport/Air' },
  'CDG': { name: 'Paris Charles de Gaulle Cargo Hub', stateName: 'Île-de-France', country: 'France', region: 'Global', coords: [49.0097, 2.5479], hub: 'CDG', flag: '🌐', type: 'Continental Cargo Hub' },
  'DXB': { name: 'Dubai World Central & Al Maktoum Logistics', stateName: 'Dubai', country: 'UAE', region: 'Global', coords: [25.2532, 55.3657], hub: 'DXB', flag: '🌐', type: 'Middle East Air Crossroads' },
  'SIN': { name: 'Singapore Changi Air & Seaport Mega-Terminal', stateName: 'Changi', country: 'Singapore', region: 'Global', coords: [1.3644, 103.9915], hub: 'SIN', flag: '🌐', type: 'Southeast Asia Hub' },
  'HKG': { name: 'Hong Kong International Cargo Superhub', stateName: 'Chek Lap Kok', country: 'Hong Kong', region: 'Global', coords: [22.3080, 113.9185], hub: 'HKG', flag: '🌐', type: 'Asia Pacific Air Hub' },
  'HND': { name: 'Tokyo Haneda / Narita Air Hub', stateName: 'Tokyo', country: 'Japan', region: 'Global', coords: [35.5494, 139.7798], hub: 'HND', flag: '🌐', type: 'East Asia Gateway' },
  'YYZ': { name: 'Toronto Pearson Logistics Gateway', stateName: 'Ontario', country: 'Canada', region: 'Global', coords: [43.6777, -79.6248], hub: 'YYZ', flag: '🌐', type: 'North America Gateway' },
  'SYD': { name: 'Sydney Port Botany & Kingsford Smith Cargo', stateName: 'New South Wales', country: 'Australia', region: 'Global', coords: [-33.9399, 151.1753], hub: 'SYD', flag: '🌐', type: 'Oceania Superhub' }
};

// Backwards-compatible alias for existing references
const US_STATES_DATA = GLOBAL_LOGISTICS_HUBS;

// Complete GPS Coordinates mapping
const GPS_COORDINATES = {
  ...Object.fromEntries(Object.entries(GLOBAL_LOGISTICS_HUBS).map(([code, item]) => [code, item.coords])),
  // Airport & legacy aliases
  'CHI': [41.8781, -87.6298],
  'CLE': [41.4094, -81.8547],
  'KC':  [39.2976, -94.7139],
  'STL': [38.7472, -90.3599],
  'NY':  [40.7128, -74.0060],
  'PIT': [40.4914, -80.2329],
  'LA':  [34.0522, -118.2437],
  'SFO': [37.6213, -122.3790],
  'SF':  [37.7749, -122.4194],
  'SAN': [32.7338, -117.1933],
  'RDU': [35.8801, -78.7880],
  'MCO': [28.4312, -81.3081],
  'TPA': [27.9772, -82.5311],
  'LEJ': [51.4239, 12.2364],
  'BER': [52.3667, 13.5033],
  'BOM': [19.0896, 72.8656],
  'SZX': [22.6393, 113.8107]
};

// Format helper for text inputs and displays
const formatHubLocationText = (code) => {
  const item = GLOBAL_LOGISTICS_HUBS[code];
  if (!item) {
    const found = Object.entries(GLOBAL_LOGISTICS_HUBS).find(([k, data]) => data.hub === code);
    if (found) {
      return `${found[1].flag || ''} ${found[1].name} - ${code}01`;
    }
    return `${code} Station`;
  }
  const flag = item.flag || (item.country === 'UK' ? '🇬🇧' : item.country === 'US' ? '🇺🇸' : '🌐');
  const loc = item.stateName ? `${item.name}, ${item.stateName}` : item.name;
  return `${flag} ${loc} (${code})`;
};

// Grouped dropdown options for UK Checkpoints, US Superhubs, all 50 US States, and Global Gateways
const renderCategorizedHubOptions = (excludeList = []) => {
  const categories = [
    { key: 'UK-London', label: '🇬🇧 United Kingdom — London & Southeast Checkpoints' },
    { key: 'UK-Midlands', label: '🇬🇧 United Kingdom — Midlands Freight Golden Triangle' },
    { key: 'UK-North', label: '🇬🇧 United Kingdom — North of England & Humber Ports' },
    { key: 'UK-Scotland-NI', label: '🇬🇧 United Kingdom — Scotland & Northern Ireland Hubs' },
    { key: 'UK-Wales-SW', label: '🇬🇧 United Kingdom — Wales & Southwest Gateways' },
    { key: 'US-Major', label: '🇺🇸 United States — Major Cargo Superhubs & Seaports' },
    { key: 'US-South', label: '🇺🇸 United States — South & Southeast States' },
    { key: 'US-Midwest', label: '🇺🇸 United States — Midwest & Great Lakes States' },
    { key: 'US-Northeast', label: '🇺🇸 United States — Northeast & Mid-Atlantic States' },
    { key: 'US-West', label: '🇺🇸 United States — West & Pacific States' },
    { key: 'Global', label: '🌐 Global — Intercontinental Air & Ocean Hubs' },
    { key: 'Custom', label: '📍 Custom Locations (searched worldwide)' }
  ];

  return categories.map(cat => {
    const hubCodes = Object.keys(GLOBAL_LOGISTICS_HUBS).filter(
      code => GLOBAL_LOGISTICS_HUBS[code].region === cat.key && !excludeList.includes(code)
    );
    if (hubCodes.length === 0) return null;
    return (
      <optgroup key={cat.key} label={cat.label}>
        {hubCodes.map(code => {
          const item = GLOBAL_LOGISTICS_HUBS[code];
          const badge = item.note ? ` [${item.note}]` : item.type ? ` — ${item.type}` : '';
          return (
            <option key={code} value={code}>
              {item.flag} {code} — {item.name} ({item.stateName}){badge}
            </option>
          );
        })}
      </optgroup>
    );
  });
};

// Smart Route Sequence Pathfinder: Calculates the most realistic logistics corridor between any origin and destination
function calculateSmartRoute(startCode, endCode, hubs = GLOBAL_LOGISTICS_HUBS) {
  if (!startCode || !endCode) return startCode || endCode || '';
  if (startCode === endCode) return startCode;

  const start = hubs[startCode];
  const end = hubs[endCode];
  if (!start || !end) return `${startCode}-${endCode}`;
  if (start.custom || end.custom) return calculateCustomRoute(startCode, endCode);

  const c1 = start.coords;
  const c2 = end.coords;
  const dLat = c2[0] - c1[0];
  const dLng = c2[1] - c1[1];
  const totalDist = Math.sqrt(dLat * dLat + dLng * dLng);

  // If very close, direct non-stop path
  if (totalDist < 1.0) {
    return `${startCode}-${endCode}`;
  }

  // 1. Transatlantic: UK to US
  if (start.country === 'UK' && end.country === 'US') {
    const ukGateway = (startCode === 'LHR' || startCode === 'LGW' || startCode === 'LON') ? startCode : 'LHR';
    const usGateway = (end.coords[1] < -95) ? 'ORD' : 'JFK';
    const wps = [startCode];
    if (startCode !== ukGateway) wps.push(ukGateway);
    if (endCode !== usGateway) wps.push(usGateway);
    wps.push(endCode);
    return [...new Set(wps)].join('-');
  }

  // 2. Transatlantic: US to UK
  if (start.country === 'US' && end.country === 'UK') {
    const usGateway = (start.coords[1] < -95) ? 'ORD' : 'JFK';
    const ukGateway = (endCode === 'LHR' || endCode === 'LGW' || endCode === 'LON') ? endCode : 'LHR';
    const wps = [startCode];
    if (startCode !== usGateway) wps.push(usGateway);
    if (endCode !== ukGateway) wps.push(ukGateway);
    wps.push(endCode);
    return [...new Set(wps)].join('-');
  }

  // 3. Global International Gateways (FRA, AMS, CDG, DXB, SIN, HKG, HND)
  if (start.region === 'Global' || end.region === 'Global') {
    const isUkTarget = start.country === 'UK' || end.country === 'UK';
    const intermediate = isUkTarget ? 'LHR' : 'JFK';
    const wps = [startCode, intermediate, endCode];
    return [...new Set(wps)].join('-');
  }

  // 4. Same Country Corridor (UK-to-UK or US-to-US)
  const candidates = [];
  const minLat = Math.min(c1[0], c2[0]);
  const maxLat = Math.max(c1[0], c2[0]);
  const minLng = Math.min(c1[1], c2[1]);
  const maxLng = Math.max(c1[1], c2[1]);
  const margin = start.country === 'UK' ? 0.7 : 2.5;

  const priorityHubs = new Set([
    'EMA', 'BHX', 'MAN', 'LBA', 'EDI', 'GLA', 'BFS', 'SOU', // UK Superhubs
    'ORD', 'MEM', 'SDF', 'CVG', 'DEN', 'DFW', 'ATL', 'JFK', 'LAX', 'SEA', 'MIA', 'IND' // US Superhubs
  ]);

  for (const [code, h] of Object.entries(hubs)) {
    if (code === startCode || code === endCode) continue;
    if (h.country !== start.country) continue;

    const hc = h.coords;
    if (hc[0] >= minLat - margin && hc[0] <= maxLat + margin &&
        hc[1] >= minLng - margin && hc[1] <= maxLng + margin) {
      
      const d1 = Math.sqrt(Math.pow(hc[0] - c1[0], 2) + Math.pow(hc[1] - c1[1], 2));
      const d2 = Math.sqrt(Math.pow(c2[0] - hc[0], 2) + Math.pow(c2[1] - hc[1], 2));
      const detour = (d1 + d2) - totalDist;
      
      // Normalized projection along line (0 = start, 1 = end)
      const proj = ((hc[0] - c1[0]) * (c2[0] - c1[0]) + (hc[1] - c1[1]) * (c2[1] - c1[1])) / (totalDist * totalDist);

      const maxDetourRatio = priorityHubs.has(code) ? 0.35 : 0.18;
      if (proj > 0.15 && proj < 0.85 && detour < totalDist * maxDetourRatio) {
        candidates.push({ code, detour, proj, isPriority: priorityHubs.has(code) });
      }
    }
  }

  // Sort candidates by priority & minimum detour
  candidates.sort((a, b) => {
    if (a.isPriority && !b.isPriority) return -1;
    if (!a.isPriority && b.isPriority) return 1;
    return a.detour - b.detour;
  });

  // Pick up to 2 best spaced intermediate hubs
  const selected = [];
  for (const c of candidates) {
    if (selected.length === 0) {
      selected.push(c);
    } else {
      const prev = selected[0];
      if (Math.abs(c.proj - prev.proj) > 0.22 && selected.length < 2) {
        selected.push(c);
      }
    }
  }

  // Order waypoints from start to end by projection
  selected.sort((a, b) => a.proj - b.proj);

  const route = [startCode, ...selected.map(s => s.code), endCode];
  return route.join('-');
}

// ---------- Worldwide places (any city or address, not just the built-in hubs) ----------
const haversineKm = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
};

// Great-circle midpoint of two [lat, lng] points
const greatCircleMidpoint = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const [lat1, lng1, lat2, lng2] = [toRad(a[0]), toRad(a[1]), toRad(b[0]), toRad(b[1])];
  const bx = Math.cos(lat2) * Math.cos(lng2 - lng1);
  const by = Math.cos(lat2) * Math.sin(lng2 - lng1);
  const lat = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2));
  const lng = lng1 + Math.atan2(by, Math.cos(lat1) + bx);
  return [toDeg(lat), toDeg(lng)];
};

// Make a waypoint code (letters/digits only, no dashes) for a place that is not in the hub list
const makeCustomCode = (name, lat, lng) => {
  const letters = (name || 'LOC').toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X').slice(0, 3);
  let n = Math.abs(Math.round(lat * 10 + lng * 10)) % 10;
  let code = `X${letters}${n}`;
  while (GPS_COORDINATES[code] && GLOBAL_LOGISTICS_HUBS[code] && !GLOBAL_LOGISTICS_HUBS[code].custom) {
    n = (n + 1) % 10;
    code = `X${letters}${n}`;
  }
  return code;
};

// Make a custom place known to the map, routing and hub lookups
const registerCustomPlace = (code, place) => {
  if (!code || !place || !Array.isArray(place.coords) || place.coords.length !== 2) return;
  GLOBAL_LOGISTICS_HUBS[code] = {
    name: place.name || code,
    stateName: place.stateName || '',
    country: place.country || '',
    region: 'Custom',
    coords: place.coords,
    hub: code,
    flag: '📍',
    type: 'Custom Location',
    custom: true
  };
  GPS_COORDINATES[code] = place.coords;
};

const registerCustomPlaces = (places) => {
  if (!places || typeof places !== 'object') return;
  Object.entries(places).forEach(([code, place]) => registerCustomPlace(code, place));
};

// World-wide place lookup (OpenStreetMap data via Photon): handles partial and misspelled names
async function geocodeWorld(query, signal) {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`, { signal });
  if (!res.ok) throw new Error('Place search unavailable');
  const data = await res.json();
  const seen = new Set();
  return (data.features || []).map(f => {
    const p = f.properties || {};
    const [lng, lat] = f.geometry.coordinates;
    const streetLine = [p.housenumber, p.street].filter(Boolean).join(' ');
    const name = p.name || streetLine || p.city || p.state || p.country || query;
    const parts = [name, p.city && p.city !== name ? p.city : '', p.state, p.country].filter(Boolean);
    const label = [...new Set(parts)].join(', ');
    return { name, stateName: p.state || p.city || '', country: p.country || '', coords: [lat, lng], label };
  }).filter(r => {
    if (seen.has(r.label)) return false;
    seen.add(r.label);
    return true;
  });
}

// Route between places when at least one is a custom location: depart via the nearest big gateway,
// cross the long haul via a mid-way gateway, arrive via the gateway nearest the destination
function calculateCustomRoute(startCode, endCode) {
  const start = GLOBAL_LOGISTICS_HUBS[startCode];
  const end = GLOBAL_LOGISTICS_HUBS[endCode];
  const total = haversineKm(start.coords, end.coords);
  if (total < 150) return `${startCode}-${endCode}`;

  const majorCodes = new Set(['LHR', 'JFK', 'ORD', 'LAX', 'ATL', 'MIA', 'DFW', 'MEM', 'SDF', 'CVG', 'DEN', 'SEA', 'EMA', 'MAN']);
  const gateways = Object.entries(GLOBAL_LOGISTICS_HUBS).filter(([code, h]) =>
    !h.custom && (h.region === 'Global' || majorCodes.has(code) || /superhub/i.test(h.type || ''))
  );

  const nearestTo = (point) => {
    let best = null;
    for (const [code, h] of gateways) {
      if (code === startCode || code === endCode) continue;
      const d = haversineKm(point, h.coords);
      if (!best || d < best.d) best = { code, d, coords: h.coords };
    }
    return best;
  };

  const picks = [];
  const consider = (g, maxOffKm) => {
    if (!g || g.d > maxOffKm) return;
    // Must make progress: not behind the start and not past the destination
    if (haversineKm(start.coords, g.coords) >= total || haversineKm(g.coords, end.coords) >= total) return;
    if (picks.some(p => p.code === g.code)) return;
    picks.push(g);
  };

  consider(nearestTo(start.coords), total * 0.5);
  if (total > 4000) consider(nearestTo(greatCircleMidpoint(start.coords, end.coords)), total * 0.2);
  consider(nearestTo(end.coords), total * 0.5);

  picks.sort((a, b) => haversineKm(start.coords, a.coords) - haversineKm(start.coords, b.coords));
  return [startCode, ...picks.map(p => p.code), endCode].join('-');
}

// Free-text place search over the hub database: matches codes, names, states and countries
function searchHubs(query, limit = 8) {
  const q = (query || '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
  if (q.length < 2) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const results = [];
  for (const [code, h] of Object.entries(GLOBAL_LOGISTICS_HUBS)) {
    const name = (h.name || '').toLowerCase();
    const state = (h.stateName || '').toLowerCase();
    const country = (h.country || '').toLowerCase();
    const haystack = `${code} ${h.hub || ''} ${name} ${state} ${country} ${(h.region || '').toLowerCase()} ${(h.type || '').toLowerCase()}`.toLowerCase();
    if (!tokens.every(tok => haystack.includes(tok))) continue;

    let score = 0;
    if (code.toLowerCase() === q) score += 100;
    if (name.startsWith(q)) score += 80;
    if (name.split(/\s+/).some(w => w.startsWith(q))) score += 50;
    if (name.includes(q)) score += 30;
    if (state.includes(q)) score += 20;
    tokens.forEach(tok => {
      if (name.split(/\s+/).some(w => w.startsWith(tok))) score += 10;
    });
    results.push({ code, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(r => r.code);
}

// Type-to-search place box: suggests matching hubs and any place in the world, and hands the pick back
function PlaceSearchInput({ value, onTextChange, onPick, onPickPlace, placeholder, worldOnly = false }) {
  const [open, setOpen] = useState(false);
  const [world, setWorld] = useState([]);
  const [worldState, setWorldState] = useState('idle'); // idle | loading | error | done
  const matches = (open && !worldOnly) ? searchHubs(value) : [];

  // Look the typed text up worldwide once typing pauses
  useEffect(() => {
    const text = (value || '').trim();
    if (!open || text.length < 3) {
      setWorld([]);
      setWorldState('idle');
      return undefined;
    }
    const controller = new AbortController();
    setWorldState('loading');
    const timer = setTimeout(async () => {
      try {
        const results = await geocodeWorld(text, controller.signal);
        setWorld(results);
        setWorldState('done');
      } catch (err) {
        if (err.name !== 'AbortError') {
          setWorld([]);
          setWorldState('error');
        }
      }
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, open]);

  const rowStyle = { padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem', color: '#0F172A', borderBottom: '1px solid #F1F5F9' };
  const headStyle = { padding: '6px 12px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#64748B', background: '#F8FAFC' };
  const hover = (on) => (e) => { e.currentTarget.style.background = on ? '#F1F5F9' : '#ffffff'; };

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => { onTextChange(e.target.value); setOpen(true); }}
        onFocus={(e) => { e.target.select(); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches.length > 0) {
            e.preventDefault();
            onPick(matches[0]);
            setOpen(false);
          }
        }}
        style={{ width: '100%', boxSizing: 'border-box' }}
      />
      {open && value && value.trim().length >= 2 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px',
          background: '#ffffff', border: '1px solid #CBD5E1', borderRadius: '6px',
          boxShadow: '0 8px 24px rgba(15,23,42,0.15)', maxHeight: '340px', overflowY: 'auto'
        }}>
          {matches.length > 0 && <div style={headStyle}>Our hubs</div>}
          {matches.map(code => {
            const h = GLOBAL_LOGISTICS_HUBS[code];
            return (
              <div
                key={code}
                onMouseDown={(e) => { e.preventDefault(); onPick(code); setOpen(false); }}
                style={rowStyle}
                onMouseEnter={hover(true)}
                onMouseLeave={hover(false)}
              >
                <strong>{h.flag} {h.name}</strong>
                <span style={{ color: '#64748B' }}> ({code}){h.stateName ? `, ${h.stateName}` : ''}</span>
              </div>
            );
          })}

          <div style={headStyle}>{worldOnly ? 'Matching addresses' : 'Anywhere in the world'}</div>
          {worldState === 'loading' && <div style={{ ...rowStyle, cursor: 'default', color: '#64748B' }}>Searching the world…</div>}
          {worldState === 'error' && <div style={{ ...rowStyle, cursor: 'default', color: '#B91C1C' }}>World search is unavailable right now.</div>}
          {worldState === 'done' && world.length === 0 && <div style={{ ...rowStyle, cursor: 'default', color: '#64748B' }}>No place found. Check the spelling.</div>}
          {world.map((place, i) => (
            <div
              key={`${place.label}-${i}`}
              onMouseDown={(e) => { e.preventDefault(); onPickPlace(place); setOpen(false); }}
              style={rowStyle}
              onMouseEnter={hover(true)}
              onMouseLeave={hover(false)}
            >
              <strong>📍 {place.label}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function getInterpolatedPosition(waypoints, progressPercentage) {
  if (!waypoints || waypoints.length === 0) return [0, 0];
  if (waypoints.length === 1) return GPS_COORDINATES[waypoints[0]] || [0, 0];

  const totalSegments = waypoints.length - 1;
  const progressRatio = progressPercentage / 100;
  const exactSegment = progressRatio * totalSegments;
  const activeSegmentIndex = Math.min(Math.floor(exactSegment), totalSegments - 1);
  const segmentProgress = exactSegment - activeSegmentIndex;

  const startStop = waypoints[activeSegmentIndex];
  const endStop = waypoints[activeSegmentIndex + 1];

  const startCoords = GPS_COORDINATES[startStop];
  const endCoords = GPS_COORDINATES[endStop];

  if (!startCoords || !endCoords) return [0, 0];

  const lat = startCoords[0] + (endCoords[0] - startCoords[0]) * segmentProgress;
  const lng = startCoords[1] + (endCoords[1] - startCoords[1]) * segmentProgress;

  return [lat, lng];
}

// Small street-level map used in the admin form to confirm the delivery address
const StreetPreviewMap = ({ point }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !point) return undefined;
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, { zoomControl: true }).setView(point.coords, 17);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(mapRef.current);
    } else {
      mapRef.current.setView(point.coords, 17);
    }
    if (markerRef.current) mapRef.current.removeLayer(markerRef.current);
    markerRef.current = L.marker(point.coords).addTo(mapRef.current).bindPopup(point.label || 'Delivery address');
    setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 150);
    return undefined;
  }, [point]);

  useEffect(() => () => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
  }, []);

  if (!point) return null;
  return <div ref={containerRef} style={{ height: '220px', width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', marginTop: '10px', overflow: 'hidden' }}></div>;
};

// Subcomponents: Interactive Leaflet Map Viewer
const LeafletMap = ({ shipment, height = '350px' }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLineRef = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const markersRef = useRef([]);
  const deliveryLayersRef = useRef([]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    const originCoords = GPS_COORDINATES[shipment.originCode] || [39.8283, -98.5795];
    mapInstanceRef.current = L.map(mapContainerRef.current, {
      zoomControl: true
    }).setView(originCoords, 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    const resizeObserver = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [shipment, height]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !shipment) return;

    // Clean old markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    if (routeLineRef.current) map.removeLayer(routeLineRef.current);
    if (vehicleMarkerRef.current) map.removeLayer(vehicleMarkerRef.current);

    // Plot Route Waypoints
    const routePoints = (shipment.simulation.waypoints || []).map(code => ({
      code,
      coords: GPS_COORDINATES[code]
    })).filter(pt => pt.coords);

    const latlngs = routePoints.map(pt => pt.coords);

    // Draw routing line
    if (latlngs.length > 0) {
      routeLineRef.current = L.polyline(latlngs, {
        color: '#FF6B00',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '6, 8'
      }).addTo(map);

      // Fit map bounds to view entire route
      if (latlngs.length >= 2) {
        try {
          map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 7 });
        } catch (err) {
          // ignore bounds error
        }
      }

      // Plot Hub Pins
      routePoints.forEach((pt, index) => {
        const isEnd = index === routePoints.length - 1;
        const isStart = index === 0;
        const hubInfo = GLOBAL_LOGISTICS_HUBS[pt.code];
        const flag = hubInfo?.flag || '📍';
        const hubTitle = hubInfo 
          ? `${hubInfo.name}${hubInfo.stateName ? `, ${hubInfo.stateName}` : ''}` 
          : `${pt.code} Station`;
        const countryLabel = hubInfo?.country === 'UK' ? 'United Kingdom' : hubInfo?.country === 'US' ? 'United States' : (hubInfo?.country || 'International');
        const hubRole = isStart 
          ? 'Origin Gateway / Dispatch Checkpoint' 
          : isEnd 
            ? 'Final Destination Delivery Hub' 
            : `Active Transit Waypoint #${index + 1}`;

        const pinIcon = L.divIcon({
          html: `<div class="map-hub-pin ${isStart ? 'start' : isEnd ? 'end' : 'mid'}"><span>${pt.code}</span></div>`,
          className: 'custom-pin-container',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const popupContent = `
          <div style="font-family: 'Inter', -apple-system, sans-serif; min-width: 180px; padding: 2px;">
            <div style="font-size: 13px; font-weight: 800; color: #0F172A; display: flex; align-items: center; gap: 6px;">
              <span>${flag}</span> <span>${pt.code} — ${hubInfo ? hubInfo.name : pt.code}</span>
            </div>
            <div style="font-size: 11px; color: #64748B; margin-top: 3px;">
              ${countryLabel} ${hubInfo?.stateName ? `&bull; ${hubInfo.stateName}` : ''}
            </div>
            <div style="margin-top: 6px; padding: 4px 8px; background: #F1F5F9; border-radius: 4px; font-size: 11px; font-weight: 600; color: #0F172A;">
              <i>${hubRole}</i>
            </div>
            ${hubInfo?.type ? `<div style="margin-top: 4px; font-size: 10px; color: #FF6B00; font-weight: 700; text-transform: uppercase;">Facility: ${hubInfo.type}</div>` : ''}
          </div>
        `;

        const marker = L.marker(pt.coords, { icon: pinIcon })
          .addTo(map)
          .bindPopup(popupContent);
        markersRef.current.push(marker);
      });
    }

    // Set Vehicle Marker
    const vehiclePos = getInterpolatedPosition(shipment.simulation.waypoints, shipment.simulation.currentProgress);
    const vehicleIcon = L.divIcon({
      html: `<div class="sim-vehicle ${shipment.vessel.toLowerCase()}" style="transform: rotate(0deg);"><i class="fas fa-${shipment.vessel === 'Plane' ? 'plane' : shipment.vessel === 'Ship' ? 'ship' : 'truck'}"></i></div>`,
      className: 'custom-vehicle-container',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    vehicleMarkerRef.current = L.marker(vehiclePos, { icon: vehicleIcon })
      .addTo(map)
      .bindPopup(`<b>${shipment.id} (${shipment.vessel})</b><br/>Telemetry: ${shipment.simulation.currentProgress.toFixed(1)}% complete`);

    // Pan map to vehicle position
    map.panTo(vehiclePos);

  }, [shipment, shipment.simulation.currentProgress, shipment.simulation.waypoints]);

  // Delivery address pin + the real road route for the last stretch (drawn once per address)
  const deliveryPoint = shipment.deliveryPoint && Array.isArray(shipment.deliveryPoint.coords) ? shipment.deliveryPoint : null;
  const deliveryKey = deliveryPoint ? `${deliveryPoint.coords[0]},${deliveryPoint.coords[1]}|${(shipment.simulation.waypoints || []).slice(-1)[0]}` : '';

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return undefined;
    deliveryLayersRef.current.forEach(l => map.removeLayer(l));
    deliveryLayersRef.current = [];
    if (!deliveryPoint) return undefined;

    const pin = L.marker(deliveryPoint.coords).addTo(map)
      .bindPopup(`<b>Delivery address</b><br/>${shipment.address || deliveryPoint.label || ''}`);
    deliveryLayersRef.current.push(pin);

    const lastHub = GPS_COORDINATES[(shipment.simulation.waypoints || []).slice(-1)[0]];
    let cancelled = false;
    if (lastHub) {
      const url = `https://router.project-osrm.org/route/v1/driving/${lastHub[1]},${lastHub[0]};${deliveryPoint.coords[1]},${deliveryPoint.coords[0]}?overview=full&geometries=geojson`;
      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (cancelled || !data.routes || !data.routes[0] || !mapInstanceRef.current) return;
          const line = L.geoJSON(data.routes[0].geometry, { style: { color: '#0F172A', weight: 4, opacity: 0.85 } }).addTo(mapInstanceRef.current);
          deliveryLayersRef.current.push(line);
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [deliveryKey]);

  return (
    <div className="leaflet-map-outer-wrapper" style={{ position: 'relative', height: height, width: '100%', borderRadius: height === '100%' ? '0px' : '12px', border: height === '100%' ? 'none' : '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flex: 1 }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%', flex: 1 }}></div>
      {deliveryPoint && (
        <button
          type="button"
          onClick={() => mapInstanceRef.current && mapInstanceRef.current.setView(deliveryPoint.coords, 17)}
          style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, background: '#0F172A', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
        >
          Street view of delivery address
        </button>
      )}
    </div>
  );
};

const EmailCenterView = ({ shipments, API_BASE }) => {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [templateType, setTemplateType] = useState('CUSTOM_NOTICE');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '6px',
    background: '#1b1613',
    border: '1px solid var(--border-color, #3a322c)',
    color: '#ffffff',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const handleSelectShipment = (shipmentId) => {
    setSelectedShipmentId(shipmentId);
    if (!shipmentId) return;
    const shipment = shipments.find(s => s.id === shipmentId);
    if (shipment) {
      if (shipment.customerEmail) setRecipientEmail(shipment.customerEmail);
      if (shipment.customerName) setRecipientName(shipment.customerName);
      applyTemplate(templateType, shipment);
    }
  };

  const applyTemplate = (type, shipment = null) => {
    setTemplateType(type);
    const activeShipment = shipment || shipments.find(s => s.id === selectedShipmentId);
    const code = activeShipment?.id || '[TRACKING_CODE]';

    if (type === 'SHIPMENT_UPDATE') {
      setSubject(`Shipment Update: TXL Package #${code}`);
      setMessageBody(`Your package #${code} has been updated to "${activeShipment?.status || 'In Transit'}". Current location: ${activeShipment?.currentLocationName || activeShipment?.origin || 'Hub'}.`);
    } else if (type === 'OUT_FOR_DELIVERY') {
      setSubject(`Out for Delivery: TXL Package #${code}`);
      setMessageBody(`Great news! Your TXL package #${code} is out for final delivery today. Please ensure someone is available to receive the package.`);
    } else if (type === 'DELAY_NOTICE') {
      setSubject(`Important Notice: Update on TXL Package #${code}`);
      setMessageBody(`We wanted to notify you that shipment #${code} is experiencing a slight delay due to logistics processing. Our team is actively resolving this to deliver your package as soon as possible.`);
    } else {
      setSubject(`Notice regarding your TXL Shipment #${code}`);
      setMessageBody(`Hello,\n\nWe are writing to provide an update regarding your parcel with TXL Express Logistics.\n\nThank you for choosing TXL Services.`);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!recipientEmail || !recipientEmail.trim()) {
      setFeedback({ type: 'error', text: 'Please provide a valid recipient email address.' });
      return;
    }
    if (!messageBody || !messageBody.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a message body before sending.' });
      return;
    }

    setSending(true);
    setFeedback({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE}/admin/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: recipientEmail,
          recipientName: recipientName || recipientEmail.split('@')[0],
          subject: subject,
          messageBody: messageBody,
          templateType: templateType,
          shipmentId: selectedShipmentId
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', text: `Email dispatched successfully to ${recipientEmail}!` });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to send email.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error connecting to email dispatch server.' });
    } finally {
      setSending(false);
    }
  };

  const selectedShipment = shipments.find(s => s.id === selectedShipmentId);

  return (
    <section className="email-center-view" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail style={{ color: '#0F172A' }} /> Admin Email Dispatch Center
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0 0', fontSize: '0.9rem' }}>
            Send transactional emails & updates directly to customers via Resend API
          </p>
        </div>
        <div style={{ background: 'rgba(255, 204, 0, 0.15)', border: '1px solid #0F172A', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', color: '#0F172A', fontWeight: '700' }}>
          ✓ Resend Active: support@txlglobaltracking.com
        </div>
      </div>

      {feedback.text && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedback.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: feedback.type === 'success' ? '#4ade80' : '#f87171',
          fontWeight: '600',
          fontSize: '0.9rem'
        }}>
          {feedback.type === 'success' ? '✓ ' : 'Warning: '}{feedback.text}
        </div>
      )}

      <div className="email-center-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Left Column: Form Controls */}
        <div style={{ background: 'var(--card-bg, #2a2521)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0F172A', marginTop: 0, marginBottom: '16px' }}>
            1. Compose Email
          </h3>

          <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Link Active Shipment (Auto-Fills Customer Info)
              </label>
              <select
                value={selectedShipmentId}
                onChange={(e) => handleSelectShipment(e.target.value)}
                style={inputStyle}
              >
                <option value="" style={{ background: '#1b1613', color: '#ffffff' }}>-- None (Manual Recipient) --</option>
                {shipments.map(s => (
                  <option key={s.id} value={s.id} style={{ background: '#1b1613', color: '#ffffff' }}>
                    {s.id} - {s.customerName || 'No Name'} ({s.customerEmail || 'No Email'})
                  </option>
                ))}
              </select>
            </div>

            <div className="email-center-inputs-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Recipient Email *
                </label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Customer Name
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Preset Email Template
              </label>
              <div className="email-center-templates-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { id: 'SHIPMENT_UPDATE', label: 'Status Update' },
                  { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
                  { id: 'DELAY_NOTICE', label: 'Delay Notice' },
                  { id: 'CUSTOM_NOTICE', label: 'Custom Notice' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      border: templateType === t.id ? '1px solid #0F172A' : '1px solid var(--border-color)',
                      background: templateType === t.id ? 'rgba(255, 185, 0, 0.15)' : '#1b1613',
                      color: templateType === t.id ? '#0F172A' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Subject Line *
              </label>
              <input
                type="text"
                placeholder="Email Subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Message Content *
              </label>
              <textarea
                rows={5}
                placeholder="Write your email body message here..."
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                required
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              style={{
                marginTop: '10px',
                padding: '12px 20px',
                borderRadius: '8px',
                background: sending ? '#64748b' : 'linear-gradient(135deg, #FF6B00 0%, #B8040E 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: '800',
                fontSize: '0.95rem',
                cursor: sending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {sending ? (
                <>Sending Email via Resend...</>
              ) : (
                <>Dispatch Email Now &rarr;</>
              )}
            </button>

          </form>
        </div>

        {/* Right Column: Live Preview (Dukascopy Bank Style) */}
        <div style={{ background: 'var(--card-bg, #2a2521)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0F172A', marginTop: 0, marginBottom: '16px' }}>
            2. Live Email Preview
          </h3>

          <div style={{ background: '#eef2f5', color: '#2d3748', borderRadius: '8px', padding: '20px', fontFamily: 'Arial, Helvetica, sans-serif', border: '1px solid #cbd5e1' }}>
            
            {/* Top Logo Header */}
            <div style={{ background: '#0F172A', borderRadius: '6px 6px 0 0', padding: '14px 18px', textAlign: 'left', display: 'flex', alignItems: 'center', borderBottom: '3px solid #FF6B00' }}>
              <span style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', color: '#FF6B00', letterSpacing: '1px' }}>TXL</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A1A', marginLeft: '10px', textTransform: 'uppercase' }}>Express Logistics</span>
            </div>

            {/* Main White Card */}
            <div style={{ background: '#ffffff', borderRadius: '0 0 6px 6px', padding: '20px', marginBottom: '14px', border: '1px solid #e2e8f0', borderTop: 'none' }}>
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A1A', margin: '0 0 14px 0' }}>
                Dear {recipientName || 'Valued Customer'},
              </p>

              <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#333333', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                {messageBody || 'Your message content will render here...'}
              </div>

              {selectedShipment && (
                <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px', padding: '12px', marginBottom: '16px', fontSize: '12px' }}>
                  <div style={{ marginBottom: '4px' }}><strong>Tracking Code:</strong> <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#FF6B00' }}>{selectedShipment.id}</span></div>
                  <div style={{ marginBottom: '4px' }}><strong>Status:</strong> {selectedShipment.status}</div>
                  <div><strong>Route:</strong> {selectedShipment.origin || 'N/A'} &rarr; {selectedShipment.destination || 'N/A'}</div>
                </div>
              )}

              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <span style={{ display: 'inline-block', background: '#FF6B00', color: '#ffffff', fontWeight: '800', fontSize: '12px', padding: '8px 18px', borderRadius: '4px', textDecoration: 'none' }}>
                  Track Shipment Live &rarr;
                </span>
              </div>
            </div>

            {/* Footer Card */}
            <div style={{ background: '#ffffff', borderRadius: '6px', padding: '16px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#6c757d', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: '800', color: '#1A1A1A' }}>TXL Express Global Logistics Services</p>
              <p style={{ margin: '0 0 4px 0' }}>Website: txlglobaltracking.com</p>
              <p style={{ margin: '0', color: '#868e96' }}>Email: support@txlglobaltracking.com</p>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

const MessagesView = ({ messages, API_BASE, onMarkRead, onRefresh }) => {
  const [selectedEmail, setSelectedEmail] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [filterSearch, setFilterSearch] = useState('');

  // Group messages by customerEmail
  const conversations = React.useMemo(() => {
    const groups = {};
    (messages || []).forEach(m => {
      const email = m.customerEmail ? m.customerEmail.toLowerCase().trim() : 'unknown@txlglobaltracking.com';
      if (!groups[email]) {
        groups[email] = {
          email,
          name: m.customerName || email.split('@')[0],
          messages: [],
          unreadCount: 0,
          lastMsg: m
        };
      }
      groups[email].messages.push(m);
      if (m.sender === 'customer' && !m.read) {
        groups[email].unreadCount += 1;
      }
    });

    return Object.values(groups).sort((a, b) => {
      const timeA = new Date(a.lastMsg.createdAt || a.lastMsg.updatedAt || 0).getTime();
      const timeB = new Date(b.lastMsg.createdAt || b.lastMsg.updatedAt || 0).getTime();
      return timeB - timeA;
    });
  }, [messages]);

  useEffect(() => {
    if (conversations.length > 0 && !selectedEmail) {
      setSelectedEmail(conversations[0].email);
    }
  }, [conversations, selectedEmail]);

  useEffect(() => {
    if (!selectedEmail) return;
    const targetConv = conversations.find(c => c.email === selectedEmail);
    if (targetConv && targetConv.unreadCount > 0) {
      onMarkRead(selectedEmail);
    }
    const lastMsg = targetConv?.messages[targetConv.messages.length - 1];
    if (lastMsg && lastMsg.subject) {
      const subj = lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`;
      setReplySubject(subj);
    } else {
      setReplySubject('Re: Customer Inquiry');
    }
  }, [selectedEmail, conversations, onMarkRead]);

  const activeConv = conversations.find(c => c.email === selectedEmail);
  const sortedActiveMsgs = React.useMemo(() => {
    if (!activeConv) return [];
    return [...activeConv.messages].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  }, [activeConv]);

  const latestCustomerMsg = React.useMemo(() => {
    if (!sortedActiveMsgs.length) return null;
    const custMsgs = sortedActiveMsgs.filter(m => m.sender === 'customer');
    return custMsgs.length > 0 ? custMsgs[custMsgs.length - 1] : sortedActiveMsgs[sortedActiveMsgs.length - 1];
  }, [sortedActiveMsgs]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!selectedEmail || !replyBody.trim()) return;

    setSending(true);
    setFeedback({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE}/admin/messages/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: selectedEmail,
          customerName: activeConv?.name || selectedEmail.split('@')[0],
          subject: replySubject,
          body: replyBody.trim(),
          inReplyTo: latestCustomerMsg?.messageId || ''
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReplyBody('');
        setFeedback({
          type: 'success',
          text: data.emailSent ? 'Reply dispatched to customer via email!' : 'Reply recorded in portal.'
        });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to dispatch reply.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error connecting to messaging server.' });
    } finally {
      setSending(false);
    }
  };

  const handleSimulateInbound = async () => {
    const targetEmail = selectedEmail || 'customer@txlglobaltracking.com';
    const sampleText = prompt(`Enter test email reply message from customer (${targetEmail}):`, "Hello Support, thank you! Could you also check if signature release is available for my shipment?");
    if (!sampleText) return;

    try {
      const res = await fetch(`${API_BASE}/inbound-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${activeConv?.name || 'Customer'} <${targetEmail}>`,
          subject: `Re: Inquiry regarding TXL Package`,
          text: sampleText
        })
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', text: 'Simulated customer email reply received in inbox!' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Failed to simulate inbound email.' });
    }
  };

  const filteredConversations = conversations.filter(c => 
    c.email.toLowerCase().includes(filterSearch.toLowerCase()) || 
    c.name.toLowerCase().includes(filterSearch.toLowerCase())
  );

  return (
    <section className="messages-view" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1a202c', margin: 0 }}>Customer Support Inbox</h2>
          <p style={{ color: '#718096', fontSize: '14px', margin: '4px 0 0 0' }}>
            Real-time inbound customer inquiries & threaded email responses
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onRefresh && (
            <button
              onClick={async () => {
                setRefreshing(true);
                try {
                  await onRefresh();
                } finally {
                  setTimeout(() => setRefreshing(false), 500);
                }
              }}
              disabled={refreshing}
              style={{
                backgroundColor: '#ffffff',
                color: '#1a202c',
                fontWeight: '700',
                fontSize: '13px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e0',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <RefreshCw style={{ width: '14px', height: '14px', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Updating...' : 'Refresh Inbox'}
            </button>
          )}
          <button
            onClick={handleSimulateInbound}
            style={{
              backgroundColor: '#2b6cb0',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '13px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            + Test Inbound Reply
          </button>
        </div>
      </div>

      <div className="messages-split-grid" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', minHeight: '650px' }}>
        
        {/* Left Column: Conversation List */}
        <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #edf2f7', background: '#f8fafc' }}>
            <input 
              type="text"
              placeholder="Search conversations..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '13px', outline: 'none' }}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredConversations.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#a0aec0', fontSize: '14px' }}>
                No active support threads.
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isSelected = conv.email === selectedEmail;
                return (
                  <div
                    key={conv.email}
                    onClick={() => setSelectedEmail(conv.email)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid #edf2f7',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#edf2f7' : (conv.unreadCount > 0 ? '#fffaf0' : '#ffffff'),
                      transition: 'background 0.15s ease',
                      borderLeft: isSelected ? '4px solid #FF6B00' : '4px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#2d3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                        {conv.name}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span style={{ backgroundColor: '#e53e3e', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '10px' }}>
                          {conv.unreadCount} NEW
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px', fontFamily: 'monospace' }}>
                      {conv.email}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4a5568', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.lastMsg.body ? conv.lastMsg.body.substring(0, 45) + '...' : 'New message'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Thread & Reply Form */}
        <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeConv ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#a0aec0' }}>
              Select a conversation to view support history.
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #edf2f7', background: '#FF6B00', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>{activeConv.name}</h3>
                  <span style={{ fontSize: '12px', opacity: 0.85, fontFamily: 'monospace' }}>{activeConv.email}</span>
                </div>
                <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '4px' }}>
                  {sortedActiveMsgs.length} messages
                </span>
              </div>

              {/* Message Feed */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#f7fafc', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {sortedActiveMsgs.map((m, index) => {
                  const isAdmin = m.sender === 'admin';
                  return (
                    <div
                      key={m._id || index}
                      style={{
                        alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isAdmin ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#718096', marginBottom: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', color: isAdmin ? '#FF6B00' : '#2b6cb0' }}>
                          {isAdmin ? 'TXL Support Admin' : m.customerName}
                        </span>
                        <span>•</span>
                        <span>{new Date(m.createdAt || Date.now()).toLocaleString()}</span>
                      </div>
                      <div
                        style={{
                          background: isAdmin ? '#FF6B00' : '#ffffff',
                          color: isAdmin ? '#ffffff' : '#1A1A1A',
                          padding: '14px 16px',
                          borderRadius: isAdmin ? '12px 12px 0 12px' : '12px 12px 12px 0',
                          border: isAdmin ? '1px solid #B8040E' : '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {m.subject && (
                          <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '6px', opacity: 0.9, borderBottom: isAdmin ? '1px solid rgba(255,255,255,0.2)' : '1px solid #edf2f7', paddingBottom: '4px' }}>
                            {m.subject}
                          </div>
                        )}
                        {m.body}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <div style={{ padding: '16px', borderTop: '1px solid #edf2f7', background: '#ffffff' }}>
                {feedback.text && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    marginBottom: '12px',
                    fontSize: '13px',
                    backgroundColor: feedback.type === 'error' ? '#fff5f5' : '#f0fff4',
                    color: feedback.type === 'error' ? '#c53030' : '#276749',
                    border: `1px solid ${feedback.type === 'error' ? '#feb2b2' : '#9ae6b4'}`
                  }}>
                    {feedback.text}
                  </div>
                )}

                <form onSubmit={handleSendReply} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input 
                    type="text"
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    placeholder="Subject..."
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e0', fontSize: '13px', outline: 'none' }}
                  />
                  <textarea 
                    rows="3"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type your response to client..."
                    style={{ padding: '10px 12px', borderRadius: '4px', border: '1px solid #cbd5e0', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={sending || !replyBody.trim()}
                      style={{
                        backgroundColor: '#FF6B00',
                        color: '#ffffff',
                        fontWeight: '700',
                        fontSize: '14px',
                        padding: '10px 24px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: (sending || !replyBody.trim()) ? 'not-allowed' : 'pointer',
                        opacity: (sending || !replyBody.trim()) ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {sending ? 'Sending Reply...' : 'Send Email Reply →'}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>

      </div>
    </section>
  );
};

const CustomerChatView = ({ user, insiteMessages, API_BASE, onRefresh }) => {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef(null);

  const userEmail = (user?.email || '').toLowerCase().trim();
  const thread = React.useMemo(() => {
    return (insiteMessages || [])
      .filter(m => (m.customerEmail || '').toLowerCase().trim() === userEmail)
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  }, [insiteMessages, userEmail]);

  // Mark admin messages as read when customer views the tab
  useEffect(() => {
    if (!userEmail) return;
    const hasUnread = thread.some(m => m.sender === 'admin' && !m.read);
    if (hasUnread) {
      fetch(`${API_BASE}/insite-messages/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail: userEmail, reader: 'customer' })
      }).catch(err => console.error('Error marking in-site read:', err));
    }
  }, [thread, userEmail, API_BASE]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  const handleSend = async (textToSend) => {
    const text = (typeof textToSend === 'string' ? textToSend : inputText).trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/insite-messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: userEmail,
          customerName: user?.name || userEmail.split('@')[0],
          body: text,
          sender: 'customer'
        })
      });
      if (res.ok) {
        setInputText('');
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error sending in-site message:', err);
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = [
    "What is the current status of my shipment?",
    "Need assistance with customs clearance documents",
    "Can I request a delivery appointment time?",
    "Please update my delivery address"
  ];

  return (
    <section className="customer-chat-view" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2521 100%)',
        border: '1px solid #3a322c',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#0F172A',
            color: '#FF6B00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '900',
            fontSize: '18px',
            boxShadow: '0 2px 8px rgba(255, 204, 0, 0.3)'
          }}>TXL</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                Logistics Support Chat
              </h2>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
                Online
              </span>
            </div>
            <p style={{ color: '#a0aec0', fontSize: '13px', margin: '4px 0 0 0' }}>
              Chat directly with our central operations dispatch team in real-time.
            </p>
          </div>
        </div>

        <button
          onClick={async () => {
            setRefreshing(true);
            try {
              if (onRefresh) await onRefresh();
            } finally {
              setTimeout(() => setRefreshing(false), 400);
            }
          }}
          disabled={refreshing}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: '#cbd5e1',
            fontWeight: '600',
            fontSize: '12px',
            padding: '8px 14px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw style={{ width: '13px', height: '13px', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Syncing...' : 'Sync Chat'}
        </button>
      </div>

      {/* Main Chat Container */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        height: '620px',
        overflow: 'hidden'
      }}>
        {/* Messages Scroll Area */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          backgroundColor: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {thread.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              textAlign: 'center',
              padding: '20px'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#fff4cc',
                color: '#b7791f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <MessageCircle size={30} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c', margin: '0 0 6px 0' }}>
                Welcome to TXL Direct Support
              </h3>
              <p style={{ color: '#718096', fontSize: '14px', maxWidth: '420px', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                Send a message below to connect directly with a TXL logistics specialist. We can assist with tracking, customs, or delivery instructions.
              </p>

              {/* Quick Prompts */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '520px' }}>
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e0',
                      borderRadius: '20px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      color: '#2d3748',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#FF6B00';
                      e.currentTarget.style.color = '#FF6B00';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#cbd5e0';
                      e.currentTarget.style.color = '#2d3748';
                    }}
                  >
                    💬 {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            thread.map((m, idx) => {
              const isMe = m.sender === 'customer';
              return (
                <div
                  key={m._id || idx}
                  style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    fontSize: '11px',
                    color: '#718096',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontWeight: '700', color: isMe ? '#2d3748' : '#FF6B00' }}>
                      {isMe ? 'You' : 'TXL Support Agent'}
                    </span>
                    <span>•</span>
                    <span>{new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div style={{
                    backgroundColor: isMe ? '#FF6B00' : '#ffffff',
                    color: isMe ? '#ffffff' : '#1a202c',
                    padding: '12px 18px',
                    borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    border: isMe ? '1px solid #B8040E' : '1px solid #e2e8f0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {m.body}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #edf2f7',
          backgroundColor: '#ffffff'
        }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
          >
            <input
              type="text"
              placeholder="Type your message to TXL Support... (Press Enter to send)"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={sending}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e0',
                fontSize: '14px',
                outline: 'none',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)'
              }}
            />
            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              style={{
                backgroundColor: '#FF6B00',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                padding: '12px 22px',
                borderRadius: '8px',
                border: 'none',
                cursor: (sending || !inputText.trim()) ? 'not-allowed' : 'pointer',
                opacity: (sending || !inputText.trim()) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.15s ease'
              }}
            >
              <Send size={16} />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

const AdminInsiteChatView = ({ insiteMessages, API_BASE, onRefresh }) => {
  const [selectedEmail, setSelectedEmail] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const messagesEndRef = useRef(null);

  // Group in-site messages by customerEmail
  const conversations = React.useMemo(() => {
    const groups = {};
    (insiteMessages || []).forEach(m => {
      const email = (m.customerEmail || 'unknown@txlglobaltracking.com').toLowerCase().trim();
      if (!groups[email]) {
        groups[email] = {
          email,
          name: (m.sender === 'customer' && m.customerName) ? m.customerName : email.split('@')[0],
          messages: [],
          unreadCount: 0,
          lastMsg: m
        };
      }
      if (m.sender === 'customer' && m.customerName && groups[email].name === email.split('@')[0]) {
        groups[email].name = m.customerName;
      }
      groups[email].messages.push(m);
      if (m.sender === 'customer' && !m.read) {
        groups[email].unreadCount += 1;
      }
      const existingTime = new Date(groups[email].lastMsg.createdAt || 0).getTime();
      const thisTime = new Date(m.createdAt || 0).getTime();
      if (thisTime > existingTime) {
        groups[email].lastMsg = m;
      }
    });

    return Object.values(groups).sort((a, b) => {
      const timeA = new Date(a.lastMsg.createdAt || 0).getTime();
      const timeB = new Date(b.lastMsg.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [insiteMessages]);

  useEffect(() => {
    if (conversations.length > 0 && !selectedEmail) {
      setSelectedEmail(conversations[0].email);
    }
  }, [conversations, selectedEmail]);

  // Mark customer messages as read when admin selects customer
  useEffect(() => {
    if (!selectedEmail) return;
    const target = conversations.find(c => c.email === selectedEmail);
    if (target && target.unreadCount > 0) {
      fetch(`${API_BASE}/insite-messages/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail: selectedEmail, reader: 'admin' })
      }).catch(err => console.error('Error marking in-site read:', err));
    }
  }, [selectedEmail, conversations, API_BASE]);

  const activeConv = conversations.find(c => c.email === selectedEmail);
  const activeMessages = React.useMemo(() => {
    if (!activeConv) return [];
    return [...activeConv.messages].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const handleSendReply = async (textToSend) => {
    const body = (typeof textToSend === 'string' ? textToSend : replyText).trim();
    if (!selectedEmail || !body || sending) return;

    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/insite-messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: selectedEmail,
          customerName: 'TXL Logistics Support',
          body,
          sender: 'admin'
        })
      });
      if (res.ok) {
        setReplyText('');
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error sending in-site reply:', err);
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(c => 
    c.email.toLowerCase().includes(filterSearch.toLowerCase()) || 
    c.name.toLowerCase().includes(filterSearch.toLowerCase())
  );

  const quickReplies = [
    "Hello! We are currently checking your shipment status with dispatch.",
    "Your shipment has cleared customs and is on schedule.",
    "Delivery is scheduled for today before 6:00 PM.",
    "Please provide an alternative recipient phone number."
  ];

  return (
    <section className="admin-insite-messages-view" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1a202c', margin: 0 }}>
              In-Site Customer Chat
            </h2>
            <span style={{
              backgroundColor: '#0F172A',
              color: '#000000',
              fontSize: '11px',
              fontWeight: '800',
              padding: '2px 8px',
              borderRadius: '4px',
              letterSpacing: '0.5px'
            }}>
              LIVE PORTAL
            </span>
          </div>
          <p style={{ color: '#718096', fontSize: '14px', margin: '4px 0 0 0' }}>
            Real-time direct messaging with registered portal customers (distinct from inbound emails)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onRefresh && (
            <button
              onClick={async () => {
                setRefreshing(true);
                try {
                  await onRefresh();
                } finally {
                  setTimeout(() => setRefreshing(false), 500);
                }
              }}
              disabled={refreshing}
              style={{
                backgroundColor: '#ffffff',
                color: '#1a202c',
                fontWeight: '700',
                fontSize: '13px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e0',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <RefreshCw style={{ width: '14px', height: '14px', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Updating...' : 'Refresh Chats'}
            </button>
          )}
        </div>
      </div>

      <div className="messages-split-grid" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', minHeight: '650px' }}>
        {/* Left Column: Customer Conversations */}
        <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #edf2f7', background: '#f8fafc' }}>
            <input 
              type="text"
              placeholder="Search customers..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '13px', outline: 'none' }}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredConversations.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#a0aec0', fontSize: '14px' }}>
                No in-site chat conversations yet.
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isSelected = conv.email === selectedEmail;
                return (
                  <div
                    key={conv.email}
                    onClick={() => setSelectedEmail(conv.email)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid #edf2f7',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#edf2f7' : (conv.unreadCount > 0 ? '#fffaf0' : '#ffffff'),
                      transition: 'background 0.15s ease',
                      borderLeft: isSelected ? '4px solid #FF6B00' : '4px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#2d3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                        {conv.name}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span style={{ backgroundColor: '#FF6B00', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '10px' }}>
                          {conv.unreadCount} NEW
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px', fontFamily: 'monospace' }}>
                      {conv.email}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4a5568', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.lastMsg.body ? conv.lastMsg.body.substring(0, 45) + '...' : 'Message received'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Feed & Reply Form */}
        <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeConv ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#a0aec0' }}>
              Select a customer from the left to view live chat.
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #edf2f7',
                background: '#1a1a1a',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
                    {activeConv.name}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                    {activeConv.email}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '4px' }}>
                    {activeMessages.length} messages
                  </span>
                </div>
              </div>

              {/* Message Feed */}
              <div style={{
                flex: 1,
                padding: '20px',
                overflowY: 'auto',
                background: '#f7fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                {activeMessages.map((m, index) => {
                  const isAdmin = m.sender === 'admin';
                  return (
                    <div
                      key={m._id || index}
                      style={{
                        alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isAdmin ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#718096', marginBottom: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', color: isAdmin ? '#FF6B00' : '#2b6cb0' }}>
                          {isAdmin ? 'TXL Logistics Support (You)' : (m.customerName || activeConv.name)}
                        </span>
                        <span>•</span>
                        <span>{new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        style={{
                          background: isAdmin ? '#FF6B00' : '#ffffff',
                          color: isAdmin ? '#ffffff' : '#1A1A1A',
                          padding: '12px 16px',
                          borderRadius: isAdmin ? '12px 12px 0 12px' : '12px 12px 12px 0',
                          border: isAdmin ? '1px solid #B8040E' : '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {m.body}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Section */}
              <div style={{ padding: '16px', borderTop: '1px solid #edf2f7', background: '#ffffff' }}>
                {/* Quick canned replies */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {quickReplies.map((qr, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendReply(qr)}
                      style={{
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      + {qr}
                    </button>
                  ))}
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleSendReply(); }} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${activeConv.name} via portal chat...`}
                    disabled={sending}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '14px', outline: 'none' }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    style={{
                      backgroundColor: '#FF6B00',
                      color: '#ffffff',
                      fontWeight: '700',
                      fontSize: '14px',
                      padding: '10px 22px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: (sending || !replyText.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (sending || !replyText.trim()) ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Send size={15} />
                    {sending ? 'Sending...' : 'Send Reply'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};


const getValidSession = () => {
  try {
    const savedStr = localStorage.getItem('txl_user') || localStorage.getItem('ups_user');
    if (!savedStr) return null;
    const saved = JSON.parse(savedStr);
    if (!saved.token) {
      localStorage.removeItem('txl_user');
      localStorage.removeItem('ups_user');
      return null;
    }

    // Persist active session across browser refreshes for 7 days (7 * 24 * 60 * 60 * 1000 ms)
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (saved.loginTimestamp && (Date.now() - saved.loginTimestamp > SEVEN_DAYS_MS)) {
      localStorage.removeItem('txl_user');
      localStorage.removeItem('ups_user');
      return null;
    }

    return saved;
  } catch (e) {
    localStorage.removeItem('txl_user');
    localStorage.removeItem('ups_user');
    return null;
  }
};

export default function App() {
  const [user, setUser] = useState(() => getValidSession());
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const [activeTab, setActiveTab] = useState('home');
  const [shipments, setShipments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [insiteMessages, setInsiteMessages] = useState([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Email messages unread count for admin
  const unreadCount = messages.filter(m => m.sender === 'customer' && !m.read).length;

  // In-site chat unread counts
  const adminInsiteUnreadCount = insiteMessages.filter(m => m.sender === 'customer' && !m.read).length;
  const customerInsiteUnreadCount = (user && user.role === 'customer')
    ? insiteMessages.filter(m => (m.customerEmail || '').toLowerCase().trim() === (user.email || '').toLowerCase().trim() && m.sender === 'admin' && !m.read).length
    : 0;

  const fetchMessages = () => {
    if (user && user.role === 'admin') {
      fetch(`${API_BASE}/messages`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setMessages(Array.isArray(data) ? data : []))
        .catch(err => console.error('Error fetching messages:', err));
    }
  };

  const fetchInsiteMessages = () => {
    if (!user) return;
    const url = user.role === 'admin'
      ? `${API_BASE}/insite-messages`
      : `${API_BASE}/insite-messages?email=${encodeURIComponent(user.email || '')}`;
    fetch(url)
      .then(res => res.ok ? res.json() : [])
      .then(data => setInsiteMessages(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error fetching in-site messages:', err));
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 6000);
    return () => clearInterval(interval);
  }, [user, activeTab]);

  useEffect(() => {
    if (user) {
      fetchInsiteMessages();
      const interval = setInterval(fetchInsiteMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [user, activeTab]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [activeTab]);

  // Transition Flash Navigator
  const triggerNavigationWithFlash = (targetHash) => {
    setIsFlashing(true);
    setTimeout(() => {
      window.location.hash = targetHash;
    }, 250);
    setTimeout(() => {
      setIsFlashing(false);
    }, 750);
  };
  const [stats, setStats] = useState(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);
  
  // Login Form States
  const [loginTrackingId, setLoginTrackingId] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Shipping Form States
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerEmail, setFormCustomerEmail] = useState('');
  const [formCountryCode, setFormCountryCode] = useState('+1');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formDeliveryPoint, setFormDeliveryPoint] = useState(null);
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [formUploadedImage, setFormUploadedImage] = useState(null);
  const [formWeight, setFormWeight] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formVessel, setFormVessel] = useState('Truck');
  const [formOriginCode, setFormOriginCode] = useState('LHR');
  const [formDestCode, setFormDestCode] = useState('EDI');
  const [formOrigin, setFormOrigin] = useState(formatHubLocationText('LHR'));
  const [formDestination, setFormDestination] = useState(formatHubLocationText('EDI'));
  const [formEta, setFormEta] = useState('2026-07-25');
  const [formRouteConfig, setFormRouteConfig] = useState('LHR-EMA-MAN-EDI');
  const [formMsg, setFormMsg] = useState({ type: '', text: '' });
  const [formTrackingId, setFormTrackingId] = useState(`TXL-${Math.floor(10000000 + Math.random() * 90000000)}`);
  const [formShipmentType, setFormShipmentType] = useState('Standard');
  const [formInitialStatus, setFormInitialStatus] = useState('Manifest Prepared');
  const [formInternalNotes, setFormInternalNotes] = useState('');
  const [credentialsModal, setCredentialsModal] = useState(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [photoPreviewModal, setPhotoPreviewModal] = useState(null);
  const [showCustomerTrackPrompt, setShowCustomerTrackPrompt] = useState(false);
  const [customerTrackInput, setCustomerTrackInput] = useState('');
  const [trackPromptError, setTrackPromptError] = useState('');

  // Visitor Quick Tracking Modal States

  // Tracking Search
  const [searchTrackId, setSearchTrackId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Live simulator controls (for active admin telemetry toggles)
  const [simActiveShipmentId, setSimActiveShipmentId] = useState('');
  const [simSpeed, setSimSpeed] = useState(2);
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [simMode, setSimMode] = useState('realtime'); // 'realtime' (autonomous 24/7 background schedule) or 'manual' (speed slider demo)
  const [simDurationDays, setSimDurationDays] = useState(7); // default 7 days = 1 week
  const [simCustomVal, setSimCustomVal] = useState('7');
  const [simCustomUnit, setSimCustomUnit] = useState('days'); // 'days' or 'hours'
  const [simAutoSyncEta, setSimAutoSyncEta] = useState(true);
  const [liveClockTick, setLiveClockTick] = useState(0);

  // 1-second live clock ticker to keep remaining time countdown ticking smoothly
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setLiveClockTick(t => t + 1);
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const shipmentsRef = useRef(shipments);
  useEffect(() => {
    shipmentsRef.current = shipments;
  }, [shipments]);

  const simActiveShipmentIdRef = useRef(simActiveShipmentId);
  useEffect(() => {
    simActiveShipmentIdRef.current = simActiveShipmentId;
  }, [simActiveShipmentId]);

  const simSpeedRef = useRef(simSpeed);
  useEffect(() => {
    simSpeedRef.current = simSpeed;
  }, [simSpeed]);

  const simIntervalRef = useRef(null);

  // Sync hash routing
  useEffect(() => {
    const handleHash = () => {
      const rawHash = window.location.hash || '#home';
      window.scrollTo(0, 0);

      const currentUser = userRef.current || user || getValidSession();

      const targetTab = rawHash.startsWith('#details?id=') ? 'details' : rawHash.replace('#', '');
      
      if (targetTab === 'home' || !rawHash || rawHash === '#home') {
        setActiveTab('home');
        return;
      }

      // Protected route check
      if (!currentUser && ['admin', 'dashboard', 'appointment', 'email-center', 'messages', 'insite-messages', 'customer-messages'].includes(targetTab)) {
        setActiveTab('home');
        if (window.location.hash !== '#home') {
          window.location.hash = '#home';
        }
        return;
      }

      if (rawHash.startsWith('#details?id=')) {
        const id = rawHash.split('=')[1];
        setSelectedShipmentId(id);
      }

      setActiveTab(targetTab || 'home');
    };

    window.addEventListener('hashchange', handleHash);
    handleHash();

    return () => window.removeEventListener('hashchange', handleHash);
  }, [user]);

  // Auto-fetch targeted shipment if opened via direct email link
  useEffect(() => {
    if (!selectedShipmentId) return;
    const exists = shipments.some(s => s.id.toUpperCase() === selectedShipmentId.toUpperCase());
    if (!exists) {
      fetch(`${API_BASE}/shipments/${selectedShipmentId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.id) {
            setShipments(prev => {
              if (prev.some(s => s.id.toUpperCase() === data.id.toUpperCase())) return prev;
              return [data, ...prev];
            });
          }
        })
        .catch(err => console.error('Error fetching direct link shipment:', err));
    }
  }, [selectedShipmentId]);

  // Fetch initial core shipments / data
  const fetchShipments = async () => {
    try {
      if (!user) return;
      const res = await fetch(`${API_BASE}/shipments`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setShipments(data);
      }
      
      // Auto-set simulator target if empty
      if (Array.isArray(data) && data.length > 0 && !simActiveShipmentId) {
        setSimActiveShipmentId(data[0].id);
      }
    } catch (e) {
      console.error('Fetch shipments failed:', e);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [user]);

  const fetchStats = async () => {
    if (!user || user.role !== 'admin') return;
    try {
      const res = await fetch(`${API_BASE}/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Fetch stats failed:', e);
    }
  };

  useEffect(() => {
    fetchShipments();
    fetchStats();
  }, [user]);

  // WebSocket Telemetry Connection Link
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWS = () => {
      const token = (userRef.current && userRef.current.token) || '';
      ws = new WebSocket(token ? `${WS_BASE}?token=${encodeURIComponent(token)}` : WS_BASE);

      ws.onopen = () => {
        console.log('Connected to real-time telemetry Socket channel.');
        if (selectedShipmentId) ws.send(JSON.stringify({ type: 'SUBSCRIBE', id: selectedShipmentId }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'SHIPMENT_UPDATE') {
            const updated = msg.payload;
            
            // Sync live lists
            setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
            
            // If viewing this shipment map, update state
            if (selectedShipmentId && selectedShipmentId.toUpperCase() === updated.id.toUpperCase()) {
              setSelectedShipmentId(updated.id);
            }
          } else if (msg.type === 'SHIPMENT_DELETED') {
            const { id } = msg.payload;
            setShipments(prev => prev.filter(s => s.id !== id));
            if (selectedShipmentId && selectedShipmentId.toUpperCase() === id.toUpperCase()) {
              setSelectedShipmentId(null);
              if (window.location.hash.startsWith('#details?id=')) {
                window.location.hash = user && user.role === 'admin' ? '#admin' : '#dashboard';
              }
            }
          } else if (msg.type === 'NEW_MESSAGE') {
            const newMsg = msg.payload;
            setMessages(prev => {
              const exists = prev.some(m => m._id === newMsg._id);
              if (exists) return prev;
              return [newMsg, ...prev];
            });
          } else if (msg.type === 'NEW_INSITE_MESSAGE') {
            const newMsg = msg.payload;
            setInsiteMessages(prev => {
              const exists = prev.some(m => m._id === newMsg._id);
              if (exists) return prev;
              const currentUsr = userRef.current;
              if (currentUsr && currentUsr.role === 'customer') {
                const myEmail = (currentUsr.email || '').toLowerCase().trim();
                const targetEmail = (newMsg.customerEmail || '').toLowerCase().trim();
                if (myEmail && targetEmail && myEmail !== targetEmail) {
                  return prev;
                }
              }
              return [...prev, newMsg];
            });
          } else if (msg.type === 'INSITE_MESSAGES_READ') {
            const { customerEmail, reader } = msg.payload || {};
            const targetSender = reader === 'customer' ? 'admin' : 'customer';
            setInsiteMessages(prev => prev.map(m => {
              if ((m.customerEmail || '').toLowerCase().trim() === (customerEmail || '').toLowerCase().trim() && m.sender === targetSender) {
                return { ...m, read: true };
              }
              return m;
            }));
          }
        } catch (error) {
          console.warn('Socket message parse error:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected. Attempting reconnect...');
        reconnectTimeout = setTimeout(connectWS, 3000);
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [selectedShipmentId, user]);

  // 1. User login trigger
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginTrackingId.trim()) return;

    try {
      setLoggingIn(true);
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingId: loginTrackingId.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Login authorization fail.');
      } else {
        const sessionData = {
          ...data,
          loginTimestamp: Date.now()
        };
        localStorage.setItem('txl_user', JSON.stringify(sessionData));
        setUser(sessionData);
        userRef.current = sessionData;

        const targetTab = data.role === 'admin' ? 'admin' : 'dashboard';
        setActiveTab(targetTab);
        window.location.hash = `#${targetTab}`;
      }
    } catch (err) {
      setLoginError('Could not link to backend server.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('txl_user');
    localStorage.removeItem('ups_user');
    setUser(null);
    userRef.current = null;
    setActiveTab('home');
    window.location.hash = '#home';
  };

  // 3. Admin shipping appointment creation
  const handleCreateShipment = async (e) => {
    e.preventDefault();
    setFormMsg({ type: '', text: '' });

    if (!formCustomerEmail || !formCustomerName || !formOrigin || !formDestination) {
      setFormMsg({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }

    const waypointsArray = formRouteConfig.split('-');

    const shipmentPayload = {
      id: formTrackingId,
      customerName: formCustomerName,
      customerEmail: formCustomerEmail,
      customerPhone: formCustomerPhone ? `${formCountryCode} ${formCustomerPhone}`.trim() : '+1 555 0100',
      address: formAddress || 'Warehouse facility D',
      deliveryPoint: formDeliveryPoint,
      weight: parseFloat(formWeight) || 500,
      desc: formDesc || 'Commercial freight cargo items',
      vessel: formVessel,
      origin: formOrigin,
      destination: formDestination,
      originCode: formOriginCode,
      destCode: formDestCode,
      eta: formEta,
      waypoints: waypointsArray,
      customPlaces: Object.fromEntries(
        [...new Set([formOriginCode, formDestCode, ...waypointsArray])]
          .filter(code => GLOBAL_LOGISTICS_HUBS[code] && GLOBAL_LOGISTICS_HUBS[code].custom)
          .map(code => {
            const h = GLOBAL_LOGISTICS_HUBS[code];
            return [code, { name: h.name, stateName: h.stateName, country: h.country, coords: h.coords }];
          })
      ),
      packageImage: formUploadedImage?.base64 || '',
      internalNotes: formInternalNotes || ''
    };

    try {
      const res = await fetch(`${API_BASE}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentPayload)
      });
      const data = await res.json();

      if (res.ok) {
        setFormMsg({ type: 'success', text: `Appointment made! Code: ${data.id}` });
        if (data.credentials) {
          setCredentialsModal(data.credentials);
        }
        // Clear input form
        setFormCustomerName('');
        setFormCustomerEmail('');
        setFormCountryCode('+1');
        setFormCustomerPhone('');
        setFormAddress('');
        setFormDeliveryPoint(null);
        setFormUploadedImage(null);
        setFormWeight('');
        setFormDesc('');
        setFormTrackingId(`TXL-${Math.floor(10000000 + Math.random() * 90000000)}`);
        setFormInternalNotes('');
        fetchShipments();
        fetchStats();
      } else {
        setFormMsg({ type: 'error', text: data.error || 'Server rejected creation.' });
      }
    } catch (err) {
      setFormMsg({ type: 'error', text: 'Network connection write failure.' });
    }
  };

  const processImageFile = (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        // Compress and scale down to max 1280px dimension to ensure instant upload and email compatibility
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.84);
        const approxBytes = Math.round(compressedDataUrl.length * 0.75);
        const formattedSize = approxBytes > 1024 * 1024 
          ? `${(approxBytes / (1024 * 1024)).toFixed(1)} MB` 
          : `${Math.round(approxBytes / 1024)} KB`;

        setFormUploadedImage({
          name: file.name,
          size: formattedSize,
          base64: compressedDataUrl
        });
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  };

  const openEditShipment = (s) => setEditForm({
    id: s.id,
    customerName: s.customerName || '',
    customerEmail: s.customerEmail || '',
    customerPhone: s.customerPhone || '',
    address: s.address || '',
    weight: s.weight ?? '',
    desc: s.desc || '',
    vessel: s.vessel || 'Truck',
    origin: s.origin || '',
    destination: s.destination || '',
    eta: s.eta || '',
    status: s.status || 'Registered',
    internalNotes: s.internalNotes || ''
  });

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm) return;
    setEditSaving(true);
    try {
      const { id, ...payload } = editForm;
      const res = await fetch(`${API_BASE}/shipments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Could not save changes.');
        return;
      }
      setShipments(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
      setEditForm(null);
      fetchStats();
    } catch (err) {
      alert('Could not reach the server.');
    } finally {
      setEditSaving(false);
    }
  };

  // Add or replace the package photo of an existing shipment
  const handleReplacePhoto = (shipment, file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Please choose a valid image file (PNG, JPG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = async () => {
        const maxDim = 1280;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        const sendEmail = window.confirm(`Save this photo for #${shipment.id}.\n\nAlso email it to ${shipment.customerEmail}?`);
        try {
          const res = await fetch(`${API_BASE}/shipments/${shipment.id}/image`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ packageImage: dataUrl, sendEmail })
          });
          const data = await res.json();
          if (!res.ok) {
            alert(data.error || 'Could not save the photo.');
            return;
          }
          setShipments(prev => prev.map(s => s.id === shipment.id ? { ...s, packageImage: dataUrl } : s));
          alert(sendEmail ? (data.emailSent ? 'Photo saved and emailed to the customer.' : `Photo saved, but the email failed: ${data.emailError || 'unknown error'}`) : 'Photo saved.');
        } catch (err) {
          alert('Could not reach the server.');
        }
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) processImageFile(file);
  };

  const handleUpdateSimShipmentVessel = async (newVessel) => {
    if (!simActiveShipmentId) return;
    const shipment = shipments.find(s => s.id === simActiveShipmentId);
    if (!shipment) return;
    try {
      const res = await fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vessel: newVessel,
          status: shipment.status,
          currentLocationName: shipment.currentLocationName,
          simulation: {
            active: simIntervalRef.current !== null,
            currentProgress: shipment.simulation.currentProgress,
            logs: shipment.simulation.logs
          }
        })
      });
      if (res.ok) {
        fetchShipments();
      }
    } catch (e) {
      console.warn("Vessel update error:", e);
    }
  };

  const handleUpdateSimSpeed = async (newSpeed) => {
    setSimSpeed(newSpeed);
    if (!simActiveShipmentId) return;
    try {
      const res = await fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation: {
            speedMultiplier: newSpeed
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShipments(prev => prev.map(s => s.id === data.id ? data : s));
      }
    } catch (e) {
      console.warn("Speed multiplier update failed:", e);
    }
  };

  const handleAddWaypoint = async (newWp) => {
    if (!simActiveShipmentId) return;
    const shipment = shipments.find(s => s.id === simActiveShipmentId);
    if (!shipment) return;

    let wps = [...(shipment.simulation.waypoints || [])];
    if (wps.length > 1) {
      wps.splice(wps.length - 1, 0, newWp);
    } else {
      wps.push(newWp);
    }

    try {
      const res = await fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation: {
            waypoints: wps
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShipments(prev => prev.map(s => s.id === data.id ? data : s));
      }
    } catch (e) {
      console.warn("Add waypoint failed:", e);
    }
  };

  const handleRemoveWaypoint = async (wpToRemove) => {
    if (!simActiveShipmentId) return;
    const shipment = shipments.find(s => s.id === simActiveShipmentId);
    if (!shipment) return;

    let wps = (shipment.simulation.waypoints || []).filter(wp => wp !== wpToRemove);
    if (wps.length === 0) {
      wps = [shipment.originCode || 'CHI'];
    }

    try {
      const res = await fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation: {
            waypoints: wps
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShipments(prev => prev.map(s => s.id === data.id ? data : s));
      }
    } catch (e) {
      console.warn("Remove waypoint failed:", e);
    }
  };

  // 4. Simulator Loop handlers
  const updateSimTelemetry = async (shipmentId, deltaProgress, forceLog) => {
    const shipment = shipmentsRef.current.find(s => s.id === shipmentId);
    if (!shipment) return;

    let newProgress = shipment.simulation.currentProgress + deltaProgress;
    if (newProgress > 100) newProgress = 100;
    if (newProgress < 0) newProgress = 0;

    // Compute status milestone
    let newStatus = shipment.status;
    let newLoc = shipment.currentLocationName;
    let newLog = forceLog || shipment.simulation.logs;

    if (newProgress === 0) {
      newStatus = 'Registered';
      newLoc = `Scheduled for departure at ${shipment.origin}`;
      newLog = 'Shipment details registered in terminal system database.';
    } else if (newProgress > 0 && newProgress < 30) {
      newStatus = 'Warehouse';
      newLoc = `Sorting at global distribution center ${shipment.simulation.waypoints[0] || shipment.origin}`;
      newLog = 'Passed gate check scanner; scheduled for line haul departure.';
    } else if (newProgress >= 30 && newProgress < 85) {
      newStatus = 'In Transit';
      newLoc = `En-route via ${shipment.vessel} to ${shipment.destination}`;
      if (!forceLog) {
        newLog = `Telemetry logs active. Speed multiplier: ${simSpeedRef.current}x. Vehicle coordinate shift update registered.`;
      }
    } else if (newProgress >= 85 && newProgress < 100) {
      newStatus = 'Out for Delivery';
      newLoc = `Final dispatch facility near ${shipment.simulation.waypoints[shipment.simulation.waypoints.length - 1] || shipment.destination}`;
      newLog = 'Sorted to local delivery truck. Expected to arrive today.';
    } else if (newProgress >= 100) {
      newStatus = 'Delivered';
      newLoc = `Arrived at recipient base address: ${shipment.address}`;
      newLog = 'Delivered safely. Certified signature uploaded.';
    }

    try {
      const res = await fetch(`${API_BASE}/shipments/${shipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          currentLocationName: newLoc,
          simulation: {
            active: simIntervalRef.current !== null,
            currentProgress: newProgress,
            logs: newLog
          }
        })
      });
      const data = await res.json();
      setShipments(prev => prev.map(s => s.id === data.id ? data : s));
    } catch (e) {
      console.error('Server sync telemetry failed:', e);
    }
  };

  const handleStartSim = async () => {
    if (!simActiveShipmentId) return;
    const shipment = shipmentsRef.current.find(s => s.id === simActiveShipmentId);
    if (!shipment) return;

    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    if (simMode === 'realtime') {
      // 24/7 Autonomous background simulation over calendar days
      const days = parseFloat(simDurationDays) || 7;
      const now = new Date();
      const currentProg = (shipment.simulation && typeof shipment.simulation.currentProgress === 'number')
        ? (shipment.simulation.currentProgress >= 100 ? 0 : shipment.simulation.currentProgress)
        : 0;

      const targetMs = now.getTime() + (days * 24 * 60 * 60 * 1000);
      const targetDate = new Date(targetMs);
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getDate()).padStart(2, '0');
      const formattedEta = `${yyyy}-${mm}-${dd}`;

      const payload = {
        simulation: {
          active: true,
          mode: 'realtime',
          durationDays: days,
          startedAt: now.toISOString(),
          targetCompletionDate: targetDate.toISOString(),
          startProgress: currentProg,
          currentProgress: currentProg,
          speedMultiplier: 1,
          logs: `Autonomous 24/7 transit simulation initiated (${days} day schedule). System will advance progress even when logged out.`
        }
      };

      if (simAutoSyncEta) {
        payload.eta = formattedEta;
      }

      try {
        const res = await fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const updated = await res.json();
          setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
          setIsSimRunning(true);
        }
      } catch (err) {
        console.error('Failed to start realtime simulation:', err);
      }
    } else {
      // Manual interactive fast demo loop
      fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation: {
            active: true,
            mode: 'manual',
            speedMultiplier: simSpeedRef.current
          }
        })
      });

      const interval = setInterval(() => {
        updateSimTelemetry(simActiveShipmentId, simSpeedRef.current, null);
      }, 1500);

      simIntervalRef.current = interval;
      setIsSimRunning(true);
    }
  };

  const handlePauseSim = async () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimRunning(false);

    if (!simActiveShipmentId) return;
    const shipment = shipmentsRef.current.find(s => s.id === simActiveShipmentId);
    const currProg = shipment?.simulation?.currentProgress || 0;

    try {
      const res = await fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation: {
            active: false,
            startProgress: currProg,
            logs: `Simulation paused at ${currProg.toFixed(1)}% progress.`
          }
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
      }
    } catch (e) {
      console.error('Pause simulation error:', e);
    }
  };

  const handleStopSim = async () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimRunning(false);

    if (!simActiveShipmentId) return;
    const shipment = shipmentsRef.current.find(s => s.id === simActiveShipmentId);
    if (!shipment) return;

    try {
      const res = await fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Registered',
          currentLocationName: `Scheduled for departure at ${shipment.origin}`,
          simulation: {
            active: false,
            currentProgress: 0,
            startProgress: 0,
            startedAt: null,
            targetCompletionDate: null,
            logs: 'Simulation reset to origin. Departure grounded.'
          }
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
      }
    } catch (e) {
      console.error('Reset simulation error:', e);
    }
  };

  // Sync active shipment simulation loop state
  useEffect(() => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimRunning(false);

    if (simActiveShipmentId) {
      const activeShip = shipmentsRef.current.find(s => s.id === simActiveShipmentId);
      if (activeShip && activeShip.simulation) {
        if (activeShip.simulation.mode) {
          setSimMode(activeShip.simulation.mode);
        }
        if (activeShip.simulation.durationDays) {
          setSimDurationDays(activeShip.simulation.durationDays);
        }
        if (activeShip.simulation.active) {
          setIsSimRunning(true);
          if (activeShip.simulation.mode === 'manual') {
            const speed = activeShip.simulation.speedMultiplier || 2;
            setSimSpeed(speed);
            const interval = setInterval(() => {
              updateSimTelemetry(simActiveShipmentId, simSpeedRef.current, null);
            }, 1500);
            simIntervalRef.current = interval;
          }
        }
      }
    }

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };
  }, [simActiveShipmentId]);

  const handleShiftSim = (direction) => {
    if (!simActiveShipmentId) return;
    const offset = direction === 'forward' ? 5 : -5;
    updateSimTelemetry(simActiveShipmentId, offset, `Manual coordinate shift of ${offset}% applied by Admin override.`);
  };

  const handleHubJump = (target) => {
    if (!simActiveShipmentId) return;
    const progress = target === 'destination' ? 100 : 0;
    const logText = target === 'destination' 
      ? 'Admin triggered automated telemetry jump: Arrived at destination.' 
      : 'Admin triggered automated telemetry jump: Returned to origin airport.';
    
    // Perform bulk shift update
    updateSimTelemetry(simActiveShipmentId, target === 'destination' ? 100 : -100, logText);
  };

  // 5. Landing page quick-track box trigger
  const handleQuickTrackSubmit = (e) => {
    e.preventDefault();
    if (!searchTrackId) return;
    const target = shipments.find(s => s.id.toUpperCase() === searchTrackId.trim().toUpperCase());
    if (target) {
      window.location.hash = `#details?id=${target.id}`;
    } else {
      alert('Tracking identity code not registered in system databases.');
    }
  };

  const handleDeleteShipment = async (shipmentId) => {
    if (!window.confirm(`Are you sure you want to permanently delete shipment #${shipmentId}? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/shipments/${shipmentId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShipments(prev => prev.filter(s => s.id !== shipmentId));
        if (selectedShipmentId === shipmentId) {
          setSelectedShipmentId(null);
        }
        if (simActiveShipmentId === shipmentId) {
          setSimActiveShipmentId(null);
        }
        fetchStats();
      } else {
        alert(data.error || 'Failed to delete shipment.');
      }
    } catch (err) {
      alert('Failed to connect to backend server for deletion.');
    }
  };

  shipments.forEach(s => registerCustomPlaces(s.customPlaces));

  const customerShipments = user && user.role === 'customer'
    ? shipments.filter(s => s.customerEmail && s.customerEmail.toLowerCase() === user.email.toLowerCase())
    : [];

  const displayedShipments = user && user.role === 'customer' ? customerShipments : shipments;

  const activeShipment = user && user.role === 'customer'
    ? customerShipments.find(s => s.id.toUpperCase() === (selectedShipmentId || '').toUpperCase())
    : shipments.find(s => s.id.toUpperCase() === (selectedShipmentId || '').toUpperCase());

  // Compute metric panels for customer
  const myTotalShipments = customerShipments.length;
  const myInTransit = customerShipments.filter(s => s.status === 'In Transit').length;
  const myDelivered = customerShipments.filter(s => s.status === 'Delivered').length;
  const myPending = customerShipments.filter(s => s.status === 'Registered' || s.status === 'Warehouse').length;

  return (
    <div>
      {isFlashing && <div className="screen-flash-overlay" />}
      {/* 🚀 Dynamic Header - Hidden on the Login Page */}
      {activeTab !== 'login' && (
        (user && activeTab !== 'home') ? (
          <header className="main-header with-sidebar select-none">
            <button 
              className="btn-mobile-menu"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              aria-label="Toggle Navigation Sidebar"
            >
              <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                {mobileSidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <div className="header-branding" onClick={() => window.location.hash = '#home'}>
              <div className="logo-txl">TXL</div>
              <span className="portal-title">Express Logistics</span>
            </div>

            <div className="header-search-container">
              <form className="header-search-form" onSubmit={handleQuickTrackSubmit}>
                <span className="search-icon-wrapper">
                  <svg className="search-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
                <input 
                  type="text" 
                  placeholder="Track Shipment..." 
                  value={searchTrackId}
                  onChange={(e) => setSearchTrackId(e.target.value)}
                  className="header-search-input"
                />
              </form>
            </div>

            {user.role === 'admin' && (
              <div className="header-profile-widget">
                <div className="profile-info-text">
                  <span className="profile-name">
                    Administrator Profile
                  </span>
                  <span className="profile-role">
                    Fleet Manager ID: #TXL-8821
                  </span>
                </div>
                <img 
                  className="profile-avatar-circle" 
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=80" 
                  alt="User Profile" 
                />
              </div>
            )}
          </header>
        ) : (
          <header className="main-header landing-header">
            <div className="header-branding" onClick={() => window.location.hash = '#home'}>
              <div className="logo-txl">TXL</div>
              <span className="portal-title">Express Logistics</span>
            </div>

          </header>
        )
      )}

      {/* 🚀 Main Core Layout Wrapper */}
      <div className="portal-wrapper">
        
        {/* Render Sidebar Navigation if logged in and not on Home or Login page */}
        {user && activeTab !== 'home' && activeTab !== 'login' && (
          <>
            {mobileSidebarOpen && (
              <div className="sidebar-mobile-backdrop" onClick={() => setMobileSidebarOpen(false)} />
            )}
            <aside className={`main-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-brand-block">
              <h1 className="sidebar-brand-name">Global Logistics</h1>
              <span className="sidebar-brand-sub">Enterprise Portal</span>
            </div>

            <nav className="sidebar-nav-links" onClick={() => setMobileSidebarOpen(false)}>
              {user.role === 'customer' ? (
                <>
                  <a href="#dashboard" className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}>
                    <Activity className="nav-icon" /> Dashboard
                  </a>
                  <a 
                    href="#tracking" 
                    onClick={(e) => {
                      e.preventDefault();
                      setCustomerTrackInput('');
                      setTrackPromptError('');
                      setShowCustomerTrackPrompt(true);
                    }}
                    className={`sidebar-link ${activeTab === 'details' || showCustomerTrackPrompt ? 'active' : ''}`}
                  >
                    <ClipboardList className="nav-icon" /> Tracking
                  </a>
                  <a href="#customer-messages" className={`sidebar-link ${activeTab === 'customer-messages' ? 'active' : ''}`}>
                    <MessageCircle className="nav-icon" /> Support Chat
                    {customerInsiteUnreadCount > 0 && (
                      <span style={{
                        marginLeft: 'auto',
                        backgroundColor: '#FF6B00',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        padding: '2px 6px',
                        borderRadius: '10px'
                      }}>
                        {customerInsiteUnreadCount}
                      </span>
                    )}
                  </a>
                </>
              ) : (
                <>
                  <a href="#admin" className={`sidebar-link ${activeTab === 'admin' ? 'active' : ''}`}>
                    <Activity className="nav-icon" /> Dashboard
                  </a>
                  <a href="#appointment" className={`sidebar-link ${activeTab === 'appointment' ? 'active' : ''}`}>
                    <PlusCircle className="nav-icon" /> Shipping Appointment
                  </a>
                  <a href="#tracking" className={`sidebar-link ${activeTab === 'tracking' ? 'active' : ''}`}>
                    <ClipboardList className="nav-icon" /> Shipments
                  </a>
                  <a href="#insite-messages" className={`sidebar-link ${activeTab === 'insite-messages' ? 'active' : ''}`}>
                    <MessageCircle className="nav-icon" /> In-Site Chat
                    {adminInsiteUnreadCount > 0 && (
                      <span style={{
                        marginLeft: 'auto',
                        backgroundColor: '#FF6B00',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        padding: '2px 6px',
                        borderRadius: '10px'
                      }}>
                        {adminInsiteUnreadCount}
                      </span>
                    )}
                  </a>
                  <a href="#messages" className={`sidebar-link ${activeTab === 'messages' ? 'active' : ''}`}>
                    <Mail className="nav-icon" /> Email Messages
                    {unreadCount > 0 && (
                      <span style={{
                        marginLeft: 'auto',
                        backgroundColor: '#e53e3e',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        padding: '2px 6px',
                        borderRadius: '10px'
                      }}>
                        {unreadCount}
                      </span>
                    )}
                  </a>
                  <a href="#email-center" className={`sidebar-link ${activeTab === 'email-center' ? 'active' : ''}`}>
                    <Mail className="nav-icon" /> Email Center
                  </a>
                  <div className="sidebar-action-btn-container">
                    <button 
                      onClick={() => window.location.hash = '#appointment'} 
                      className="btn-sidebar-new-shipment"
                    >
                      + New Shipment
                    </button>
                  </div>
                </>
              )}
            </nav>

            <div className="sidebar-bottom-links" onClick={() => setMobileSidebarOpen(false)}>
              {user.role === 'admin' && (
                <a href="#dashboard" className="sidebar-link bottom-link" onClick={(e) => { e.preventDefault(); alert("Assistance request flagged. A representative will contact you shortly."); }}>
                  <Users className="nav-icon" /> Support
                </a>
              )}
              <button onClick={handleLogout} className="sidebar-link bottom-link btn-sidebar-logout">
                <LogOut className="nav-icon" /> Logout
              </button>
            </div>
          </aside>
        </>
      )}

        {/* 🚀 Render SPA Views Routing Context */}
        <main className={`main-content ${(!user || activeTab === 'home' || activeTab === 'login') ? 'full-width' : ''}`}>
          
          {/* LANDING PAGE VIEW */}
          {activeTab === 'home' && (
            <section className="landing-view">
              {/* 1. Hero Layout */}
              <div className="hero-row">
                <div className="hero-text-block">
                  <div className="hero-sticker">
                    <span className="sticker-bullet">✓</span>
                    <span>Trusted Global Logistics Partner</span>
                  </div>
                  <h1>
                    Track Your Shipment <br />
                    <span className="highlight">Anytime, Anywhere</span>
                  </h1>
                  <p>
                    Experience next-generation logistics with secure end-to-end tracking, real-time status updates, and enterprise-grade fleet management tailored for your business needs.
                  </p>
                  
                  <div className="hero-action-buttons">
                    <button className="btn-hero-primary" onClick={() => triggerNavigationWithFlash('#login')}>
                      Track Your Shipment
                    </button>
                  </div>

                  <div className="hero-social-trust">
                    <div className="avatar-stack">
                      <img className="profile-avatar" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=80" alt="avatar" />
                      <img className="profile-avatar" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&fit=crop&q=80" alt="avatar" />
                      <img className="profile-avatar" src="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=80&fit=crop&q=80" alt="avatar" />
                    </div>
                    <span className="trust-caption">Reliable Global Shipping Network</span>
                  </div>
                </div>

                <div className="hero-visual-col">
                  <div className="hero-main-img-card">
                    <img className="hero-main-img" src="/hero-bg-2.jpg" alt="Warehouse logistics hub" />
                  </div>
                </div>
              </div>

              {/* 1.5 Global Metrics Bar */}
              <div className="landing-metrics-bar">
                <div className="metrics-grid">
                  <div className="metric-item">
                    <div className="metric-num">15.2M+</div>
                    <div className="metric-label">Daily Packages Delivered</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-num">220+</div>
                    <div className="metric-label">Countries & Territories</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-num">99.8%</div>
                    <div className="metric-label">On-Time Delivery Rate</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-num">12,000+</div>
                    <div className="metric-label">Smart Fleet Vehicles</div>
                  </div>
                </div>
              </div>

              {/* 2. Solutions grid */}
              <div className="landing-solutions-section">
                <div className="sec-header-center">
                  <h2>Comprehensive Logistics Solutions</h2>
                  <p>Precision-engineered tools to streamline your supply chain, from local deliveries to international freight forwarding.</p>
                </div>

                <div className="solutions-cards-grid">
                  <div className="solution-card-mock">
                    <div className="solution-badge-icon">
                      <svg className="sol-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <h3>Shipment Tracking</h3>
                    <p>Get instantaneous updates on your package location with centimeter-level precision.</p>
                  </div>

                  <div className="solution-card-mock">
                    <div className="solution-badge-icon">
                      <svg className="sol-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <h3>Live Monitoring</h3>
                    <p>24/7 telemetry and environmental monitoring for sensitive or high-value cargo.</p>
                  </div>

                  <div className="solution-card-mock">
                    <div className="solution-badge-icon">
                      <svg className="sol-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <h3>Fast & Secure</h3>
                    <p>Redundant security protocols and expedited handling for priority shipments.</p>
                  </div>

                  <div className="solution-card-mock">
                    <div className="solution-badge-icon">
                      <svg className="sol-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                    </div>
                    <h3>Logistics Solutions</h3>
                    <p>Custom enterprise workflows and API integrations for seamless operations.</p>
                  </div>
                </div>
              </div>

              {/* 3. Streamlined Journey Timeline */}
              <div className="journey-ticks-section">
                <div className="ticks-header-flex">
                  <div className="title-block">
                    <h2>A Streamlined Journey</h2>
                    <p>From the moment your package enters our system to the final doorstep delivery, we provide transparency at every milestone.</p>
                  </div>
                </div>

                <div className="journey-sequence-row">
                  <div className="seq-node-card">
                    <div className="seq-circle-wrapper">
                      <div className="seq-circle-base">
                        <svg className="seq-icon-inner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div className="seq-index-badge">1</div>
                    </div>
                    <h4>Shipment Registered</h4>
                    <p>Your order is logged into our global dispatch network instantly.</p>
                  </div>

                  <div className="seq-node-card">
                    <div className="seq-circle-wrapper">
                      <div className="seq-circle-base">
                        <svg className="seq-icon-inner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L22 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </div>
                      <div className="seq-index-badge">2</div>
                    </div>
                    <h4>Receive Credentials</h4>
                    <p>Secure login details are sent via encrypted notification channels.</p>
                  </div>

                  <div className="seq-node-card">
                    <div className="seq-circle-wrapper">
                      <div className="seq-circle-base">
                        <svg className="seq-icon-inner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                      </div>
                      <div className="seq-index-badge">3</div>
                    </div>
                    <h4>Secure Login</h4>
                    <p>Access your private dashboard with multi-factor authentication.</p>
                  </div>

                  <div className="seq-node-card">
                    <div className="seq-circle-wrapper">
                      <div className="seq-circle-base">
                        <svg className="seq-icon-inner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <div className="seq-index-badge">4</div>
                    </div>
                    <h4>Live Tracking</h4>
                    <p>Watch your package move across the map in high-resolution.</p>
                  </div>

                  <div className="seq-node-card">
                    <div className="seq-circle-wrapper">
                      <div className="seq-circle-base">
                        <svg className="seq-icon-inner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div className="seq-index-badge">5</div>
                    </div>
                    <h4>Delivered</h4>
                    <p>Package arrived confirmation with digital signature capture.</p>
                  </div>
                </div>
              </div>

              {/* 3.5 Featured Video Showcase Box */}
              <div className="landing-video-showcase-section">
                <div className="sec-header-center" style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <div className="hero-sticker" style={{ margin: '0 auto 16px auto', display: 'inline-flex' }}>
                    <span className="sticker-bullet">▶</span>
                    <span>Official Video Overview</span>
                  </div>
                  <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '0 0 10px 0' }}>Inside the TXL Smart Logistics Network</h2>
                  <p style={{ color: '#cbd5e1', maxWidth: '650px', margin: '0 auto', fontSize: '0.95rem' }}>
                    Watch how our automated sorting hubs, live GPS telemetry, and AI dispatch manage over 15 million packages daily with zero delivery friction.
                  </p>
                </div>

                <div className="video-card-wrapper">
                  <div 
                    className="video-thumbnail-container"
                    onClick={() => alert("TXL Smart Logistics Showcase Video:\n\n'Inside the Global Parcel & Fleet Telemetry System'\n\n(Video player feature preview is ready - click OK to close)")}
                  >
                    <img className="video-thumb-img" src="/hero-bg-2.jpg" alt="Inside TXL Global Logistics Operations" />
                    <div className="video-overlay-gradient"></div>
                    
                    {/* Play Button Overlay */}
                    <div className="video-play-btn-circle">
                      <svg className="play-icon-svg" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>

                    {/* Duration Badge */}
                    <div className="video-duration-badge">
                      <span>HD VIDEO &bull; 3:45 MINS</span>
                    </div>

                    {/* Bottom Caption Overlay */}
                    <div className="video-caption-block">
                      <div className="video-channel-tag">TXL GLOBAL LOGISTICS DISPATCH</div>
                      <h3 className="video-title">Next-Generation Automated Sorting & Fleet Telemetry</h3>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Customer Reviews & Ratings Section */}
              <div className="landing-reviews-section">
                <div className="sec-header-center" style={{ textAlign: 'center', marginBottom: '40px' }}>
                  <div className="hero-sticker" style={{ margin: '0 auto 16px auto', display: 'inline-flex' }}>
                    <span className="sticker-bullet">★</span>
                    <span>4.9 / 5.0 Rating Across 12,000+ Shippers</span>
                  </div>
                  <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '0 0 10px 0' }}>What Our Customers Say</h2>
                  <p style={{ color: '#cbd5e1', maxWidth: '600px', margin: '0 auto', fontSize: '0.95rem' }}>
                    Read real experiences from business owners and individuals who rely on TXL Global Logistics every day.
                  </p>
                </div>

                <div className="reviews-cards-grid">
                  
                  {/* Review 1 */}
                  <div className="review-card">
                    <div className="review-card-header">
                      <img className="reviewer-avatar" src="/review-1.jpg" alt="Marcus Vance" />
                      <div className="reviewer-meta">
                        <h4 className="reviewer-name">Marcus Vance</h4>
                        <span className="reviewer-role">Verified Shipper &bull; Chicago, IL</span>
                      </div>
                    </div>
                    <div className="review-stars-row">
                      ★★★★★ <span className="review-rating-score">5.0 / 5.0</span>
                    </div>
                    <p className="review-comment-text">
                      "Honestly impressed. Had to ship three crates of auto parts across states last week and was super nervous about delays. Got the email with my login details right after registering, logged in, and watched the truck move on the live map the whole way. Package arrived a day early. Def using them again."
                    </p>
                    <div className="review-date-badge">Verified Customer Review &bull; July 2026</div>
                  </div>

                  {/* Review 2 */}
                  <div className="review-card">
                    <div className="review-card-header">
                      <img className="reviewer-avatar" src="/review-2.jpg" alt="David Miller" />
                      <div className="reviewer-meta">
                        <h4 className="reviewer-name">Dave Miller</h4>
                        <span className="reviewer-role">Verified Recipient &bull; Denver, CO</span>
                      </div>
                    </div>
                    <div className="review-stars-row">
                      ★★★★★ <span className="review-rating-score">5.0 / 5.0</span>
                    </div>
                    <p className="review-comment-text">
                      "My package was coming in from Denver and I kept checking the live tracking link on my phone every couple hours haha. The email update came in as soon as it hit the local warehouse. Driver was super friendly too. 5 stars all day."
                    </p>
                    <div className="review-date-badge">Verified Customer Review &bull; July 2026</div>
                  </div>

                  {/* Review 3 */}
                  <div className="review-card">
                    <div className="review-card-header">
                      <img className="reviewer-avatar" src="/review-3.jpg" alt="Chloe Sterling" />
                      <div className="reviewer-meta">
                        <h4 className="reviewer-name">Chloe Sterling</h4>
                        <span className="reviewer-role">Online Store Manager &bull; Seattle, WA</span>
                      </div>
                    </div>
                    <div className="review-stars-row">
                      ★★★★★ <span className="review-rating-score">5.0 / 5.0</span>
                    </div>
                    <p className="review-comment-text">
                      "We switch shipping companies all the time for our online store, but TXL has been by far the most reliable. No missing tracking numbers, no weird email bugs. Our customers get their login links immediately and stop emailing support asking 'where is my package'. Worth every penny."
                    </p>
                    <div className="review-date-badge">Verified Customer Review &bull; July 2026</div>
                  </div>

                </div>
              </div>

              {/* 4.5 Frequently Asked Questions (FAQ) */}
              <div className="landing-faq-section">
                <div className="sec-header-center" style={{ textAlign: 'center', marginBottom: '40px' }}>
                  <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '0 0 10px 0' }}>Frequently Asked Questions</h2>
                  <p style={{ color: '#cbd5e1', maxWidth: '600px', margin: '0 auto', fontSize: '0.95rem' }}>
                    Everything you need to know about tracking packages, receiving login credentials, and fleet services.
                  </p>
                </div>

                <div className="faq-grid">
                  <div className="faq-card">
                    <h4 className="faq-question">How do I track my TXL package live?</h4>
                    <p className="faq-answer">Enter your Tracking ID into the top search bar, or log in to your Customer Portal to watch your parcel's exact GPS location and route waypoints in real-time on our interactive map.</p>
                  </div>
                  <div className="faq-card">
                    <h4 className="faq-question">Where do I get my Customer Portal login credentials?</h4>
                    <p className="faq-answer">When our logistics team creates a shipping appointment for you, an automated welcome email containing your portal password (your tracking number) is sent to your inbox immediately.</p>
                  </div>
                  <div className="faq-card">
                    <h4 className="faq-question">How fast are shipping appointments registered?</h4>
                    <p className="faq-answer">Shipping appointments are processed instantaneously in our cloud database and assigned an automated tracking code immediately.</p>
                  </div>
                  <div className="faq-card">
                    <h4 className="faq-question">What happens if my shipment experiences a delay?</h4>
                    <p className="faq-answer">Our telemetry system detects exceptions in real-time and automatically dispatches email notifications with updated estimated delivery times.</p>
                  </div>
                </div>
              </div>

              {/* 5. Orange CTA Banner */}
              <div className="cta-banner-wrapper">
                <div className="cta-banner-card">
                  <h2>Ready to Optimize Your Logistics?</h2>
                  <p>Join thousands of enterprises using TXL Express Logistics Portal to scale their delivery operations efficiently.</p>
                </div>
              </div>

              {/* 5. Fine Footer */}
              <footer className="global-footer">
                <div className="footer-columns-grid">
                  <div className="footer-info-brand">
                    <h3>TXL Express Global Logistics</h3>
                    <p>Connecting businesses and communities worldwide through innovative logistics and shipping solutions.</p>
                  </div>

                  <div className="footer-col-links">
                    <h4>Services</h4>
                    <ul>
                      <li><a href="#home">E-commerce</a></li>
                      <li><a href="#home">Healthcare</a></li>
                      <li><a href="#home">Manufacturing</a></li>
                      <li><a href="#home">Custom Solutions</a></li>
                    </ul>
                  </div>

                  <div className="footer-col-links">
                    <h4>Support</h4>
                    <ul>
                      <li><a href="#home">Help Center</a></li>
                      <li><a href="#home">Tracking FAQ</a></li>
                      <li><a href="#home">Shipping Tools</a></li>
                      <li><a href="#home">Claims</a></li>
                    </ul>
                  </div>

                  <div className="footer-col-links">
                    <h4>Company</h4>
                    <ul>
                      <li><a href="#home">About Us</a></li>
                      <li><a href="#home">Sustainability</a></li>
                      <li><a href="#home">Investors</a></li>
                      <li><a href="#home">Press Room</a></li>
                    </ul>
                  </div>

                  <div className="footer-col-links">
                    <h4>Social</h4>
                    <div className="footer-social-circles">
                      <button className="social-circle-btn"><Plane style={{width:'14px', height:'14px'}} /></button>
                      <button className="social-circle-btn"><Ship style={{width:'14px', height:'14px'}} /></button>
                    </div>
                  </div>
                </div>

                <div className="footer-divider-line"></div>

                <div className="footer-bottom-row">
                  <span>© 2026 TXL Express Global Logistics. All rights reserved.</span>
                  <div className="footer-bottom-links">
                    <a href="#home">Privacy Notice</a>
                    <a href="#home">Service Terms</a>
                    <a href="#home">Cookie Settings</a>
                  </div>
                </div>
              </footer>
            </section>
          )}

          {/* LOGIN VIEW */}
          {activeTab === 'login' && (
            <section className="login-view-container">
              {/* Subtle watermarks behind */}
              <div className="login-watermark-bg">
                <Truck className="login-watermark-icon one" />
                <Plane className="login-watermark-icon two" />
                <Ship className="login-watermark-icon three" />
                <Package className="login-watermark-icon four" />
              </div>

              <div className="login-wrapper-outer">
                {/* Shield badge */}
                <div className="login-shield-badge">TXL</div>

                <h2 className="login-brand-title">Logistics Portal</h2>
                <p className="login-brand-tagline">Enter your tracking number to access your portal</p>

                <div className="login-card-custom">
                  {loginError && <div className="error-banner" style={{marginBottom:'20px'}}>{loginError}</div>}
                  
                  <form onSubmit={handleLogin}>
                    <div className="login-form-label-row">
                      <label>Tracking Number</label>
                    </div>
                    <div className="login-input-wrapper">
                      <Package className="login-input-icon-left" />
                      <input
                        type="text"
                        placeholder="Enter your tracking number"
                        value={loginTrackingId}
                        onChange={(e) => setLoginTrackingId(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <button type="submit" className="btn-login-submit-gold" disabled={loggingIn}>
                      {loggingIn ? (
                        <>
                          <span className="btn-spinner" aria-label="Signing in"></span>
                          <span>Checking…</span>
                        </>
                      ) : (
                        <>Track <ArrowRight className="btn-arrow" /></>
                      )}
                    </button>
                  </form>
                </div>

                <div className="login-page-subfooter">
                  <a href="#home" className="login-page-sublink">
                    <svg style={{width:'14px', height:'14px'}} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Support
                  </a>
                  <a href="#home" className="login-page-sublink">
                    <Shield style={{width:'14px', height:'14px'}} />
                    Privacy Policy
                  </a>
                </div>
              </div>
            </section>
          )}

          {/* CUSTOMER DASHBOARD VIEW */}
          {activeTab === 'dashboard' && user && (
            <section className="customer-dashboard">
              {/* Statistics Row */}
              <div className="dashboard-stats-row">
                <div className="stat-card-custom">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">Total Shipments</span>
                  </div>
                  <div className="stat-card-value-container">
                    <span className="stat-card-value">{user.role === 'admin' ? shipments.length : myTotalShipments}</span>
                    <span className="stat-badge-pill yellow">+12%</span>
                  </div>
                </div>
                
                <div className="stat-card-custom">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">In Transit</span>
                  </div>
                  <div className="stat-card-value-container">
                    <span className="stat-card-value">{user.role === 'admin' ? shipments.filter(s => s.status === 'In Transit').length : myInTransit}</span>
                  </div>
                  <div className="stat-card-icon-container yellow-truck">
                    <Truck style={{ width: '20px', height: '20px' }} />
                  </div>
                </div>

                <div className="stat-card-custom">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">Delivered</span>
                  </div>
                  <div className="stat-card-value-container">
                    <span className="stat-card-value">{user.role === 'admin' ? shipments.filter(s => s.status === 'Delivered').length : myDelivered}</span>
                    <span className="stat-badge-pill grey">On Time</span>
                  </div>
                </div>

                <div className="stat-card-custom">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">Pending</span>
                  </div>
                  <div className="stat-card-value-container">
                    <span className="stat-card-value">{user.role === 'admin' ? shipments.filter(s => s.status === 'Registered' || s.status === 'Warehouse').length : myPending}</span>
                  </div>
                  <div className="stat-card-icon-container">
                    <ClipboardList style={{ width: '20px', height: '20px' }} />
                  </div>
                </div>
            </div>


              {/* Footer attribution */}
              <footer className="portal-footer-note select-none">
                <p>© 2026 TXL Express Global Logistics. All rights reserved.</p>
                <div className="portal-footer-links">
                  <a href="#dashboard" onClick={(e) => { e.preventDefault(); alert("Privacy Notice details logged under enterprise guidelines."); }}>Privacy Policy</a>
                  <a href="#dashboard" onClick={(e) => { e.preventDefault(); alert("Service terms registered."); }}>Terms of Use</a>
                  <a href="#dashboard" onClick={(e) => { e.preventDefault(); alert("Cookie configuration settings saved."); }}>Cookie Settings</a>
                </div>
              </footer>
            </section>
          )}

          {/* TRACKING LIST VIEW */}
          {activeTab === 'tracking' && user && user.role === 'customer' && (
            <section className="tracking-list-view">
              <div className="table-search-header">
                <div>
                  <h2 className="tracking-title-custom">Shipment Tracking</h2>
                  <p className="tracking-subtitle-custom">Manage and monitor {displayedShipments.length} active global shipments across your fleet.</p>
                </div>
                <div className="tracker-header-actions">
                  <button className="btn-tracker-filter" onClick={() => alert("Filter criteria: Active / Pending / Delayed.")}>
                    <SlidersHorizontal style={{ width: '15px', height: '15px', marginRight: '6px' }} /> Filters
                  </button>
                  <button className="btn-tracker-export" onClick={() => alert("Exporting 4 cargo logs as CSV...")}>
                    <Download style={{ width: '15px', height: '15px', marginRight: '6px' }} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Metrics cards row */}
              <div className="tracking-stats-row">
                <div className="track-stat-card">
                  <span className="track-stat-label">In Transit</span>
                  <div className="track-stat-value-container">
                    <span className="track-stat-val">84</span>
                    <span className="track-stat-badge green">~12%</span>
                  </div>
                </div>

                <div className="track-stat-card">
                  <span className="track-stat-label">Delayed</span>
                  <div className="track-stat-value-container">
                    <span className="track-stat-val text-red">06</span>
                    <span className="track-stat-badge red">▲ 2%</span>
                  </div>
                </div>

                <div className="track-stat-card">
                  <span className="track-stat-label">Delivered Today</span>
                  <div className="track-stat-value-container">
                    <span className="track-stat-val">34</span>
                    <span className="track-stat-badge gray">+8</span>
                  </div>
                </div>

                <div className="track-stat-card">
                  <span className="track-stat-label">Avg. Duration</span>
                  <div className="track-stat-value-container">
                    <span className="track-stat-val">2.4d</span>
                    <span className="track-stat-badge gray">-0.2</span>
                  </div>
                </div>
              </div>

              {/* Shipment Tracking Table */}
              <div className="table-container-custom">
                <table className="portal-table-custom">
                  <thead>
                    <tr>
                      <th>PACKAGE</th>
                      <th>TRACKING NUMBER</th>
                      <th>ORIGIN</th>
                      <th>DESTINATION</th>
                      <th>STATUS</th>
                      <th>EST. DELIVERY</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedShipments.map((shipment) => {
                      let originSub = '';
                      let destSub = '';
                      
                      if (shipment.id === 'TXL-8271-4492') {
                        originSub = 'Changi Logistics Hub';
                        destSub = 'Brandenburg Facility';
                      } else if (shipment.id === 'TXL-9302-1184') {
                        originSub = 'Terminal 4 Cargo';
                        destSub = 'Heathrow Distribution';
                      } else if (shipment.id === 'TXL-7721-0032') {
                        originSub = 'Haneda Port Services';
                        destSub = "Ontario Int'l Depot";
                      } else if (shipment.id === 'TXL-1104-9923') {
                        originSub = "Al Maktoum Int'l";
                        destSub = 'Navi Mumbai Port';
                      } else {
                        originSub = 'Regional Sorting Hub';
                        destSub = 'Delivery Depot';
                      }

                      // Map status classes
                      let statusClass = 'in-transit';
                      if (shipment.status === 'Pending') statusClass = 'pending';
                      if (shipment.status === 'Delayed') statusClass = 'delayed';
                      if (shipment.status === 'Out for Delivery') statusClass = 'out-of-delivery';

                      return (
                        <tr key={shipment.id}>
                          <td>
                            {shipment.packageImage ? (
                              <img
                                src={shipment.packageImage}
                                alt={`Package ${shipment.id}`}
                                title="Click to enlarge"
                                onClick={() => setPhotoPreviewModal(shipment.packageImage)}
                                style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer', display: 'block' }}
                              />
                            ) : (
                              <div style={{ width: '56px', height: '56px', borderRadius: '8px', border: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                                <Package style={{ width: '20px', height: '20px' }} />
                              </div>
                            )}
                          </td>
                          <td className="tracking-num-cell">
                            <div className="table-package-icon">
                              <Package style={{ width: '15px', height: '15px', color: '#FF6B00' }} />
                            </div>
                            <span className="bold-num">{shipment.id}</span>
                          </td>
                          <td>
                            <div className="location-cell">
                              <span className="main-city">{shipment.origin}</span>
                              <span className="sub-hub">{originSub}</span>
                            </div>
                          </td>
                          <td>
                            <div className="location-cell">
                              <span className="main-city">{shipment.destination}</span>
                              <span className="sub-hub">{destSub}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`status-pill ${statusClass}`}>
                              <span className="pill-dot"></span>
                              {shipment.status}
                            </span>
                          </td>
                          <td>
                            <div className="delivery-cell">
                              <span className="delivery-date">
                                {shipment.id === 'TXL-8271-4492' ? 'Oct 24, 2023' : 
                                 shipment.id === 'TXL-9302-1184' ? 'Oct 26, 2023' :
                                 shipment.id === 'TXL-7721-0032' ? 'Oct 22, 2023' :
                                 shipment.id === 'TXL-1104-9923' ? 'Today' : shipment.eta}
                              </span>
                              <span className={`delivery-time-info ${shipment.status === 'Delayed' ? 'text-red' : ''}`}>
                                {shipment.id === 'TXL-8271-4492' && 'by 18:00 PM'}
                                {shipment.id === 'TXL-9302-1184' && 'Scheduled'}
                                {shipment.id === 'TXL-7721-0032' && 'Overdue'}
                                {shipment.id === 'TXL-1104-9923' && 'Expected 2h'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <button 
                              className="btn-track-action-gold"
                              onClick={() => window.location.hash = `#details?id=${shipment.id}`}
                            >
                              Track
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {displayedShipments.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                          No shipments registered under this customer account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mock Pagination Footer */}
              <div className="table-pagination-row">
                <span className="pagination-info">Showing 1 to 4 of 124 shipments</span>
                <div className="pagination-pages">
                  <button className="page-nav-btn">&lt;</button>
                  <button className="page-num-btn active">1</button>
                  <button className="page-num-btn">2</button>
                  <button className="page-num-btn">3</button>
                  <button className="page-nav-btn">&gt;</button>
                </div>
              </div>

              {/* Bottom Live Fleet View Map widget */}
              <div className="live-fleet-map-section">
                <div className="fleet-map-container-relative">
                  {displayedShipments.length > 0 ? (
                    <div style={{ height: '320px', width: '100%' }}>
                      <LeafletMap shipment={displayedShipments[0]} />
                    </div>
                  ) : (
                    <div style={{ height: '320px', backgroundColor: '#e5e7eb' }}></div>
                  )}

                  {/* View Live Map overlay glass badge */}
                  <div className="fleet-map-overlay-center">
                    <button 
                      className="btn-view-live-map" 
                      onClick={() => {
                        if (displayedShipments.length > 0) {
                          window.location.hash = `#details?id=${displayedShipments[0].id}`;
                        } else {
                          alert("No shipments are currently online.");
                        }
                      }}
                    >
                      <MapPin style={{ width: '16px', height: '16px', marginRight: '6px' }} />
                      View Live Map
                    </button>
                  </div>

                  {/* Map corner telemetry footer info */}
                  <div className="fleet-map-overlay-footer">
                    <h4>Live Fleet View</h4>
                    <p>Currently tracking 42 vehicles in North American sector.</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SHIPMENT DETAILS / DYNAMIC MAP VIEW */}
          {activeTab === 'details' && (() => {
            if (!activeShipment) {
              return (
                <section className="shipment-details-view" style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div className="back-nav-row" style={{ marginBottom: '30px' }}>
                    <button onClick={() => window.location.hash = '#home'} className="btn-back-link">
                      ← BACK TO LANDING PAGE
                    </button>
                  </div>
                  <div style={{ background: 'var(--card-bg, #2a2521)', border: '1px solid var(--border-color, #3a322c)', borderRadius: '12px', padding: '40px', maxWidth: '600px', margin: '0 auto', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
                    <Package style={{ width: '48px', height: '48px', color: '#0F172A', marginBottom: '16px' }} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '10px', color: '#fff' }}>
                      Loading Telemetry for Shipment #{selectedShipmentId || 'Unknown'}...
                    </h2>
                    <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '24px' }}>
                      Connecting to TXL Express Global Tracking database to load parcel telemetry.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                      <button 
                        className="btn-hero-primary"
                        style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                        onClick={() => window.location.reload()}
                      >
                        Refresh Tracking Page
                      </button>
                      <button 
                        className="btn-hero-secondary"
                        style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                        onClick={() => window.location.hash = '#home'}
                      >
                        Go to Home
                      </button>
                    </div>
                  </div>
                </section>
              );
            }

            const etaDetails = (() => {
              const eta = activeShipment.eta || '';
              if (!eta) return { date: 'Pending', time: 'Scheduled' };
              const splitter = eta.includes('by') ? 'by' : eta.includes('Expected') ? 'Expected' : eta.includes('Scheduled') ? 'Scheduled' : 'Overdue';
              const parts = eta.split(splitter);
              const date = parts[0]?.trim() || 'Oct 24, 2023';
              const time = (splitter + (parts[1] || '')).trim();
              return { date, time };
            })();

            const originInfo = (() => {
              switch(activeShipment.originCode) {
                case 'SIN': return { city: 'Singapore, SG', hub: 'Changi Logistics Hub - Gate 12' };
                case 'JFK': return { city: 'New York, US', hub: 'JFK Terminal 4 Cargo' };
                case 'HND': return { city: 'Tokyo, JP', hub: 'Haneda Port Services' };
                case 'DXB': return { city: 'Dubai, AE', hub: "Al Maktoum Int'l Terminal" };
                case 'SZX': return { city: 'Shenzhen, CN', hub: 'SZX Hub - Gate 42' };
                default: return { city: activeShipment.origin || 'Origin Port', hub: 'Regional Sorting Hub' };
              }
            })();

            const destInfo = (() => {
              switch(activeShipment.destCode) {
                case 'BER': return { city: 'Berlin, DE', hub: 'Brandenburg Facility - Gate B4' };
                case 'LHR': return { city: 'London, UK', hub: 'Heathrow Distribution Hub' };
                case 'LAX': return { city: 'Los Angeles, US', hub: 'LAX Logistics Center - Dock 4' };
                case 'BOM': return { city: 'Mumbai, IN', hub: 'Navi Mumbai Port Hub' };
                default: return { city: activeShipment.destination || 'Destination Port', hub: 'Delivery Depot' };
              }
            })();

            const displayWeight = activeShipment.id === 'TXL-8271-4492' ? '1,240.50 kg' : `${(activeShipment.weight || 0).toLocaleString()} lbs`;
            const transportDesc = activeShipment.vessel === 'Plane' ? 'Express Air Freight' : activeShipment.vessel === 'Ship' ? 'Ocean Cargo Freight' : 'Expedited Ground Freight';
            const packageDesc = activeShipment.id === 'TXL-8271-4492' ? '3x Euro Pallet' : activeShipment.desc || 'Standard Freight';
            const serviceLevel = activeShipment.vessel === 'Plane' ? 'Priority Global' : activeShipment.vessel === 'Ship' ? 'Standard Economy' : 'Next-Day Ground';

            // Next update countdown dynamically relative to progress
            const progress = activeShipment.simulation ? (activeShipment.simulation.currentProgress || 0) : 0;
            const nextUpdateMins = Math.max(5, Math.round(60 - (progress % 30)));
            const displayProgress = Math.round(progress);

            // Stepper checkpoints array
            const checkpoints = [
              { label: 'Registered', date: 'Oct 18, 08:30', threshold: 0, icon: <CheckCircle style={{width:'15px', height:'15px'}} /> },
              { label: 'Picked Up', date: 'Oct 19, 14:15', threshold: 15, icon: <CheckCircle style={{width:'15px', height:'15px'}} /> },
              { label: 'Warehouse', date: 'Oct 19, 22:00', threshold: 30, icon: <CheckCircle style={{width:'15px', height:'15px'}} /> },
              { label: 'In Transit', date: 'Oct 20, 04:45', threshold: 50, icon: <Plane style={{width:'15px', height:'15px'}} /> },
              { label: 'Customs', date: 'Expected Oct 22', threshold: 75, icon: <Users style={{width:'15px', height:'15px'}} /> },
              { label: 'Local Hub', date: 'Expected Oct 23', threshold: 90, icon: <Truck style={{width:'15px', height:'15px'}} /> },
              { label: 'Delivered', date: 'Expected Oct 24', threshold: 100, icon: <CheckCircle style={{width:'15px', height:'15px'}} /> },
            ];

            return (
              <section className="shipment-details-view">
                {/* GUEST ACCESS LOGIN BANNER */}
                {!user && (
                  <div style={{
                    background: 'linear-gradient(to right, rgba(255, 185, 0, 0.15), rgba(53, 28, 21, 0.6))',
                    border: '1px solid #0F172A',
                    borderRadius: '8px',
                    padding: '16px 24px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '15px'
                  }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', color: '#0F172A', fontSize: '1rem', fontWeight: '700' }}>
                        Live Email Tracking Telemetry
                      </h4>
                      <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.85rem' }}>
                        Viewing shipment #{activeShipment.id}. Enter your tracking number to open your Customer Portal.
                      </p>
                    </div>
                    <button 
                      className="btn-hero-primary" 
                      style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                      onClick={() => {
                        setLoginTrackingId(activeShipment.id || '');
                        window.location.hash = '#login';
                      }}
                    >
                      Open My Portal →
                    </button>
                  </div>
                )}

                {/* BACK NAVIGATION */}
                <div className="back-nav-row">
                  <button 
                    onClick={() => {
                      if (!user) {
                        window.location.hash = '#home';
                      } else {
                        window.location.hash = user.role === 'admin' ? '#admin' : '#dashboard';
                      }
                    }} 
                    className="btn-back-link"
                  >
                    {!user ? '← BACK TO LANDING PAGE' : user.role === 'admin' ? '← BACK TO SHIPMENTS' : '← BACK TO DASHBOARD'}
                  </button>
                </div>

                {/* DETAILS HEADER */}
                <div className="details-header-flex">
                  <h2>Shipment Details #{activeShipment.id}</h2>
                  {user?.role === 'admin' && (
                    <button className="btn-print-label" onClick={() => window.print()}>
                      <Printer style={{ width: '16px', height: '16px', marginRight: '6px' }} />
                      Print Label
                    </button>
                  )}
                </div>

                {/* VERIFIED PACKAGE INTAKE PHOTO CARD */}
                {activeShipment.packageImage && (
                  <div className="package-intake-photo-card" style={{
                    background: 'var(--card-bg, #1e293b)',
                    border: '1px solid var(--border-color, #334155)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '20px',
                    flexWrap: 'wrap',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    <div 
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '2px solid #FF6B00',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                        maxWidth: '220px',
                        maxHeight: '140px'
                      }}
                      onClick={() => setPhotoPreviewModal(activeShipment.packageImage)}
                      title="Click to view full photo"
                    >
                      <img 
                        src={activeShipment.packageImage} 
                        alt="Verified package cargo inspection" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'rgba(15, 23, 42, 0.85)',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        padding: '3px 6px',
                        textAlign: 'center',
                        fontWeight: 'bold'
                      }}>
                        🔍 Click to Enlarge
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: '4px', padding: '2px 8px', fontSize: '0.72rem', color: '#4ade80', fontWeight: 'bold', marginBottom: '6px' }}>
                        <span>✓ VERIFIED INTAKE PHOTOGRAPH</span>
                      </div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: 'var(--text-primary, #ffffff)' }}>Visual Cargo Inspection Verified</h4>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.4' }}>
                        Official carrier photograph captured at origin cargo intake facility. Sealed and registered under Tracking ID <strong style={{ color: '#FF6B00' }}>#{activeShipment.id}</strong>.
                      </p>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Origin: {activeShipment.origin || 'Carrier Hub'} &bull; Destination: {activeShipment.destination || 'Delivery Point'}
                      </div>
                    </div>
                  </div>
                )}

                {/* METADATA MATRIX CARD */}
                <div className="details-top-card-grid">
                  <div className="details-metadata-matrix">
                    <div className="matrix-row">
                      <div className="matrix-item">
                        <span className="matrix-label">CURRENT STATUS</span>
                        <div className="matrix-val">
                          <span className={`status-pill ${activeShipment.status.toLowerCase().replace(/ /g, '-')}`}>
                            <span className="pill-dot"></span>
                            {activeShipment.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">ESTIMATED DELIVERY</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{etaDetails.date}</strong>
                          <span className="sub-val-text">{etaDetails.time}</span>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">ORIGIN</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{originInfo.city}</strong>
                          <span className="sub-val-text">{originInfo.hub}</span>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">DESTINATION</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{destInfo.city}</strong>
                          <span className="sub-val-text">{destInfo.hub}</span>
                        </div>
                      </div>
                    </div>

                    <div className="matrix-separator"></div>

                    <div className="matrix-row">
                      <div className="matrix-item">
                        <span className="matrix-label">WEIGHT</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{displayWeight}</strong>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">TRANSPORT TYPE</span>
                        <div className="matrix-val transport-val">
                          {activeShipment.vessel === 'Plane' ? <Plane className="transport-icon" /> :
                           activeShipment.vessel === 'Ship' ? <Ship className="transport-icon" /> : <Truck className="transport-icon" />}
                          <span className="transport-text">{transportDesc}</span>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">PACKAGE TYPE</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{packageDesc}</strong>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">SERVICE LEVEL</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{serviceLevel}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="next-update-progress-card">
                    <span className="update-label">NEXT UPDATE IN</span>
                    <h2 className="countdown-val">{nextUpdateMins}<span>m</span></h2>
                    
                    <div className="progress-footer-block">
                      <div className="progress-label-row">
                        <span>JOURNEY PROGRESS</span>
                        <span>{displayProgress}%</span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${displayProgress}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEPPER MILESTONES CARD */}
                <div className="milestones-stepper-card">
                  <h3 className="stepper-section-title">Shipment Milestones</h3>
                  
                  <div className="stepper-horizontal-container">
                    <div className="stepper-track-line">
                      <div className="stepper-track-fill" style={{ width: `${Math.min(100, Math.max(0, (progress / 100) * 100))}%` }}></div>
                    </div>
                    
                    <div className="stepper-nodes-row">
                      {checkpoints.map((cp, idx) => {
                        const isCompleted = progress >= cp.threshold;
                        const isActive = idx === 0 
                          ? (progress < 15)
                          : idx === 6
                            ? (progress >= 100)
                            : (progress >= cp.threshold && progress < checkpoints[idx + 1].threshold);
                            
                        let statusClass = 'pending';
                        if (isCompleted) statusClass = 'completed';
                        if (isActive) statusClass = 'active';

                        return (
                          <div className={`step-node-col ${statusClass}`} key={idx}>
                            <div className="step-badge-circle">
                              {isCompleted && !isActive ? <span className="check-mark-symbol">✓</span> : cp.icon}
                            </div>
                            <span className="step-node-label">{cp.label}</span>
                            <span className="step-node-date">{cp.date}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* BOTTOM MAP & LIVE STATUS CONTAINER */}
                <div className="details-map-live-section">
                  <div className="details-map-side-wrapper">
                    <LeafletMap shipment={activeShipment} />
                    
                    {/* Floating Legend Overlay */}
                    <div className="map-legend-footer">
                      <div className="legend-item"><span className="legend-dot express"></span> Express</div>
                      <div className="legend-item"><span className="legend-dot ground"></span> Ground</div>
                      <div className="legend-item"><span className="legend-dot ports"></span> Ports</div>
                    </div>

                    {/* Floating Live Status Card */}
                    <div className="live-status-floating-card">
                      <div className="live-status-card-header">
                        <span className="red-pulse-indicator"></span>
                        <h4>Live Status</h4>
                      </div>

                      <div className="live-status-body">
                        <div className="live-status-item">
                          <span className="live-item-label">CURRENT LOCATION</span>
                          <span className="live-item-val">{activeShipment.currentLocationName || 'Mid-Pacific Operations Area'}</span>
                        </div>
                        <div className="live-status-item">
                          <span className="live-item-label">LAST UPDATED</span>
                          <span className="live-item-val">12 Minutes ago</span>
                        </div>
                        <div className="live-status-item">
                          <span className="live-item-label">ESTIMATED SPEED</span>
                          <span className="live-item-val">
                            {activeShipment.vessel === 'Plane' ? '854 km/h' : activeShipment.vessel === 'Ship' ? '42 km/h' : '85 km/h'}
                          </span>
                        </div>
                        <div className="live-status-item">
                          <span className="live-item-label">EST. ARRIVAL HUB</span>
                          <span className="live-item-val">Tomorrow, 06:00 AM</span>
                        </div>
                      </div>

                      {/* Expandable Logs Button */}
                      <button 
                        className="btn-toggle-tracking-logs"
                        onClick={(e) => {
                          e.preventDefault();
                          const panel = document.getElementById('floating-logs-panel');
                          if (panel) {
                            panel.classList.toggle('visible');
                          }
                        }}
                      >
                        Full Tracking Logs <span className="down-arrow-symbol">▼</span>
                      </button>

                      {/* Collapsed Logs Drawer Area */}
                      <div id="floating-logs-panel" className="floating-logs-drawer">
                        <div className="logs-feed">
                          <div className="log-entry">
                            <div className="log-point"></div>
                            <div className="log-text-block">
                              <span className="log-time">LIVE UPDATES</span>
                              <p className="log-message">{activeShipment.simulation?.logs || 'Tracking telemetry initialized.'}</p>
                            </div>
                          </div>
                          <div className="log-entry">
                            <div className="log-point grey"></div>
                            <div className="log-text-block">
                              <span className="log-time">SYSTEM HISTORY</span>
                              <p className="log-message">Global route coordinates interpolated successfully. Hub sequence: {activeShipment.simulation?.waypoints ? activeShipment.simulation.waypoints.join(' → ') : 'CHI → DEN → SEA'}.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* ADMIN DASHBOARD VIEW */}
          {activeTab === 'admin' && user && user.role === 'admin' && (
            <section className="admin-dashboard-view">
              <div className="admin-dashboard-header">
                <h2>Admin Dashboard</h2>
                <p className="admin-dashboard-subtitle">Overview of global operations and customer activity.</p>
              </div>

              {/* Status Metrics Cards Grid */}
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">TOTAL CUSTOMERS</span>
                    <span className="stat-badge green-trend">Active</span>
                  </div>
                  <h3 className="stat-card-number">{stats?.metrics?.customers ?? 0}</h3>
                </div>

                <div className="admin-stat-card">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">TOTAL SHIPMENTS</span>
                    <span className="stat-badge green-trend">Registered</span>
                  </div>
                  <h3 className="stat-card-number">{stats?.metrics?.shipments ?? 0}</h3>
                </div>

                <div className="admin-stat-card">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">IN TRANSIT</span>
                    <span className="stat-badge orange-badge">Live</span>
                  </div>
                  <h3 className="stat-card-number">{stats?.metrics?.transit ?? 0}</h3>
                </div>

                <div className="admin-stat-card">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">DELIVERED</span>
                    <span className="stat-badge green-badge">Done</span>
                  </div>
                  <h3 className="stat-card-number">{stats?.metrics?.delivered ?? 0}</h3>
                </div>
              </div>

              {/* Main Panel Grid */}
              <div className="admin-panels-grid">
                
                {/* Recent Shipments Directory */}
                <div className="admin-panel-shipments">
                  <div className="panel-header-row">
                    <h3>Recent Shipments</h3>
                    <a href="#tracking" className="panel-link-btn">View All</a>
                  </div>

                  <div className="admin-table-wrapper">
                    <table className="admin-dashboard-table">
                      <thead>
                        <tr>
                          <th>SHIPMENT ID</th>
                          <th>ORIGIN / DESTINATION</th>
                          <th>STATUS</th>
                          <th>DATE</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shipments.slice(0, 4).map(s => {
                          const dateStr = s.createdAt 
                            ? new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'Oct 30, 2023';
                          
                          let statusClass = 'in-transit';
                          if (s.status === 'Delivered') statusClass = 'delivered';
                          if (s.status === 'Registered' || s.status === 'Warehouse') statusClass = 'pending';
                          if (s.status === 'Delayed') statusClass = 'delayed';

                          return (
                            <tr key={s.id}>
                              <td className="shipment-id-cell" onClick={() => window.location.hash = `#details?id=${s.id}`}>
                                {s.packageImage ? (
                                  <img 
                                    src={s.packageImage} 
                                    alt="pkg" 
                                    style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #FF6B00', marginRight: '8px', flexShrink: 0 }} 
                                  />
                                ) : (
                                  <Package className="table-row-pkg-icon" />
                                )}
                                <span className="bold-id-text">{s.id}</span>
                              </td>
                              <td>
                                <div className="route-cell">
                                  <span className="route-cities">{s.origin} to {s.destination}</span>
                                  <span className="route-codes">{s.originCode} ➔ {s.destCode}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`status-pill ${statusClass}`}>
                                  <span className="pill-dot"></span>
                                  {s.status}
                                </span>
                              </td>
                              <td className="date-cell">{dateStr}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    className="btn-tracker-filter"
                                    style={{ padding: '6px 10px', height: 'auto', fontSize: '0.8rem' }}
                                    onClick={() => openEditShipment(s)}
                                    title="Edit shipment details"
                                  >
                                    <span>Edit</span>
                                  </button>
                                  <button 
                                    className="btn-tracker-filter" 
                                    style={{ padding: '6px 10px', height: 'auto', fontSize: '0.8rem', background: 'rgba(255, 185, 0, 0.08)', border: '1px solid rgba(255, 185, 0, 0.3)', color: '#0F172A' }}
                                    onClick={() => {
                                      setSimActiveShipmentId(s.id);
                                      window.location.hash = '#appointment';
                                    }}
                                    title="Control Live Simulation"
                                  >
                                    <Activity style={{ width: '13px', height: '13px' }} />
                                    <span style={{ marginLeft: '4px' }}>Simulate</span>
                                  </button>
                                  <label
                                    className="btn-tracker-filter"
                                    style={{ padding: '6px 10px', height: 'auto', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                                    title={s.packageImage ? 'Replace package photo' : 'Add package photo'}
                                  >
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      onChange={(e) => { handleReplacePhoto(s, e.target.files && e.target.files[0]); e.target.value = ''; }}
                                    />
                                    <Package style={{ width: '13px', height: '13px' }} />
                                    <span style={{ marginLeft: '4px' }}>{s.packageImage ? 'Photo' : 'Add Photo'}</span>
                                  </label>
                                  <button 
                                    className="btn-tracker-filter" 
                                    style={{ padding: '6px 10px', height: 'auto', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                                    onClick={() => handleDeleteShipment(s.id)}
                                    title="Permanently Delete Tracking"
                                  >
                                    <Trash style={{ width: '13px', height: '13px' }} />
                                    <span style={{ marginLeft: '4px' }}>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {shipments.length === 0 && (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                              No active database rows registered in shipments cluster.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Bottom Real-time Monitoring Map */}
              <div className="admin-monitoring-section">
                <div className="monitoring-header">
                  <div className="monitoring-title-flex">
                    <h3>Fleet Real-time Monitoring</h3>
                    <div className="live-badge-glow">
                      <span className="glow-dot"></span>
                      <span>Live Updates</span>
                    </div>
                  </div>
                </div>

                <div className="monitoring-map-wrapper">
                  {shipments.length > 0 ? (
                    <LeafletMap shipment={shipments[0]} />
                  ) : (
                    <div style={{ height: '350px', backgroundColor: 'var(--card-bg)', borderRadius: '12px' }}></div>
                  )}

                  {/* Fleet velocity overlay card */}
                  <div className="fleet-velocity-overlay-card">
                    <span className="velocity-label">FLEET VELOCITY</span>
                    <h4 className="velocity-value">94.2% Efficiency</h4>
                    
                    {/* Simulated visual bar graph */}
                    <div className="velocity-bars-visual">
                      <div className="v-bar" style={{ height: '14px' }}></div>
                      <div className="v-bar" style={{ height: '24px' }}></div>
                      <div className="v-bar" style={{ height: '18px' }}></div>
                      <div className="v-bar yellow" style={{ height: '32px' }}></div>
                      <div className="v-bar" style={{ height: '20px' }}></div>
                      <div className="v-bar" style={{ height: '28px' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ALL SHIPMENTS (ADMIN) */}
          {activeTab === 'tracking' && user && user.role === 'admin' && (() => {
            const q = shipmentSearch.trim().toLowerCase();
            const list = shipments.filter(s => !q || [s.id, s.customerName, s.customerEmail, s.origin, s.destination, s.status]
              .some(v => (v || '').toLowerCase().includes(q)));
            return (
              <section className="admin-dashboard-view">
                <div className="admin-dashboard-header">
                  <h2>All Shipments</h2>
                  <p className="admin-dashboard-subtitle">{shipments.length} shipment{shipments.length === 1 ? '' : 's'} registered. Search, edit, add photos or delete.</p>
                </div>

                <div className="admin-panel-shipments">
                  <div className="panel-header-row" style={{ gap: '12px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Search by tracking number, customer, email, place or status"
                      value={shipmentSearch}
                      onChange={(e) => setShipmentSearch(e.target.value)}
                      style={{ flex: 1, minWidth: '240px', padding: '10px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.9rem' }}
                    />
                    <button className="btn-sidebar-new-shipment" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => window.location.hash = '#appointment'}>
                      + New Shipment
                    </button>
                  </div>

                  <div className="admin-table-wrapper">
                    <table className="admin-dashboard-table">
                      <thead>
                        <tr>
                          <th>SHIPMENT ID</th>
                          <th>CUSTOMER</th>
                          <th>ORIGIN / DESTINATION</th>
                          <th>STATUS</th>
                          <th>ETA</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map(s => {
                          let statusClass = 'in-transit';
                          if (s.status === 'Delivered') statusClass = 'delivered';
                          if (s.status === 'Registered' || s.status === 'Warehouse') statusClass = 'pending';
                          if (s.status === 'Delayed') statusClass = 'delayed';
                          const btn = { padding: '6px 10px', height: 'auto', fontSize: '0.8rem' };
                          return (
                            <tr key={s.id}>
                              <td className="shipment-id-cell" onClick={() => window.location.hash = `#details?id=${s.id}`}>
                                {s.packageImage ? (
                                  <img src={s.packageImage} alt="pkg" style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #CBD5E1', marginRight: '8px', flexShrink: 0 }} />
                                ) : (
                                  <Package className="table-row-pkg-icon" />
                                )}
                                <span className="bold-id-text">{s.id}</span>
                              </td>
                              <td>
                                <div className="route-cell">
                                  <span className="route-cities">{s.customerName}</span>
                                  <span className="route-codes">{s.customerEmail}</span>
                                </div>
                              </td>
                              <td>
                                <div className="route-cell">
                                  <span className="route-cities">{s.origin} to {s.destination}</span>
                                  <span className="route-codes">{s.originCode} ➔ {s.destCode}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`status-pill ${statusClass}`}>
                                  <span className="pill-dot"></span>
                                  {s.status}
                                </span>
                              </td>
                              <td className="date-cell">{s.eta || 'N/A'}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <button className="btn-tracker-filter" style={btn} onClick={() => openEditShipment(s)} title="Edit shipment details">
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    className="btn-tracker-filter"
                                    style={btn}
                                    onClick={() => { setSimActiveShipmentId(s.id); window.location.hash = '#appointment'; }}
                                    title="Control Live Simulation"
                                  >
                                    <Activity style={{ width: '13px', height: '13px' }} />
                                    <span style={{ marginLeft: '4px' }}>Simulate</span>
                                  </button>
                                  <label className="btn-tracker-filter" style={{ ...btn, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }} title={s.packageImage ? 'Replace package photo' : 'Add package photo'}>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      onChange={(e) => { handleReplacePhoto(s, e.target.files && e.target.files[0]); e.target.value = ''; }}
                                    />
                                    <Package style={{ width: '13px', height: '13px' }} />
                                    <span style={{ marginLeft: '4px' }}>{s.packageImage ? 'Photo' : 'Add Photo'}</span>
                                  </label>
                                  <button
                                    className="btn-tracker-filter"
                                    style={{ ...btn, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                                    onClick={() => handleDeleteShipment(s.id)}
                                    title="Permanently Delete Tracking"
                                  >
                                    <Trash style={{ width: '13px', height: '13px' }} />
                                    <span style={{ marginLeft: '4px' }}>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {list.length === 0 && (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                              {shipments.length === 0 ? 'No shipments registered yet.' : 'No shipments match your search.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* SHIPPING APPOINTMENT VIEW */}
          {activeTab === 'appointment' && user && user.role === 'admin' && (() => {
            const selectedShipmentForSim = shipments.find(s => s.id === simActiveShipmentId);
            const selectedShipmentSimProg = selectedShipmentForSim?.simulation?.currentProgress || 0;
            const selectedShipmentSimVessel = selectedShipmentForSim?.vessel || 'Truck';
            
            let selectedShipmentSimProgressCoords = { lat: 39.8283, lng: -98.5795 };
            if (selectedShipmentForSim && selectedShipmentForSim.simulation && selectedShipmentForSim.simulation.waypoints && selectedShipmentForSim.simulation.waypoints.length > 0) {
              const wps = selectedShipmentForSim.simulation.waypoints;
              const progress = selectedShipmentSimProg / 100;
              const totalSegments = wps.length - 1;
              if (totalSegments > 0) {
                const segmentProgress = progress * totalSegments;
                const index = Math.min(Math.floor(segmentProgress), totalSegments - 1);
                const frac = segmentProgress - index;
                const startHubName = wps[index];
                const endHubName = wps[index + 1];
                const startCoords = GPS_COORDINATES[startHubName] || [34.05, -118.24];
                const endCoords = GPS_COORDINATES[endHubName] || [40.71, -74.00];
                selectedShipmentSimProgressCoords = {
                  lat: startCoords[0] + (endCoords[0] - startCoords[0]) * frac,
                  lng: startCoords[1] + (endCoords[1] - startCoords[1]) * frac
                };
              } else if (wps.length === 1) {
                const singleCoords = GPS_COORDINATES[wps[0]] || [39.8283, -98.5795];
                selectedShipmentSimProgressCoords = { lat: singleCoords[0], lng: singleCoords[1] };
              }
            }
            
            let selectedShipmentSimEtaString = '0h 0m';
            let selectedShipmentRemainingTimeStr = 'Ready to launch';
            let selectedShipmentTargetArrivalStr = '--';
            let selectedShipmentStartedAtStr = '--';
            let selectedShipmentDurationStr = `${simDurationDays} Days`;

            if (selectedShipmentForSim) {
              const isRealtime = selectedShipmentForSim.simulation?.mode === 'realtime';
              const durationDaysVal = selectedShipmentForSim.simulation?.durationDays || simDurationDays || 7;
              selectedShipmentDurationStr = durationDaysVal === 1 ? '1 Day (24h)' : durationDaysVal === 7 ? '7 Days (1 Week)' : durationDaysVal === 14 ? '14 Days (2 Weeks)' : `${durationDaysVal} Days`;

              if (selectedShipmentForSim.simulation?.startedAt) {
                try {
                  const sDate = new Date(selectedShipmentForSim.simulation.startedAt);
                  selectedShipmentStartedAtStr = sDate.toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  });
                } catch {
                  selectedShipmentStartedAtStr = selectedShipmentForSim.simulation.startedAt;
                }
              }

              if (isRealtime && selectedShipmentForSim.simulation?.targetCompletionDate) {
                const targetMs = new Date(selectedShipmentForSim.simulation.targetCompletionDate).getTime();
                const nowMs = Date.now();
                const remainingMs = Math.max(0, targetMs - nowMs);

                const totalRemSec = Math.floor(remainingMs / 1000);
                const remDays = Math.floor(totalRemSec / 86400);
                const remHours = Math.floor((totalRemSec % 86400) / 3600);
                const remMins = Math.floor((totalRemSec % 3600) / 60);
                const remSecs = totalRemSec % 60;

                try {
                  const tDate = new Date(targetMs);
                  selectedShipmentTargetArrivalStr = tDate.toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  });
                } catch {
                  selectedShipmentTargetArrivalStr = selectedShipmentForSim.eta;
                }

                if (selectedShipmentSimProg >= 100 || remainingMs <= 0) {
                  selectedShipmentRemainingTimeStr = 'Arrived at Destination';
                  selectedShipmentSimEtaString = 'Delivered';
                } else if (remDays > 0) {
                  selectedShipmentRemainingTimeStr = `${remDays}d ${remHours}h ${remMins}m remaining`;
                  selectedShipmentSimEtaString = `${remDays}d ${remHours}h`;
                } else if (remHours > 0) {
                  selectedShipmentRemainingTimeStr = `${remHours}h ${remMins}m ${remSecs}s remaining`;
                  selectedShipmentSimEtaString = `${remHours}h ${remMins}m`;
                } else {
                  selectedShipmentRemainingTimeStr = `${remMins}m ${remSecs}s remaining`;
                  selectedShipmentSimEtaString = `${remMins}m`;
                }
              } else {
                const remainingFraction = (100 - selectedShipmentSimProg) / 100;
                const totalMinutesSim = selectedShipmentSimVessel === 'Plane' ? 180 : selectedShipmentSimVessel === 'Ship' ? 1440 : 480;
                const remainingMinutes = Math.max(0, Math.round(totalMinutesSim * remainingFraction));
                const hours = Math.floor(remainingMinutes / 60);
                const mins = remainingMinutes % 60;
                selectedShipmentSimEtaString = `${hours}h ${mins}m`;
                selectedShipmentRemainingTimeStr = `${hours}h ${mins}m (demo)`;
                selectedShipmentTargetArrivalStr = selectedShipmentForSim.eta || 'Standard Dispatch';
              }
            }
            
            return (
              <section className="shipping-appointment-view">
                <div className="appointment-page-container">
                  {/* Page Header Area */}
                  <div className="appointment-header-section">
                    <div className="appointment-breadcrumb">
                      <span>Shipments</span>
                      <svg className="breadcrumb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                      <span className="active">New Registration</span>
                    </div>

                    <div className="appointment-title-row">
                      <div className="title-left">
                        <h2>Register Customer Shipment</h2>
                        <p className="appointment-subtitle">Populate details to generate tracking and logistical scheduling.</p>
                      </div>
                      <div className="title-actions">
                        <button type="button" className="btn-discard-draft" onClick={() => {
                          if (window.confirm("Are you sure you want to discard this draft?")) {
                            setFormCustomerName('');
                            setFormCustomerEmail('');
                            setFormCustomerPhone('');
                            setFormAddress('');
                            setFormDeliveryPoint(null);
                            setFormWeight('');
                            setFormDesc('');
                            setFormVessel('Truck');
                            setFormOrigin('Los Angeles (LAX)');
                            setFormOriginCode('LA');
                            setFormDestination('New York (JFK)');
                            setFormDestCode('NY');
                            setFormRouteConfig('LA-KC-CHI-NY');
                          }
                        }}>Discard Draft</button>
                        
                        <button type="button" className="btn-submit-registration" onClick={handleCreateShipment}>Submit Registration</button>
                      </div>
                    </div>
                  </div>

                  {formMsg.text && (
                    <div className={formMsg.type === 'success' ? 'success-banner mb-20' : 'error-banner mb-20'}>
                      {formMsg.text}
                    </div>
                  )}

                  {/* Main Grid split layout */}
                  <div className="appointment-form-grid">
                    {/* Left Column: Customer Info & Shipment Details */}
                    <div className="appointment-form-left-col">
                      {/* Customer Information Card */}
                      <div className="appointment-card">
                        <div className="card-header">
                          <Users className="card-header-icon" />
                          <h3>Customer Information</h3>
                        </div>
                        
                        <div className="card-body">
                          <div className="form-double-row">
                            <div className="input-field">
                              <label>FULL NAME</label>
                              <input 
                                type="text" 
                                placeholder=""
                                value={formCustomerName}
                                onChange={(e) => setFormCustomerName(e.target.value)}
                              />
                            </div>
                            <div className="input-field">
                              <label>EMAIL ADDRESS</label>
                              <input 
                                type="email" 
                                placeholder=""
                                value={formCustomerEmail}
                                onChange={(e) => setFormCustomerEmail(e.target.value)}
                              />
                            </div>
                          </div>
                          
                          <div className="form-double-row mt-15">
                            <div className="input-field">
                              <label>PHONE NUMBER</label>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                  type="text" 
                                  placeholder="+1"
                                  value={formCountryCode}
                                  onChange={(e) => setFormCountryCode(e.target.value)}
                                  style={{ width: '70px', textAlign: 'center' }}
                                />
                                <input 
                                  type="tel" 
                                  placeholder=""
                                  value={formCustomerPhone}
                                  onChange={(e) => setFormCustomerPhone(e.target.value)}
                                  style={{ flex: 1 }}
                                />
                              </div>
                            </div>
                            <div className="input-field">
                              <label>FULL ADDRESS</label>
                              <PlaceSearchInput
                                worldOnly
                                placeholder="Type the street address, e.g. 23 Armada Close, Basildon"
                                value={formAddress}
                                onTextChange={(text) => { setFormAddress(text); setFormDeliveryPoint(null); }}
                                onPickPlace={(place) => setFormDeliveryPoint({ label: place.label, coords: place.coords })}
                              />
                              {formDeliveryPoint && (
                                <>
                                  <span style={{ display: 'block', marginTop: '6px', fontSize: '0.75rem', color: '#15803D' }}>
                                    Map pin set: {formDeliveryPoint.label}
                                  </span>
                                  <StreetPreviewMap point={formDeliveryPoint} />
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Shipment Details Card */}
                      <div className="appointment-card mt-24">
                        <div className="card-header">
                          <Package className="card-header-icon" />
                          <h3>Shipment Details</h3>
                        </div>
                        
                        <div className="card-body">
                          <div className="form-triple-row">
                            <div className="input-field">
                              <label>TRACKING NUMBER</label>
                              <div className="tracking-number-badge-input">
                                <span className="tracking-number-code">{formTrackingId}</span>
                                <button type="button" className="btn-copy-tracking" onClick={() => {
                                  navigator.clipboard.writeText(formTrackingId);
                                  alert("Copied tracking ID to clipboard!");
                                }}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px'}}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                </button>
                              </div>
                            </div>
                            
                            <div className="input-field">
                              <label>SHIPMENT TYPE</label>
                              <select className="custom-select" value={formShipmentType} onChange={(e) => setFormShipmentType(e.target.value)}>
                                <option value="Standard">Standard Freight</option>
                                <option value="Express">Express Deliveries</option>
                                <option value="Priority">Priority Air Cargo</option>
                              </select>
                            </div>
                            
                            <div className="input-field">
                              <label>TRANSPORT TYPE</label>
                              <div className="transport-type-btn-group">
                                <button 
                                  type="button" 
                                  className={`transport-btn ${formVessel === 'Truck' ? 'active' : ''}`}
                                  onClick={() => setFormVessel('Truck')}
                                >
                                  <Truck style={{width: '18px', height: '18px'}} />
                                </button>
                                <button 
                                  type="button" 
                                  className={`transport-btn ${formVessel === 'Plane' ? 'active' : ''}`}
                                  onClick={() => setFormVessel('Plane')}
                                >
                                  <Plane style={{width: '18px', height: '18px'}} />
                                </button>
                                <button 
                                  type="button" 
                                  className={`transport-btn ${formVessel === 'Ship' ? 'active' : ''}`}
                                  onClick={() => setFormVessel('Ship')}
                                >
                                  <Ship style={{width: '18px', height: '18px'}} />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="form-double-row mt-15">
                            <div className="input-field">
                              <label>ORIGIN HUB / CHECKPOINT (UK, US &amp; INTL)</label>
                              <div className="origin-hub-flex-input">
                                <select 
                                  className="hub-code-select" 
                                  value={formOriginCode} 
                                  onChange={(e) => {
                                    const code = e.target.value;
                                    setFormOriginCode(code);
                                    setFormOrigin(formatHubLocationText(code));
                                    const autoSequence = calculateSmartRoute(code, formDestCode);
                                    setFormRouteConfig(autoSequence);
                                  }}
                                >
                                  {renderCategorizedHubOptions()}
                                </select>
                                <PlaceSearchInput
                                  placeholder="Type a city, airport or code, e.g. Birmingham"
                                  value={formOrigin}
                                  onTextChange={setFormOrigin}
                                  onPick={(code) => {
                                    setFormOriginCode(code);
                                    setFormOrigin(formatHubLocationText(code));
                                    setFormRouteConfig(calculateSmartRoute(code, formDestCode));
                                  }}
                                  onPickPlace={(place) => {
                                    const code = makeCustomCode(place.name, place.coords[0], place.coords[1]);
                                    registerCustomPlace(code, place);
                                    setFormOriginCode(code);
                                    setFormOrigin(formatHubLocationText(code));
                                    setFormRouteConfig(calculateSmartRoute(code, formDestCode));
                                  }}
                                />
                              </div>
                            </div>
                            
                            <div className="input-field">
                              <label>DESTINATION HUB / CHECKPOINT (UK, US &amp; INTL)</label>
                              <div className="dest-hub-flex-input">
                                <select 
                                  className="hub-code-select" 
                                  value={formDestCode} 
                                  onChange={(e) => {
                                    const code = e.target.value;
                                    setFormDestCode(code);
                                    setFormDestination(formatHubLocationText(code));
                                    const autoSequence = calculateSmartRoute(formOriginCode, code);
                                    setFormRouteConfig(autoSequence);
                                  }}
                                >
                                  {renderCategorizedHubOptions()}
                                </select>
                                <PlaceSearchInput
                                  placeholder="Type a city, airport or code, e.g. New York"
                                  value={formDestination}
                                  onTextChange={setFormDestination}
                                  onPick={(code) => {
                                    setFormDestCode(code);
                                    setFormDestination(formatHubLocationText(code));
                                    setFormRouteConfig(calculateSmartRoute(formOriginCode, code));
                                  }}
                                  onPickPlace={(place) => {
                                    const code = makeCustomCode(place.name, place.coords[0], place.coords[1]);
                                    registerCustomPlace(code, place);
                                    setFormDestCode(code);
                                    setFormDestination(formatHubLocationText(code));
                                    setFormRouteConfig(calculateSmartRoute(formOriginCode, code));
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="form-triple-row mt-15">
                            <div className="input-field">
                              <label>WEIGHT (KG)</label>
                              <input 
                                type="number" 
                                placeholder="0.00"
                                value={formWeight}
                                onChange={(e) => setFormWeight(e.target.value)}
                              />
                            </div>
                            
                            <div className="input-field">
                              <label>EST. DELIVERY</label>
                              <input 
                                type="date" 
                                value={formEta}
                                onChange={(e) => setFormEta(e.target.value)}
                              />
                            </div>

                            <div className="input-field">
                              <label>INITIAL STATUS</label>
                              <select className="custom-select" value={formInitialStatus} onChange={(e) => setFormInitialStatus(e.target.value)}>
                                <option value="Manifest Prepared">Manifest Prepared</option>
                                <option value="In Transit">In Transit</option>
                                <option value="Warehouse">Warehouse arrival</option>
                                <option value="Out for Delivery">Out for Delivery</option>
                              </select>
                            </div>
                          </div>

                          <div className="input-field mt-15">
                            <label>CONTENT DESCRIPTION</label>
                            <textarea 
                              rows="3" 
                              placeholder="Describe the items being shipped for insurance and customs..."
                              value={formDesc}
                              onChange={(e) => setFormDesc(e.target.value)}
                            />
                          </div>
                          
                          <div className="input-field mt-15">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label style={{ margin: 0 }}>SMART SIMULATION SEQUENCE (ROUTE HASH)</label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    const autoSeq = calculateSmartRoute(formOriginCode, formDestCode);
                                    setFormRouteConfig(autoSeq);
                                  }}
                                  style={{
                                    background: 'rgba(255, 107, 0, 0.1)',
                                    border: '1px solid #FF6B00',
                                    color: '#FF6B00',
                                    borderRadius: '4px',
                                    padding: '3px 8px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  title="Automatically calculate the optimal freight corridor path"
                                >
                                  <span>⚡ AI Auto-Route</span>
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => setFormRouteConfig(`${formOriginCode}-${formDestCode}`)}
                                  style={{
                                    background: '#F1F5F9',
                                    border: '1px solid #CBD5E1',
                                    color: '#475569',
                                    borderRadius: '4px',
                                    padding: '3px 8px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                  }}
                                  title="Direct non-stop path between origin and destination"
                                >
                                  <span>Direct Express</span>
                                </button>
                              </div>
                            </div>

                            <input 
                              type="text" 
                              placeholder="e.g. LHR-EMA-MAN-EDI or LAX-DEN-ORD-JFK"
                              value={formRouteConfig}
                              onChange={(e) => setFormRouteConfig(e.target.value)}
                            />

                            {/* Live Route Breadcrumbs Preview */}
                            {formRouteConfig && (
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: '6px',
                                marginTop: '8px',
                                padding: '8px 12px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px'
                              }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginRight: '4px' }}>
                                  Live Waypoints:
                                </span>
                                {formRouteConfig.split('-').map((wp, idx, arr) => {
                                  const cleanWp = wp.trim().toUpperCase();
                                  const hub = GLOBAL_LOGISTICS_HUBS[cleanWp];
                                  const isStart = idx === 0;
                                  const isEnd = idx === arr.length - 1;
                                  const flag = hub?.flag || '📍';
                                  const name = hub ? hub.name : cleanWp;
                                  return (
                                    <React.Fragment key={idx}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.78rem',
                                        fontWeight: '700',
                                        background: isStart ? '#DCFCE7' : isEnd ? '#FEE2E2' : '#FFEDD5',
                                        color: isStart ? '#15803D' : isEnd ? '#B91C1C' : '#C2410C',
                                        border: `1px solid ${isStart ? '#86EFAC' : isEnd ? '#FCA5A5' : '#FDBA74'}`
                                      }} title={`${name} (${cleanWp})`}>
                                        <span>{flag}</span>
                                        <span>{cleanWp}</span>
                                      </span>
                                      {idx < arr.length - 1 && (
                                        <span style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 'bold' }}>&rarr;</span>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            )}

                            <small style={{display: 'block', color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.78rem'}}>
                              Optimal route sequence generated automatically. You can freely edit or type any station codes separated by dash (-).
                            </small>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Upload Image & Internal Notes */}
                    <div className="appointment-form-right-col">
                      {/* Package Image Card */}
                      <div className="appointment-card">
                        <div className="card-header">
                          <svg className="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px', height: '20px'}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <h3>Package Image</h3>
                        </div>
                        
                        <div className="card-body">
                          <div 
                            className={`upload-dropzone ${isDraggingImage ? 'dropzone-active' : ''}`}
                            onClick={() => document.getElementById('package-image-upload').click()}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDraggingImage(true);
                            }}
                            onDragLeave={() => setIsDraggingImage(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDraggingImage(false);
                              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                processImageFile(e.dataTransfer.files[0]);
                              }
                            }}
                            style={{ 
                              cursor: 'pointer',
                              border: isDraggingImage ? '2px dashed #FF6B00' : undefined,
                              backgroundColor: isDraggingImage ? 'rgba(255, 107, 0, 0.08)' : undefined,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="upload-cloud-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span className="dropzone-text">{isDraggingImage ? 'Release to upload package photo' : 'Click to upload or drag & drop'}</span>
                            <span className="dropzone-sub">PNG, JPG up to 10MB &bull; Auto-optimized</span>
                            <input 
                              type="file" 
                              id="package-image-upload" 
                              style={{ display: 'none' }} 
                              accept="image/*"
                              onChange={handleImageUpload}
                            />
                          </div>
                          
                          {formUploadedImage ? (
                            <div className="uploaded-files-list">
                              <div className="file-list-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-secondary, #0f172a)', borderRadius: '8px', border: '1px solid var(--border-color, #334155)', marginTop: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setPhotoPreviewModal(formUploadedImage.base64)}>
                                  <img 
                                    className="file-preview-img-icon" 
                                    src={formUploadedImage.base64} 
                                    alt="shipment package preview" 
                                    style={{width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #FF6B00'}} 
                                  />
                                  <div className="file-item-meta">
                                    <span className="file-item-name" style={{ fontWeight: '600', color: 'var(--text-primary, #ffffff)', fontSize: '0.85rem', display: 'block' }}>{formUploadedImage.name}</span>
                                    <span className="file-item-size" style={{ fontSize: '0.75rem', color: '#10B981' }}>{formUploadedImage.size} &bull; ✓ Ready to Save & Email</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={() => setPhotoPreviewModal(formUploadedImage.base64)}
                                    style={{ background: 'none', border: 'none', color: '#FF6B00', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                    title="Preview Full Photo"
                                  >
                                    View
                                  </button>
                                  <button 
                                    type="button" 
                                    className="btn-delete-file" 
                                    onClick={() => setFormUploadedImage(null)}
                                    title="Remove Photo"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', height: '16px'}}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '15px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                              No package photo uploaded yet.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Internal Notes Card */}
                      <div className="appointment-card mt-24">
                        <div className="card-header">
                          <svg className="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px', height: '20px'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <h3>Internal Notes</h3>
                        </div>
                        
                        <div className="card-body">
                          <textarea 
                            rows="5" 
                            placeholder="Add administrative notes, route exceptions, or specific handling instructions..." 
                            value={formInternalNotes}
                            onChange={(e) => setFormInternalNotes(e.target.value)}
                          />
                          <div className="notes-privacy-banner">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="lock-icon" style={{width: '12px', height: '12px'}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            <span>These notes are only visible to TXL staff.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Panel: Live Tracking Simulation */}
                  <div className="appointment-simulation-panel mt-24">
                    <div className="sim-panel-header">
                      <div className="header-left">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pulse-icon"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                        <div className="sim-panel-titles">
                          <h3>Live Tracking Simulation</h3>
                          <span className="sim-panel-subtitle">PREVIEW LOGISTICS PIPELINE BEFORE COMMIT</span>
                        </div>
                      </div>
                      <div className="header-right">
                        <div className="sim-pill-group">
                          <span className="sim-pill active">REAL-TIME</span>
                          <span className="sim-pill">SIMULATED</span>
                        </div>
                        <button type="button" className="btn-fullscreen-toggle" onClick={() => alert("Simulation Fullscreen Mode Enabled")}>FULL SCREEN</button>
                      </div>
                    </div>
                    
                    <div className="sim-panel-content-split">
                      {/* Map Column - Pure 100% Map with NO boxes on or above the map */}
                      <div className="sim-panel-map-col">
                        <div className="sim-map-canvas-container">
                          {selectedShipmentForSim ? (
                            <LeafletMap shipment={selectedShipmentForSim} height="100%" />
                          ) : (
                            <div style={{ height: '100%', minHeight: '520px', backgroundColor: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                              No active shipment selected for simulation. Select a shipment from the sidebar on the right.
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Controller Column */}
                      <div className="sim-panel-controls-col">
                        <div className="controller-section">
                          <span className="section-label">PATH SETUP</span>
                          
                          <div className="control-group">
                            <label>SELECT SHIPMENT TO TELEMETER</label>
                            <select 
                              className="sim-shipment-select"
                              value={simActiveShipmentId} 
                              onChange={(e) => setSimActiveShipmentId(e.target.value)}
                            >
                              <option value="">-- Select Shipment --</option>
                              {shipments.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.id} ({s.customerName} - {s.vessel})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="control-group mt-10">
                            <label>ORDER HUB</label>
                            <div className="mock-control-input-read">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px', color: '#0F172A'}}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                              <span>{selectedShipmentForSim?.originCode || 'LAX-04'}</span>
                            </div>
                          </div>
                          
                          <div className="control-group mt-10">
                            <label>WAYPOINTS</label>
                            <div className="waypoints-flex-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                              {selectedShipmentForSim?.simulation?.waypoints?.map((wp, idx) => (
                                <span key={idx} className="wp-badge" style={{
                                  background: 'rgba(255, 185, 0, 0.1)',
                                  border: '1px solid var(--primary-color)',
                                  color: 'var(--primary-color)',
                                  padding: '2.5px 7px',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontWeight: '500'
                                }}>
                                  {wp}
                                  {selectedShipmentForSim?.simulation?.waypoints?.length > 1 && (
                                    <span 
                                      onClick={() => handleRemoveWaypoint(wp)} 
                                      style={{ cursor: 'pointer', fontWeight: 'bold', marginLeft: '2px', color: '#ff4d4d' }}
                                      title="Remove waypoint"
                                    >
                                      &times;
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                            <select 
                              className="sim-waypoint-select custom-select" 
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddWaypoint(e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              style={{
                                width: '100%',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                padding: '6px',
                                fontSize: '0.85rem'
                              }}
                            >
                              <option value="">-- Add US State / Waypoint Hub --</option>
                              {renderCategorizedHubOptions(selectedShipmentForSim?.simulation?.waypoints || [])}
                            </select>
                          </div>

                          <div className="control-group mt-10">
                            <label>DESTINATION HUB</label>
                            <div className="mock-control-input-read">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px', color: '#ff4d4d'}}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                              <span>{selectedShipmentForSim?.destCode || 'JFK-01'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Dedicated Live Telemetry Card placed in sidebar */}
                        {selectedShipmentForSim && (
                          <div className="controller-section sim-telemetry-sidebar-card">
                            <div className="telemetry-sidebar-header">
                              <span className="section-label">LIVE TELEMETRY</span>
                              <span className="sim-status-live-indicator"><span className="pulse-dot"></span> LIVE</span>
                            </div>

                            <div className="sim-telemetry-sidebar-grid">
                              <div className="telemetry-stat-box">
                                <span className="stat-label">SPEED</span>
                                <span className="stat-val gold">
                                  {selectedShipmentSimVessel === 'Plane' ? '820 km/h' : selectedShipmentSimVessel === 'Ship' ? '35 km/h' : '85 km/h'}
                                </span>
                              </div>
                              <div className="telemetry-stat-box">
                                <span className="stat-label">ESTIMATED ETA</span>
                                <span className="stat-val">{selectedShipmentSimEtaString}</span>
                              </div>
                              <div className="telemetry-stat-box full-width">
                                <span className="stat-label">COORDINATES</span>
                                <span className="stat-val mono">
                                  {selectedShipmentSimProgressCoords?.lat?.toFixed(4)}°N, {Math.abs(selectedShipmentSimProgressCoords?.lng || 0).toFixed(4)}°W
                                </span>
                              </div>
                              <div className="telemetry-stat-box full-width">
                                <div className="stat-flex-row">
                                  <span className="stat-label">PROGRESS</span>
                                  <span className="stat-val gold">{selectedShipmentSimProg.toFixed(1)}%</span>
                                </div>
                                <div className="telemetry-progress-track">
                                  <div className="telemetry-progress-fill" style={{ width: `${selectedShipmentSimProg}%` }}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="controller-section mt-15">
                          <span className="section-label">TRANSIT VESSEL</span>
                          <div className="simulation-mode-icons-row">
                            <button 
                              type="button" 
                              className={`sim-mode-btn ${selectedShipmentSimVessel === 'Truck' ? 'active' : ''}`}
                              onClick={() => handleUpdateSimShipmentVessel('Truck')}
                            >
                              <Truck style={{width: '16px', height: '16px'}} />
                              <span>Truck</span>
                            </button>
                            <button 
                              type="button" 
                              className={`sim-mode-btn ${selectedShipmentSimVessel === 'Plane' ? 'active' : ''}`}
                              onClick={() => handleUpdateSimShipmentVessel('Plane')}
                            >
                              <Plane style={{width: '16px', height: '16px'}} />
                              <span>Plane</span>
                            </button>
                            <button 
                              type="button" 
                              className={`sim-mode-btn ${selectedShipmentSimVessel === 'Ship' ? 'active' : ''}`}
                              onClick={() => handleUpdateSimShipmentVessel('Ship')}
                            >
                              <Ship style={{width: '16px', height: '16px'}} />
                              <span>Ship</span>
                            </button>
                          </div>
                        </div>

                        {/* Simulation Engine Mode: Scheduled Real-Time vs Manual Demo */}
                        <div className="controller-section mt-15">
                          <span className="section-label">SIMULATION ENGINE MODE</span>
                          <div className="sim-mode-toggle-group">
                            <button
                              type="button"
                              className={`sim-mode-tab-btn ${simMode === 'realtime' ? 'active' : ''}`}
                              onClick={() => setSimMode('realtime')}
                            >
                              <Clock style={{ width: '14px', height: '14px' }} />
                              <span>Scheduled (24/7)</span>
                            </button>
                            <button
                              type="button"
                              className={`sim-mode-tab-btn ${simMode === 'manual' ? 'active' : ''}`}
                              onClick={() => setSimMode('manual')}
                            >
                              <Zap style={{ width: '14px', height: '14px' }} />
                              <span>Manual Demo</span>
                            </button>
                          </div>

                          {simMode === 'realtime' ? (
                            <>
                              <div className="sim-schedule-banner">
                                <Clock style={{ width: '18px', height: '18px' }} />
                                <p>
                                  <strong>24/7 Autonomous Engine:</strong> The simulation progresses automatically in real time across your selected days even when you close the website.
                                </p>
                              </div>

                              <div className="control-group">
                                <label>CHOOSE DURATION BEFORE REACHING DESTINATION</label>
                                <div className="sim-duration-grid">
                                  <button
                                    type="button"
                                    className={`sim-duration-btn ${simDurationDays === 1 ? 'active' : ''}`}
                                    onClick={() => { setSimDurationDays(1); setSimCustomVal('1'); setSimCustomUnit('days'); }}
                                  >
                                    <span className="dur-title">1 Day</span>
                                    <span className="dur-sub">24 Hours</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`sim-duration-btn ${simDurationDays === 2 ? 'active' : ''}`}
                                    onClick={() => { setSimDurationDays(2); setSimCustomVal('2'); setSimCustomUnit('days'); }}
                                  >
                                    <span className="dur-title">2 Days</span>
                                    <span className="dur-sub">48 Hours</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`sim-duration-btn ${simDurationDays === 3 ? 'active' : ''}`}
                                    onClick={() => { setSimDurationDays(3); setSimCustomVal('3'); setSimCustomUnit('days'); }}
                                  >
                                    <span className="dur-title">3 Days</span>
                                    <span className="dur-sub">72 Hours</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`sim-duration-btn ${simDurationDays === 5 ? 'active' : ''}`}
                                    onClick={() => { setSimDurationDays(5); setSimCustomVal('5'); setSimCustomUnit('days'); }}
                                  >
                                    <span className="dur-title">5 Days</span>
                                    <span className="dur-sub">120 Hours</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`sim-duration-btn ${simDurationDays === 7 ? 'active' : ''}`}
                                    onClick={() => { setSimDurationDays(7); setSimCustomVal('7'); setSimCustomUnit('days'); }}
                                  >
                                    <span className="dur-title">★ 1 Week</span>
                                    <span className="dur-sub">7 Days</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`sim-duration-btn ${simDurationDays === 10 ? 'active' : ''}`}
                                    onClick={() => { setSimDurationDays(10); setSimCustomVal('10'); setSimCustomUnit('days'); }}
                                  >
                                    <span className="dur-title">10 Days</span>
                                    <span className="dur-sub">240 Hours</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`sim-duration-btn ${simDurationDays === 14 ? 'active' : ''}`}
                                    onClick={() => { setSimDurationDays(14); setSimCustomVal('14'); setSimCustomUnit('days'); }}
                                  >
                                    <span className="dur-title">2 Weeks</span>
                                    <span className="dur-sub">14 Days</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`sim-duration-btn ${simDurationDays === 30 ? 'active' : ''}`}
                                    onClick={() => { setSimDurationDays(30); setSimCustomVal('30'); setSimCustomUnit('days'); }}
                                  >
                                    <span className="dur-title">1 Month</span>
                                    <span className="dur-sub">30 Days</span>
                                  </button>
                                </div>

                                {/* Quick verification presets for testing */}
                                <div className="sim-quick-tests-row">
                                  <span className="sim-quick-label">⚡ Fast Test:</span>
                                  <button
                                    type="button"
                                    className={`sim-quick-pill ${Math.abs(simDurationDays - (10 / 1440)) < 0.001 ? 'active' : ''}`}
                                    onClick={() => { setSimDurationDays(10 / 1440); setSimCustomVal('10'); setSimCustomUnit('hours'); }}
                                    title="Complete route in 10 minutes (Test Mode)"
                                  >
                                    10 Mins
                                  </button>
                                  <button
                                    type="button"
                                    className={`sim-quick-pill ${Math.abs(simDurationDays - (30 / 1440)) < 0.001 ? 'active' : ''}`}
                                    onClick={() => { setSimDurationDays(30 / 1440); setSimCustomVal('30'); setSimCustomUnit('hours'); }}
                                    title="Complete route in 30 minutes (Test Mode)"
                                  >
                                    30 Mins
                                  </button>
                                  <button
                                    type="button"
                                    className={`sim-quick-pill ${Math.abs(simDurationDays - (1 / 24)) < 0.001 ? 'active' : ''}`}
                                    onClick={() => { setSimDurationDays(1 / 24); setSimCustomVal('1'); setSimCustomUnit('hours'); }}
                                    title="Complete route in 1 hour (Test Mode)"
                                  >
                                    1 Hour
                                  </button>
                                </div>

                                {/* Custom Days / Hours Input */}
                                <div className="sim-custom-input-box">
                                  <label>Custom Duration:</label>
                                  <div className="sim-custom-inputs-flex">
                                    <input
                                      type="number"
                                      min="0.1"
                                      step="0.5"
                                      className="sim-custom-number-input"
                                      value={simCustomVal}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setSimCustomVal(val);
                                        const num = parseFloat(val);
                                        if (num > 0) {
                                          setSimDurationDays(simCustomUnit === 'hours' ? num / 24 : num);
                                        }
                                      }}
                                    />
                                    <select
                                      className="sim-custom-unit-select"
                                      value={simCustomUnit}
                                      onChange={(e) => {
                                        const unit = e.target.value;
                                        setSimCustomUnit(unit);
                                        const num = parseFloat(simCustomVal);
                                        if (num > 0) {
                                          setSimDurationDays(unit === 'hours' ? num / 24 : num);
                                        }
                                      }}
                                    >
                                      <option value="days">Days</option>
                                      <option value="hours">Hours</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Auto-sync ETA checkbox */}
                                <label className="sim-eta-sync-row">
                                  <input
                                    type="checkbox"
                                    checked={simAutoSyncEta}
                                    onChange={(e) => setSimAutoSyncEta(e.target.checked)}
                                  />
                                  <span>Automatically sync shipment ETA with target completion date</span>
                                </label>

                                {/* Scheduled Telemetry Summary Card */}
                                <div className="sim-schedule-summary-card">
                                  <div className="sim-summary-status-header">
                                    <span className="sim-item-lbl">AUTONOMOUS TELEMETRY</span>
                                    {isSimRunning ? (
                                      <span className="sim-status-chip running">
                                        <span className="pulse-dot"></span> 24/7 ACTIVE
                                      </span>
                                    ) : selectedShipmentSimProg > 0 ? (
                                      <span className="sim-status-chip paused">
                                        PAUSED ({selectedShipmentSimProg.toFixed(1)}%)
                                      </span>
                                    ) : (
                                      <span className="sim-status-chip idle">STANDBY</span>
                                    )}
                                  </div>
                                  <div className="sim-summary-grid">
                                    <div className="sim-summary-item">
                                      <span className="sim-item-lbl">DURATION</span>
                                      <span className="sim-item-val highlight-gold">{selectedShipmentDurationStr}</span>
                                    </div>
                                    <div className="sim-summary-item">
                                      <span className="sim-item-lbl">TIME REMAINING</span>
                                      <span className="sim-item-val highlight-green">{selectedShipmentRemainingTimeStr}</span>
                                    </div>
                                    <div className="sim-summary-item">
                                      <span className="sim-item-lbl">STARTED AT</span>
                                      <span className="sim-item-val">{selectedShipmentStartedAtStr}</span>
                                    </div>
                                    <div className="sim-summary-item">
                                      <span className="sim-item-lbl">ESTIMATED ARRIVAL (ETA)</span>
                                      <span className="sim-item-val">{selectedShipmentTargetArrivalStr}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="controller-section mt-10">
                              <div className="slider-header-flex">
                                <span className="section-label">DEMO MULTIPLIER</span>
                                <span className="speed-val-badge">x{simSpeed}.0</span>
                              </div>
                              <input 
                                type="range" 
                                className="sim-speed-range-slider"
                                min="1" 
                                max="10" 
                                value={simSpeed}
                                onChange={(e) => handleUpdateSimSpeed(parseInt(e.target.value))}
                              />
                            </div>
                          )}
                        </div>

                        <div className="controller-section mt-15">
                          <span className="section-label">PLAYBACK CONTROLS</span>
                          
                          <div className="playback-grid-buttons">
                            <button 
                              type="button" 
                              className={`btn-play-ctrl start ${isSimRunning ? 'active' : ''}`}
                              onClick={handleStartSim}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '12px', height: '12px'}}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                              <span>{isSimRunning ? 'RUNNING' : simMode === 'realtime' ? 'START TRANSIT' : 'START DEMO'}</span>
                            </button>
                            
                            <button 
                              type="button" 
                              className={`btn-play-ctrl pause ${!isSimRunning && selectedShipmentSimProg > 0 ? 'active' : ''}`}
                              onClick={handlePauseSim}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '12px', height: '12px'}}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                              <span>PAUSE</span>
                            </button>
                            
                            <button 
                              type="button" 
                              className="btn-play-ctrl reset"
                              onClick={handleStopSim}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '12px', height: '12px'}}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                              <span>RESET</span>
                            </button>
                            
                            <button 
                              type="button" 
                              className="btn-play-ctrl stop"
                              onClick={() => {
                                handlePauseSim();
                                handleHubJump('origin');
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '12px', height: '12px'}}><rect x="4" y="4" width="16" height="16"/></svg>
                              <span>STOP</span>
                            </button>
                          </div>

                          <div className="playback-navigation-row mt-12">
                            <button className="btn-jump-step" onClick={() => handleShiftSim('backward')}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '12px', height: '12px'}}><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                            </button>
                            <span className="jump-txt">JUMP TO LOC</span>
                            <button className="btn-jump-step" onClick={() => handleShiftSim('forward')}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '12px', height: '12px'}}><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                            </button>
                          </div>

                          <div className="control-group mt-15">
                            <label>UPDATE STATUS OVERRIDE</label>
                            <select className="override-select" value={selectedShipmentForSim?.status || 'Manifest Prepared'} onChange={(e) => {
                              if (selectedShipmentForSim) {
                                fetch(`${API_BASE}/shipments/${selectedShipmentForSim.id}/simulation`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: e.target.value })
                                })
                                .then(() => fetchShipments());
                              }
                            }}>
                              <option value="Manifest Prepared">Manual Position Update</option>
                              <option value="Warehouse">Warehouse Arrival</option>
                              <option value="In Transit">In Transit</option>
                              <option value="Out for Delivery">Out for Delivery</option>
                              <option value="Delivered">Delivered</option>
                            </select>
                          </div>
                        </div>

                        <button type="button" className="btn-save-tracking-config" onClick={() => alert("Simulation Config Saved!")}>
                          Save Tracking Config
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </section>
            );
          })()}

          {activeTab === 'email-center' && user?.role === 'admin' && (
            <EmailCenterView shipments={shipments} API_BASE={API_BASE} />
          )}

          {activeTab === 'insite-messages' && user?.role === 'admin' && (
            <AdminInsiteChatView
              insiteMessages={insiteMessages}
              API_BASE={API_BASE}
              onRefresh={fetchInsiteMessages}
            />
          )}

          {activeTab === 'customer-messages' && user?.role === 'customer' && (
            <CustomerChatView
              user={user}
              insiteMessages={insiteMessages}
              API_BASE={API_BASE}
              onRefresh={fetchInsiteMessages}
            />
          )}

          {activeTab === 'messages' && user?.role === 'admin' && (
            <MessagesView 
              messages={messages} 
              API_BASE={API_BASE} 
              onRefresh={fetchMessages}
              onMarkRead={async (email) => {
                try {
                  await fetch(`${API_BASE}/messages/read`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customerEmail: email })
                  });
                  setMessages(prev => prev.map(m => (m.customerEmail === email && m.sender === 'customer') ? { ...m, read: true } : m));
                } catch (e) {
                  console.error('Failed marking messages read:', e);
                }
              }}
            />
          )}

        </main>
      </div>
      {credentialsModal && (
        <div className="credentials-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="credentials-modal" style={{
            background: 'var(--card-bg, #2a2521)',
            border: '1px solid var(--primary-color, #0F172A)',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '420px',
            margin: '0 16px',
            boxSizing: 'border-box',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'var(--text-primary, #ffffff)',
            animation: 'fadeInCode 0.25s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                background: 'rgba(255, 185, 0, 0.1)',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <i className="fas fa-key" style={{ color: '#0F172A', fontSize: '18px' }}></i>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A' }}>Customer Portal Created</h3>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #cccccc)', marginBottom: '16px', lineHeight: '1.4' }}>
              A customer portal account has been created. The customer can log in using these credentials to track their shipment and view live simulation telemetry.
            </p>

            <div style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid #22c55e',
              borderRadius: '6px',
              padding: '10px 14px',
              color: '#4ade80',
              fontSize: '0.85rem',
              fontWeight: '600',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>✓ Automated confirmation email with credentials & tracking link sent to <strong>{credentialsModal.email}</strong>.</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tracking ID</label>
                <div style={{ display: 'flex', background: 'var(--bg-secondary, #1b1613)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{credentialsModal.trackingId}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(credentialsModal.trackingId);
                      alert("Tracking ID copied!");
                    }} 
                    style={{ background: 'none', border: 'none', color: '#0F172A', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Copy
                  </button>
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Username / Email</label>
                <div style={{ display: 'flex', background: 'var(--bg-secondary, #1b1613)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace' }}>{credentialsModal.email}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(credentialsModal.email);
                      alert("Email copied!");
                    }} 
                    style={{ background: 'none', border: 'none', color: '#0F172A', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            {credentialsModal.packageImage && (
              <div style={{
                background: 'var(--bg-secondary, #1b1613)',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <img 
                  src={credentialsModal.packageImage} 
                  alt="Package intake photo" 
                  style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #FF6B00', cursor: 'pointer' }} 
                  onClick={() => setPhotoPreviewModal(credentialsModal.packageImage)}
                />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#10B981' }}>✓ Package Photo Saved to Database</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94a3b8)' }}>Included below credentials in customer confirmation email.</div>
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setCredentialsModal(null)} 
                style={{
                  background: 'linear-gradient(135deg, #0F172A 0%, #d89600 100%)',
                  color: '#1b1613',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                CONFIRM & CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN PHOTO PREVIEW MODAL */}
      {editForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <form onSubmit={handleSaveEdit} style={{ background: '#ffffff', borderRadius: '10px', padding: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 4px 0', color: '#0F172A' }}>Edit Shipment</h3>
            <p style={{ margin: '0 0 18px 0', color: '#64748B', fontSize: '0.85rem' }}>Tracking number {editForm.id} cannot be changed.</p>
            {(() => {
              const field = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.9rem', color: '#0F172A', background: '#ffffff' };
              const lab = { display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' };
              const set = (k) => (e) => setEditForm(prev => ({ ...prev, [k]: e.target.value }));
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={lab}>Customer name</label><input style={field} value={editForm.customerName} onChange={set('customerName')} required /></div>
                  <div><label style={lab}>Customer email</label><input style={field} type="email" value={editForm.customerEmail} onChange={set('customerEmail')} required /></div>
                  <div><label style={lab}>Phone</label><input style={field} value={editForm.customerPhone} onChange={set('customerPhone')} required /></div>
                  <div><label style={lab}>Weight (kg)</label><input style={field} type="number" step="any" min="0" value={editForm.weight} onChange={set('weight')} required /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={lab}>Delivery address</label><input style={field} value={editForm.address} onChange={set('address')} required /></div>
                  <div><label style={lab}>Origin</label><input style={field} value={editForm.origin} onChange={set('origin')} required /></div>
                  <div><label style={lab}>Destination</label><input style={field} value={editForm.destination} onChange={set('destination')} required /></div>
                  <div>
                    <label style={lab}>Transport</label>
                    <select style={field} value={editForm.vessel} onChange={set('vessel')}>
                      <option value="Truck">Truck</option>
                      <option value="Plane">Plane</option>
                      <option value="Ship">Ship</option>
                    </select>
                  </div>
                  <div>
                    <label style={lab}>Status</label>
                    <select style={field} value={editForm.status} onChange={set('status')}>
                      {['Registered', 'Manifest Prepared', 'Warehouse', 'In Transit', 'Out for Delivery', 'Delayed', 'Delivered'].map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                  <div><label style={lab}>Estimated delivery</label><input style={field} type="date" value={editForm.eta} onChange={set('eta')} required /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={lab}>Contents</label><textarea style={field} rows="2" value={editForm.desc} onChange={set('desc')} required /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={lab}>Internal notes (staff only)</label><textarea style={field} rows="2" value={editForm.internalNotes} onChange={set('internalNotes')} /></div>
                </div>
              );
            })()}
            <p style={{ margin: '14px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
              Changing origin or destination here updates the text only. To change the route on the map, delete and re-book the shipment.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button type="button" onClick={() => setEditForm(null)} style={{ background: '#ffffff', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '10px 18px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={editSaving} style={{ background: '#0F172A', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '10px 22px', fontWeight: 600, cursor: 'pointer', opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {photoPreviewModal && (
        <div 
          className="photo-preview-overlay" 
          onClick={() => setPhotoPreviewModal(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
            backdropFilter: 'blur(5px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{
              position: 'relative',
              background: '#0F172A',
              borderRadius: '12px',
              padding: '16px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              border: '2px solid #FF6B00',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '0.95rem' }}>📸 Verified Cargo Intake Photograph</span>
              <button 
                onClick={() => setPhotoPreviewModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                ✕
              </button>
            </div>
            <img 
              src={photoPreviewModal} 
              alt="Package Intake Enlarge" 
              style={{ maxWidth: '80vw', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px', display: 'block', margin: '0 auto' }} 
            />
          </div>
        </div>
      )}
      
      {showCustomerTrackPrompt && (
        <div className="credentials-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <form className="credentials-modal" onSubmit={(e) => {
            e.preventDefault();
            if (!customerTrackInput.trim()) {
              setTrackPromptError('Please enter a tracking number.');
              return;
            }
            const target = customerShipments.find(s => s.id.trim().toUpperCase() === customerTrackInput.trim().toUpperCase());
            if (target) {
              setShowCustomerTrackPrompt(false);
              setSelectedShipmentId(target.id);
              window.location.hash = `#details?id=${target.id}`;
            } else {
              setTrackPromptError('Tracking ID not found in your account.');
            }
          }} style={{
            background: 'var(--card-bg, #2a2521)',
            border: '1px solid var(--primary-color, #0F172A)',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            margin: '0 16px',
            boxSizing: 'border-box',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'var(--text-primary, #ffffff)',
            animation: 'fadeInCode 0.25s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                background: 'rgba(255, 185, 0, 0.1)',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5" style={{width: '20px', height: '20px'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A' }}>Track Your Shipment</h3>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #cccccc)', marginBottom: '20px', lineHeight: '1.4' }}>
              Please enter your 8-digit tracking ID number to view live simulation path updates, ETA checkpoints, and status notifications.
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tracking Number</label>
              <input 
                type="text"
                value={customerTrackInput}
                onChange={(e) => {
                  setCustomerTrackInput(e.target.value);
                  setTrackPromptError('');
                }}
                placeholder="e.g. TXL-31518784"
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary, #1b1613)',
                  border: '1px solid var(--border-color, #444)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
              {trackPromptError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '8px' }}>
                  {trackPromptError}
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setShowCustomerTrackPrompt(false)}
                style={{
                  background: 'none',
                  color: 'var(--text-secondary, #cccccc)',
                  border: '1px solid var(--border-color, #444)',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                CANCEL
              </button>
              <button 
                type="submit" 
                style={{
                  background: 'linear-gradient(135deg, #0F172A 0%, #E29E00 100%)',
                  color: '#1b1613',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                TRACK SHIPMENT
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

