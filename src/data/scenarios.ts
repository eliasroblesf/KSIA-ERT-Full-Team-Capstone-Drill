export interface Scenario {
  id: string;
  name: string;
  location: string;
  description: string;
  initialHazards: string[];
  initialCasualties: string;
  paxCount: number;
  cascadingInjects: {
    time: number;
    title: string;
    description: string;
    type: 'RADIO' | 'SYSTEM' | 'SECURITY' | 'ENVIRONMENT';
  }[];
}

export const scenarios: Scenario[] = [
  {
    id: 'group1',
    name: 'Baggage Trunkline Cascading',
    location: 'Terminal 2, Basement Level B1, Grid G-14',
    description: '480V VFD cabinet arc flash. Electrical technician collapsed. Smoke migrating to offices.',
    initialHazards: ['Arc Flash Residue', 'Toxic Plastic Smoke', 'Energized Panels'],
    initialCasualties: '1 Tech (Unresponsive, Agonal Gasps)',
    paxCount: 35,
    cascadingInjects: [
      { time: 180, title: 'Radio Trunking Interference', description: 'Heavy frequency interference on Channel Alpha.', type: 'RADIO' },
      { time: 360, title: 'HVAC Damper Failure', description: 'Smoke damper failed; smoke entering Stair A.', type: 'SYSTEM' },
      { time: 600, title: 'EVAG Gate 4 Glitch', description: 'Access server glitch; bollards stuck raised.', type: 'SECURITY' }
    ]
  },
  {
    id: 'group2',
    name: 'Airside Fuel Farm Hydrant',
    location: 'Airside West Apron, Stand 112',
    description: 'High-pressure Jet A-1 rupture. Severe arterial hemorrhage (leg amputation). Spill migrating to drainage.',
    initialHazards: ['Jet A-1 Fuel Spill', 'Volatile Vapor Envelope', 'Hot Engine Proximity'],
    initialCasualties: '1 Ground Refueler (Catastrophic Bleed)',
    paxCount: 15,
    cascadingInjects: [
      { time: 180, title: 'Ignition Hazard Approach', description: 'Baggage tractor entering vapor envelope.', type: 'ENVIRONMENT' },
      { time: 420, title: 'Wind Shift', description: 'Fumes driving into Gate 12 passenger bridge intakes.', type: 'ENVIRONMENT' },
      { time: 660, title: 'Gate Congestion', description: 'Dual-agency arrival bottleneck at Crash Gate 2.', type: 'SECURITY' }
    ]
  },
  {
    id: 'group3',
    name: 'Critical Data Center Battery',
    location: 'ATC Technical Tower, Level 3',
    description: 'Lithium-ion thermal runaway. FM-200 pre-discharge active. Tech collapsed in cable trench.',
    initialHazards: ['FM-200 Vapor', 'Lithium-Ion Off-gassing', 'Confined Space'],
    initialCasualties: '1 Cable Technician (Collapsed in Trench)',
    paxCount: 12,
    cascadingInjects: [
      { time: 120, title: 'Evacuation Resistance', description: 'Engineers refusing to leave critical servers.', type: 'SECURITY' },
      { time: 360, title: 'Biometric Interlock Failure', description: 'Doors locked shut across technical wing.', type: 'SYSTEM' },
      { time: 540, title: 'Toxic Drift', description: 'Hydrogen Fluoride detected in vertical stairwell.', type: 'ENVIRONMENT' }
    ]
  },
  {
    id: 'group4',
    name: 'Concourse Catering Food Hall',
    location: 'Terminal 1 Mezzanine, Catering Bay 4',
    description: 'Class K deep fryer auto-ignition. Grease fireball. Severe burns and mass panic.',
    initialHazards: ['Class K Grease Fire', 'Ceiling Plenum Breach', 'Crowd Stampede'],
    initialCasualties: '2 Workers (Flash Burns & Stridor)',
    paxCount: 200,
    cascadingInjects: [
      { time: 180, title: 'Exit Route Fixation', description: 'Passengers surging against locked customs turnstiles.', type: 'SECURITY' },
      { time: 360, title: 'Plenum Penetration', description: 'Fire spreading through false ceiling over Gate 16.', type: 'SYSTEM' },
      { time: 600, title: 'Perimeter Breach', description: 'Supervisor attempting re-entry for cash recovery.', type: 'SECURITY' }
    ]
  },
  {
    id: 'group5',
    name: 'Central Chiller Complex',
    location: 'Utility Complex, Basement Hall 2',
    description: 'Ammonia line burst. Pipefitter fell 3.5m from catwalk. Disoriented with spinal tenderness.',
    initialHazards: ['Anhydrous Ammonia Gas', 'Working at Height', 'Suspicious Package'],
    initialCasualties: '1 Pipefitter (Traumatic Fall, Spinal)',
    paxCount: 22,
    cascadingInjects: [
      { time: 180, title: 'Intake Migration', description: 'Ammonia moving toward Terminal 2 fresh air intakes.', type: 'ENVIRONMENT' },
      { time: 420, title: 'Suspicious Package Blockage', description: 'Unbadged package blocking Stairwell West.', type: 'SECURITY' },
      { time: 660, title: 'Missing Person Account', description: 'Contractor missing from shift muster.', type: 'SECURITY' }
    ]
  }
];
