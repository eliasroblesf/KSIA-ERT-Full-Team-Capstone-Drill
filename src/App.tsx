/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldAlert, 
  Clock, 
  Activity, 
  Users, 
  ChevronRight, 
  AlertCircle, 
  FileText, 
  Send, 
  RefreshCcw,
  CheckCircle2,
  Lock,
  Download,
  Info,
  Radio,
  Volume2,
  Zap,
  Navigation,
  MessageSquare,
  DoorOpen,
  Search,
  LogOut,
  AlertTriangle,
  Mic2,
  UserCheck,
  Building,
  UserX,
  Flame,
  Stethoscope,
  Shield,
  Truck,
  Wind,
  Server,
  Droplets,
  Package,
  HardHat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { jsPDF } from 'jspdf';
import { scenarios, Scenario } from './data/scenarios';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

type AppPhase = 'LOBBY' | 'TEAM_SETUP' | 'TERMINAL' | 'RESULT' | 'FINAL_DASHBOARD';

interface TeamRoles {
  teamLeader: string;
  suppressionLead: string;
  casualtyCareLead: string;
  evacuationSupportLead: string;
  externalLiaison: string;
}

interface TacticalAction {
  id: string;
  label: string;
  isCorrect: boolean;
  impact: Partial<PerformanceGauges>;
  logMsg: string;
}

const TACTICAL_ACTIONS: Record<string, TacticalAction[]> = {
  teamLeader: [
    { id: 'icp', label: 'Establish ICP', isCorrect: true, impact: { regulatory: 10 }, logMsg: 'Incident Command Post Established. Maintaining Situational Awareness.' },
    { id: 'cvse', label: 'Contain/Evac Logic', isCorrect: true, impact: { containment: 10, egressFlow: 10 }, logMsg: '5-Condition Threshold Evaluated. Directing Sector Egress.' },
    { id: 'cpr_tl', label: 'Direct CPR', isCorrect: false, impact: { regulatory: -15 }, logMsg: 'ERROR: Team Leader engaged in hands-on CPR. Command oversight lost.' },
    { id: 'enter_burn', label: 'Enter Fire Zone', isCorrect: false, impact: { regulatory: -20 }, logMsg: 'ERROR: Team Leader entered hazardous zone. Command structure collapsed.' },
  ],
  suppressionLead: [
    { id: 'iso', label: 'Remote Isolation', isCorrect: true, impact: { containment: 15 }, logMsg: 'SCADA Electrical Trip Executed. Panel De-energized.' },
    { id: 'pass', label: 'PASS Mechanics', isCorrect: true, impact: { containment: 20 }, logMsg: 'Applying Suppression at 3m Standoff. Flame Knockdown in progress.' },
    { id: 'water_c', label: 'Apply Water', isCorrect: false, impact: { containment: -20, lifeSafety: -10 }, logMsg: 'CRITICAL ERROR: Discharged water on Class C/K fire. Conflagration expanded.' },
    { id: 'no_ppe', label: 'Entry No PPE', isCorrect: false, impact: { lifeSafety: -30 }, logMsg: 'CRITICAL ERROR: Suppression lead entered smoke without respiratory protection.' },
  ],
  casualtyCareLead: [
    { id: 'survey', label: 'Primary Survey', isCorrect: true, impact: { lifeSafety: 15 }, logMsg: 'Primary Survey Completed. Hemorrhage Controlled.' },
    { id: 'cpr_cycle', label: '30:2 Resuscitation', isCorrect: true, impact: { lifeSafety: 20 }, logMsg: '30:2 High-Quality CPR Cycles ongoing. AED Deployed.' },
    { id: 'pause_cpr', label: 'Pause for Log', isCorrect: false, impact: { lifeSafety: -15 }, logMsg: 'ERROR: Resuscitation paused >10s to log data. Cerebral perfusion dropping.' },
    { id: 'touch_shock', label: 'Touch during Shock', isCorrect: false, impact: { lifeSafety: -20 }, logMsg: 'CRITICAL ERROR: Team member touched patient during AED discharge. Second casualty created.' },
  ],
  evacuationSupportLead: [
    { id: 'sweep', label: 'Sector Sweep', isCorrect: true, impact: { egressFlow: 20 }, logMsg: 'Left-to-Right Sector Sweep active. Magnetic tags applied.' },
    { id: 'lnnh', label: 'Transmit LNNH', isCorrect: true, impact: { regulatory: 20 }, logMsg: 'L-N-N-H Report transmitted to AOCC. Civil Defense inbound.' },
    { id: 'codes', label: 'Use 10-Codes', isCorrect: false, impact: { regulatory: -10 }, logMsg: 'WARNING: 10-Codes used on emergency freq. Plain clear text required by GACA.' },
    { id: 'reentry', label: 'Allow Re-entry', isCorrect: false, impact: { lifeSafety: -20, regulatory: -10 }, logMsg: 'CRITICAL ERROR: Permitted occupant re-entry before Civil Defense All-Clear.' },
  ],
};

interface PerformanceGauges {
  containment: number;
  lifeSafety: number;
  egressFlow: number;
  regulatory: number;
}

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('LOBBY');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [roles, setRoles] = useState<TeamRoles>({
    teamLeader: '',
    suppressionLead: '',
    casualtyCareLead: '',
    evacuationSupportLead: '',
    externalLiaison: ''
  });

  // Simulation State
  const [time, setTime] = useState(900); // 15 minutes in seconds
  const [isActive, setIsActive] = useState(false);
  const [activeInjects, setActiveInjects] = useState<string[]>([]);
  const [radioBlackout, setRadioBlackout] = useState(false);
  
  // Guided Flow
  const [currentStep, setCurrentStep] = useState(1);
  const steps = [
    { id: 1, title: 'Mobilization', desc: 'Confirm all 5 certified functional roles to initialize the terminal.' },
    { id: 2, title: 'Size-Up', desc: 'Analyze the sector schematic and initial hazards to determine containment priority.' },
    { id: 3, title: 'L-N-N-H Report', desc: 'Transmit the mandatory 4-part report (Location, Nature, Numbers, Hazards) to AOCC.' },
    { id: 4, title: 'Stabilization', desc: 'Execute parallel actions: Power isolation, Primary Medical Survey, and Egress Sweeps.' },
    { id: 5, title: 'Cascading Response', desc: 'Identify and resolve secondary failures (Radio, HVAC, Security Gates).' },
    { id: 6, title: 'Handover Preparation', desc: 'Compile ATMIST medical dossier and verify scene containment for Civil Defense.' },
    { id: 7, title: 'Tactical Handover', desc: 'Deliver final dossier and execute formal command transfer at EVAG gate.' }
  ];

  // Tactical Gauges
  const [gauges, setGauges] = useState<PerformanceGauges>({
    containment: 70,
    lifeSafety: 80,
    egressFlow: 50,
    regulatory: 60
  });

  // Logs
  const [lnnhSent, setLnnhSent] = useState(false);
  const [atmistLog, setAtmistLog] = useState<string[]>([]);
  const [tacticalLog, setTacticalLog] = useState<{time: string, msg: string}[]>([]);
  
  // Scoring
  const [score, setScore] = useState(0);
  const [plusDelta, setPlusDelta] = useState({ plus: ['', '', ''], delta: ['', '', ''] });
  const [executedActions, setExecutedActions] = useState<string[]>([]);
  const [atmistGenerated, setAtmistGenerated] = useState(false);
  const [roleActionCounts, setRoleActionCounts] = useState<Record<string, number>>({
    teamLeader: 0,
    suppressionLead: 0,
    casualtyCareLead: 0,
    evacuationSupportLead: 0,
  });


  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let interval: any;
    if (isActive && time > 0) {
      interval = setInterval(() => {
        setTime(prev => {
          const newTime = prev - 1;
          const elapsed = 900 - newTime;
          
          // Check for injects
          if (selectedScenario) {
            selectedScenario.cascadingInjects.forEach(inject => {
              if (elapsed === inject.time) {
                setActiveInjects(prevInjects => [...prevInjects, inject.title]);
                addTacticalLog(`ALERT: ${inject.title} - ${inject.description}`);
                
                // Trigger specific logic
                if (inject.type === 'RADIO') setRadioBlackout(true);
                
                // Penalize gauges for unaddressed injects over time
                setGauges(g => ({
                  ...g,
                  regulatory: Math.max(0, g.regulatory - 10),
                  egressFlow: inject.type === 'SECURITY' ? Math.max(0, g.egressFlow - 15) : g.egressFlow
                }));
              }
            });
          }

          // Natural decay if not managed
          setGauges(g => ({
            containment: Math.max(0, g.containment - 0.05),
            lifeSafety: Math.max(0, g.lifeSafety - 0.1),
            egressFlow: Math.max(0, g.egressFlow - 0.05),
            regulatory: Math.max(0, g.regulatory - 0.02)
          }));

          return newTime;
        });
      }, 1000);
    } else if (time === 0) {
      handleFinishDrill();
    }
    return () => clearInterval(interval);
  }, [isActive, time, selectedScenario]);

  const addTacticalLog = (msg: string) => {
    const timestamp = formatTime(time);
    setTacticalLog(prev => [{ time: timestamp, msg }, ...prev]);
  };

  const handleSelectGroup = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setPhase('TEAM_SETUP');
    setIsActive(true); // Start 15-minute clock immediately
    setCurrentStep(1);
    addTacticalLog(`GROUP SELECTED: ${scenario.name.toUpperCase()} SCENARIO INITIALIZED`);
  };

  const handleStartDrill = () => {
    if (Object.values(roles).some(r => !r)) return;
    setPhase('TERMINAL');
    setCurrentStep(2);
    addTacticalLog('TERMINAL INITIALIZED: COMMENCING INITIAL SIZE-UP');
  };

  const handleFinishDrill = () => {
    setIsActive(false);
    
    const gaugeScore = (gauges.containment + gauges.lifeSafety + gauges.egressFlow + gauges.regulatory) / 4;
    
    let correctCount = 0;
    let incorrectCount = 0;
    
    executedActions.forEach(id => {
      Object.values(TACTICAL_ACTIONS).flat().forEach(a => {
        if (a.id === id) {
          if (a.isCorrect) correctCount++;
          else incorrectCount++;
        }
      });
    });

    const actionScore = Math.max(0, (correctCount * 12.5) - (incorrectCount * 20));
    const finalScore = Math.round((gaugeScore * 0.4) + (actionScore * 0.6));
    
    setScore(finalScore);
    setPhase('RESULT');
    if (finalScore > 80) confetti();
  };

  const performAction = (role: string, actionId: string) => {
    if (!isActive) return;
    
    const currentCount = roleActionCounts[role] || 0;
    if (currentCount >= 2 && !executedActions.includes(actionId)) {
      alert(`Role Limit Reached: Only 2 tactical actions permitted per functional lead.`);
      return;
    }

    if (executedActions.includes(actionId)) return;

    const action = TACTICAL_ACTIONS[role]?.find(a => a.id === actionId);
    if (!action) return;

    setGauges(prev => ({
      containment: Math.min(100, Math.max(0, prev.containment + (action.impact.containment || 0))),
      lifeSafety: Math.min(100, Math.max(0, prev.lifeSafety + (action.impact.lifeSafety || 0))),
      egressFlow: Math.min(100, Math.max(0, prev.egressFlow + (action.impact.egressFlow || 0))),
      regulatory: Math.min(100, Math.max(0, prev.regulatory + (action.impact.regulatory || 0)))
    }));

    setExecutedActions(prev => [...prev, actionId]);
    setRoleActionCounts(prev => ({ ...prev, [role]: (prev[role] || 0) + 1 }));
    addTacticalLog(`${roles[role as keyof TeamRoles].toUpperCase()}: ${action.logMsg}`);
    
    if (actionId === 'lnnh') setLnnhSent(true);
  };

  const sendWhatsApp = () => {
    const text = `*KSIA ERT Mission Result*%0A%0AScenario: ${selectedScenario?.name}%0AOperational Score: ${score}/100%0AStatus: ${score >= 80 ? 'GACA CERTIFIED' : 'RE-DRILL REQUIRED'}%0A%0AFull PDF Dossier available at the Tactical Terminal.`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'TERMINAL' || !e.shiftKey || !e.ctrlKey) return;
      
      e.preventDefault();
      switch(e.key) {
        case 'F1':
          setRadioBlackout(true);
          addTacticalLog('FACILITATOR INJECT: MANUAL RADIO BLACKOUT TRIGGERED');
          break;
        case 'F2':
          setGauges(prev => ({ ...prev, lifeSafety: Math.max(0, prev.lifeSafety - 30) }));
          addTacticalLog('FACILITATOR INJECT: SUDDEN VENTRICULAR FIBRILLATION');
          break;
        case 'F3':
          setGauges(prev => ({ ...prev, egressFlow: Math.max(0, prev.egressFlow - 30) }));
          addTacticalLog('FACILITATOR INJECT: PRIMARY STAIRWELL COMPROMISED');
          break;
        case 'F4':
          setGauges(prev => ({ ...prev, regulatory: Math.max(0, prev.regulatory - 20) }));
          addTacticalLog('FACILITATOR INJECT: SPILL PERIMETER BREACH');
          break;
        case 'F5':
          alert('Syncing all syndicate consoles to auditorium screen...');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase]);

  const downloadDossier = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('KSIA Post-Incident Technical Dossier', 20, 20);
    doc.setFontSize(12);
    doc.text(`Scenario: ${selectedScenario?.name}`, 20, 35);
    doc.text(`Final Score: ${score}/100`, 20, 45);
    doc.text(`Team Leader: ${roles.teamLeader}`, 20, 55);
    
    const correctActions: string[] = [];
    const incorrectActions: string[] = [];
    
    executedActions.forEach(id => {
      Object.values(TACTICAL_ACTIONS).flat().forEach(a => {
        if (a.id === id) {
          if (a.isCorrect) correctActions.push(a.label);
          else incorrectActions.push(a.label);
        }
      });
    });

    const allCorrectIds = Object.values(TACTICAL_ACTIONS).flat().filter(a => a.isCorrect).map(a => a.id);
    const omissions = allCorrectIds.filter(id => !executedActions.includes(id)).map(id => {
      return Object.values(TACTICAL_ACTIONS).flat().find(a => a.id === id)?.label || '';
    });

    doc.setFontSize(14);
    doc.text('1. Tactical Decision Analysis', 20, 70);
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text(`Correct Decisions: ${correctActions.length > 0 ? correctActions.join(', ') : 'None'}`, 20, 80, { maxWidth: 170 });
    
    doc.setTextColor(239, 68, 68); // Red
    doc.text(`Critical Errors: ${incorrectActions.length > 0 ? incorrectActions.join(', ') : 'None'}`, 20, 95, { maxWidth: 170 });
    
    doc.setTextColor(100, 116, 139); // Slate
    doc.text(`Procedural Omissions: ${omissions.length > 0 ? omissions.join(', ') : 'None'}`, 20, 110, { maxWidth: 170 });
    
    doc.setTextColor(0, 0, 0); // Black
    doc.setFontSize(14);
    doc.text('2. Syndicate Self-Evaluation', 20, 130);
    doc.setFontSize(10);
    doc.text('Operational Successes:', 20, 140);
    plusDelta.plus.forEach((p, i) => {
      if (p.trim()) doc.text(`- ${p}`, 25, 147 + (i * 7));
    });

    doc.text('Behavioral Improvement Areas:', 20, 170);
    plusDelta.delta.forEach((d, i) => {
      if (d.trim()) doc.text(`- ${d}`, 25, 177 + (i * 7));
    });
    
    doc.setFontSize(14);
    doc.text('3. Tactical Log', 20, 205);
    doc.setFontSize(9);
    let y = 215;
    tacticalLog.slice(0, 12).forEach(entry => {
      doc.text(`[${entry.time}] ${entry.msg}`, 20, y);
      y += 7;
    });
    
    doc.save('KSIA-ERT-Dossier.pdf');
  };

  // --- Render Components ---

  const Gauge = ({ label, value, color }: { label: string, value: number, color: string }) => (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={`h-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#05080f] text-slate-200 selection:bg-amber-500/30">
      <OfflineIndicator />
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0a0f1a] px-6 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
              KSIA TACTICAL TERMINAL
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">UCTOC-900</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Unified Command Operations</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 text-2xl font-mono font-bold text-amber-500 tracking-tighter">
              <Clock className="w-5 h-5 opacity-50" />
              {formatTime(time)}
            </div>
            <div className="text-[9px] uppercase tracking-widest text-slate-500">Master Mission Clock</div>
          </div>
          <PWAInstallButton />
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-[1400px] mx-auto min-h-[calc(100vh-80px)]">
        <AnimatePresence mode="wait">
          
          {/* LOBBY PHASE */}
          {phase === 'LOBBY' && (
            <motion.div 
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center max-w-2xl mx-auto space-y-4 py-4 sm:py-8">
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">Full-Team Capstone Drills</h2>
                <p className="text-slate-400 text-sm sm:text-lg leading-relaxed px-4">
                  Select your syndicate cell and operational sector to launch the multi-agency cascading crisis simulator.
                </p>
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 text-[10px] font-bold animate-pulse">
                    <Clock className="w-4 h-4" /> 15-MINUTE MISSION CLOCK STARTS ON SELECTION
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {scenarios.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectGroup(s)}
                    className="group relative text-left p-6 bg-[#0a0f1a] border border-slate-800 rounded-2xl hover:border-amber-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(245,158,11,0.05)]"
                  >
                    <div className="absolute top-4 right-4 text-slate-800 group-hover:text-amber-500/20 text-6xl font-black transition-colors">
                      0{idx + 1}
                    </div>
                    <div className="space-y-4 relative z-10">
                      <div className="inline-flex p-3 bg-slate-900 rounded-xl border border-slate-800">
                        {idx === 0 && <Package className="w-6 h-6 text-blue-400" />}
                        {idx === 1 && <Droplets className="w-6 h-6 text-amber-400" />}
                        {idx === 2 && <Server className="w-6 h-6 text-emerald-400" />}
                        {idx === 3 && <Flame className="w-6 h-6 text-orange-400" />}
                        {idx === 4 && <Wind className="w-6 h-6 text-cyan-400" />}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-amber-500 transition-colors">GROUP {idx + 1}</h3>
                        <p className="text-sm font-semibold text-slate-300 mt-1">{s.name}</p>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {s.description}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 pt-2 uppercase">
                        <Navigation className="w-3 h-3" />
                        {s.location}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* TEAM SETUP PHASE */}
          {phase === 'TEAM_SETUP' && selectedScenario && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-4xl mx-auto space-y-8 py-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <button onClick={() => setPhase('LOBBY')} className="text-amber-500 text-xs sm:text-sm flex items-center gap-1 hover:underline mb-2">
                    <ChevronRight className="w-4 h-4 rotate-180" /> Change Group
                  </button>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <span className="text-lg font-black text-amber-500">1</span>
                    </div>
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-white">Syndicate Mobilization</h2>
                      <p className="text-slate-400 mt-1 text-sm">{steps[0].desc}</p>
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest">Sector</div>
                  <div className="text-sm font-bold text-amber-500">{selectedScenario.name}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(roles) as Array<keyof TeamRoles>).map((role) => (
                  <div key={role} className="p-4 bg-[#0a0f1a] border border-slate-800 rounded-xl space-y-3">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
                      {role === 'teamLeader' && <Shield className="w-3 h-3 text-red-500" />}
                      {role === 'suppressionLead' && <Flame className="w-3 h-3 text-orange-500" />}
                      {role === 'casualtyCareLead' && <Stethoscope className="w-3 h-3 text-emerald-500" />}
                      {role === 'evacuationSupportLead' && <Users className="w-3 h-3 text-blue-500" />}
                      {role === 'externalLiaison' && <Radio className="w-3 h-3 text-amber-500" />}
                      {role.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Enter Member Name"
                      className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
                      value={roles[role]}
                      onChange={(e) => setRoles(prev => ({ ...prev, [role]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-center sm:justify-end pt-8">
                <button 
                  onClick={handleStartDrill}
                  disabled={Object.values(roles).some(r => !r)}
                  className="w-full sm:w-auto px-8 py-4 bg-amber-500 text-amber-950 font-black rounded-xl hover:bg-amber-400 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3 text-lg"
                >
                  INITIALIZE TERMINAL
                  <Zap className="w-5 h-5 fill-current" />
                </button>
              </div>
            </motion.div>
          )}

          {/* TERMINAL PHASE */}
          {phase === 'TERMINAL' && selectedScenario && (
            <div className="flex flex-col gap-6">
              {/* Directive HUD */}
              <div className="bg-[#0a0f1a] border border-amber-500/30 rounded-2xl p-4 shadow-[0_0_20px_rgba(245,158,11,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <span className="text-xl font-black text-amber-500">{currentStep}</span>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-amber-500/70 font-bold">Current Operational Objective</div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">{steps.find(s => s.id === currentStep)?.title}</h3>
                      <p className="text-sm text-slate-400 max-w-2xl">{steps.find(s => s.id === currentStep)?.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center gap-1">
                      {steps.map(s => (
                        <div 
                          key={s.id} 
                          className={`w-2 h-2 rounded-full ${s.id === currentStep ? 'bg-amber-500' : s.id < currentStep ? 'bg-emerald-500' : 'bg-slate-800'}`} 
                        />
                      ))}
                    </div>
                    {currentStep < 7 && (
                      <button 
                        onClick={() => {
                          setCurrentStep(prev => prev + 1);
                          addTacticalLog(`OBJECTIVE UPDATED: PROCEEDING TO ${steps.find(s => s.id === currentStep + 1)?.title.toUpperCase()}`);
                        }}
                        className="px-6 py-2 bg-amber-500 text-amber-950 font-black rounded-lg text-xs hover:bg-amber-400 transition-all flex items-center gap-2"
                      >
                        NEXT OBJECTIVE
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <motion.div 
                key="terminal"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:h-[calc(100vh-240px)]"
              >
              {/* Left Column: Telemetry */}
              <div className="col-span-12 lg:col-span-3 space-y-6 lg:overflow-y-auto lg:pr-2 custom-scrollbar">
                <section className="bg-[#0a0f1a] border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-500" />
                    Incident Telemetry
                  </h3>
                  <div className="space-y-4 py-2">
                    <Gauge label="Scene Stability" value={gauges.containment} color="bg-blue-500" />
                    <Gauge label="Cerebral Perfusion" value={gauges.lifeSafety} color="bg-emerald-500" />
                    <Gauge label="Egress Route Flow" value={gauges.egressFlow} color="bg-amber-500" />
                    <Gauge label="Regulatory Sync" value={gauges.regulatory} color="bg-slate-500" />
                  </div>
                </section>

                <section className="bg-[#0a0f1a] border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    Sector Schematic
                  </h3>
                  <div className="aspect-square bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center p-4">
                    <div className="relative">
                      <Building className="w-16 h-16 text-slate-800" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-12 h-12 bg-red-500/20 rounded-full blur-xl"
                        />
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-1">
                      <div className="text-[10px] font-mono text-slate-400">{selectedScenario.location}</div>
                      <div className="text-[9px] font-bold text-red-500 uppercase">ACTIVE CONFLAGRATION POINT</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {selectedScenario.initialHazards.map(h => (
                      <div key={h} className="text-[10px] py-1.5 px-3 bg-red-500/5 border border-red-500/20 rounded text-red-400 flex items-center gap-2">
                        <Zap className="w-3 h-3" /> {h}
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Center Column: Dynamic Workspace */}
              <div className="col-span-12 lg:col-span-6 flex flex-col gap-6 lg:overflow-hidden">
                <div className="flex-1 bg-[#0a0f1a] border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-6 lg:overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <HardHat className="w-4 h-4 text-orange-500" />
                      Tactical Action Nodes
                    </h3>
                    {radioBlackout && (
                      <motion.div 
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-red-500 text-[10px] font-bold"
                      >
                        <UserX className="w-3 h-3" /> COMMS BLACKOUT
                      </motion.div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Role-Specific Actions */}
                    {Object.entries(TACTICAL_ACTIONS).map(([roleKey, roleActions]) => (
                      <div key={roleKey} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {roleKey.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                          <div className="text-[9px] font-bold text-slate-600">
                            {roleActionCounts[roleKey] || 0} / 2
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {roleActions.map(action => {
                            const isExecuted = executedActions.includes(action.id);
                            let activeColor = 'bg-slate-900 border-slate-800';
                            if (isExecuted) {
                              if (roleKey === 'teamLeader') activeColor = 'bg-red-500/20 border-red-500/50 text-red-100';
                              if (roleKey === 'suppressionLead') activeColor = 'bg-orange-500/20 border-orange-500/50 text-orange-100';
                              if (roleKey === 'casualtyCareLead') activeColor = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100';
                              if (roleKey === 'evacuationSupportLead') activeColor = 'bg-blue-500/20 border-blue-500/50 text-blue-100';
                            }

                            return (
                              <button 
                                key={action.id}
                                onClick={() => performAction(roleKey, action.id)}
                                className={`w-full text-left p-2 border rounded-lg transition-all flex items-center justify-between group ${activeColor} ${isExecuted ? 'cursor-default' : 'hover:border-amber-500/50'}`}
                              >
                                <span className="text-[10px] font-bold">{action.label}</span>
                                {!isExecuted && <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-amber-500" />}
                                {isExecuted && <CheckCircle2 className="w-3 h-3 opacity-50" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {radioBlackout && (
                    <div className="mt-auto p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3 text-red-500 font-bold text-sm">
                        <Mic2 className="w-5 h-5" /> RADIO BLACKOUT ACTIVE
                      </div>
                      <button 
                        onClick={() => {
                          setRadioBlackout(false);
                          addTacticalLog('COMMS RESTORED: Redundant Cellular Push-to-Talk Protocol Activated.');
                        }}
                        className="px-4 py-2 bg-red-500 text-white text-xs font-black rounded-lg hover:bg-red-600 transition-colors"
                      >
                        ACTIVATE REDUNDANT CHANNELS
                      </button>
                    </div>
                  )}

                  <div className="mt-auto pt-6 flex flex-col sm:flex-row justify-between gap-4 border-t border-slate-800">
                    <button 
                      onClick={() => {
                        addTacticalLog('ATMIST Logged: A: Clear | T: Trauma | M: Leg Amp | I: Bleed Control | S: Stable | T: 04:30');
                        setAtmistGenerated(true);
                      }}
                      className={`flex-1 p-3 border rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${atmistGenerated ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                      <FileText className="w-4 h-4" /> GENERATE ATMIST LOG
                    </button>
                    <button 
                      onClick={handleFinishDrill}
                      className="flex-1 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[10px] font-black text-amber-500 hover:bg-amber-500 hover:text-amber-950 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> INITIATE TACTICAL HANDOVER
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Roles & Logs */}
              <div className="col-span-12 lg:col-span-3 space-y-6 flex flex-col lg:overflow-hidden">
                <section className="bg-[#0a0f1a] border border-slate-800 rounded-2xl p-5 space-y-4 shrink-0">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    ICS Roster
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:space-y-3">
                    {Object.entries(roles).map(([role, name]) => (
                      <div key={role} className="flex flex-col gap-0.5">
                        <div className="text-[8px] uppercase tracking-widest text-slate-600 font-bold">{role.replace(/([A-Z])/g, ' $1').trim()}</div>
                        <div className="text-xs font-bold text-slate-300">{name}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-[#0a0f1a] border border-slate-800 rounded-2xl p-5 flex-1 min-h-[300px] lg:min-h-0 flex flex-col gap-4 lg:overflow-hidden">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                    Radio & Tactical Log
                  </h3>
                  <div className="flex-1 lg:overflow-y-auto space-y-3 lg:pr-2 custom-scrollbar text-[10px] font-mono">
                    {tacticalLog.map((log, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-amber-500/50 shrink-0">[{log.time}]</span>
                        <span className="text-slate-400 leading-relaxed">{log.msg}</span>
                      </div>
                    ))}
                    {tacticalLog.length === 0 && (
                      <div className="text-slate-600 italic">Awaiting radio transmissions...</div>
                    )}
                  </div>
                </section>

                <section className="bg-[#0a0f1a] border border-slate-800 rounded-2xl p-5 shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Injects</h3>
                    <span className="px-2 py-0.5 bg-slate-800 rounded text-[9px] text-slate-500 font-bold">{activeInjects.length} Active</span>
                  </div>
                  <div className="space-y-2">
                    {activeInjects.length > 0 ? (
                      activeInjects.map(i => (
                        <div key={i} className="text-[9px] font-bold text-red-500 animate-pulse bg-red-500/5 border border-red-500/20 px-2 py-1 rounded">
                          ! {i.toUpperCase()}
                        </div>
                      ))
                    ) : (
                      <div className="text-[9px] text-slate-600">No active system failures.</div>
                    )}
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
          )}

          {/* RESULT PHASE */}
          {phase === 'RESULT' && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-8 py-8"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex p-4 bg-amber-500/10 rounded-full border border-amber-500/30 mb-4">
                  <CheckCircle2 className="w-12 h-12 text-amber-500" />
                </div>
                <h2 className="text-4xl font-black text-white tracking-tight">Mission Debrief Complete</h2>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 mt-8">
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-1">Operational Score</div>
                    <div className="text-6xl font-black text-amber-500 font-mono tracking-tighter">{score}</div>
                  </div>
                  <div className="hidden sm:block h-20 w-px bg-slate-800" />
                  <div className="text-center sm:text-left space-y-1">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Compliance Status</div>
                    <div className={`text-xl font-bold ${score >= 80 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {score >= 80 ? 'GACA MISSION CERTIFIED' : 'RE-DRILL REQUIRED'}
                    </div>
                    <div className="text-xs text-slate-500">Subject to post-incident technical review.</div>
                  </div>
                </div>
              </div>

              {/* Decision Analysis */}
              <div className="bg-[#0a0f1a] border border-slate-800 rounded-2xl p-6 space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" /> Tactical Decision Analysis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold">Correct Decisions Executed</div>
                    <div className="space-y-2">
                      {executedActions.length > 0 ? executedActions.map(action => (
                        <div key={action} className="flex items-center gap-3 text-sm text-slate-300 bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          {action}
                        </div>
                      )) : <div className="text-xs text-slate-600 italic">No tactical actions recorded.</div>}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="text-[10px] uppercase tracking-widest text-red-500 font-bold">Critical Tactical Omissions</div>
                    <div className="space-y-2">
                      {[
                        'Establish ICP', 'Contain vs Evac', 'Isolate Power', 'PASS Attack', 
                        'A-B-C-D Survey', 'CPR Cycle', 'L-R Sweep', 'Transmit L-N-N-H'
                      ].filter(a => !executedActions.includes(a)).map(action => (
                        <div key={action} className="flex items-center gap-3 text-sm text-slate-400 bg-red-500/5 border border-red-500/20 px-3 py-2 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
                <div className="bg-[#0a0f1a] border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Operational Successes
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-tight">Identify systemic strengths and procedures that were executed effectively during the drill.</p>
                  <div className="space-y-3">
                    {plusDelta.plus.map((p, i) => (
                      <input 
                        key={i}
                        type="text"
                        placeholder={`Success Area ${i + 1}`}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50"
                        value={p}
                        onChange={(e) => {
                          const next = [...plusDelta.plus];
                          next[i] = e.target.value;
                          setPlusDelta({ ...plusDelta, plus: next });
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-[#0a0f1a] border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-xs font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <RefreshCcw className="w-4 h-4" /> Behavioral Improvement Areas
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-tight">Highlight points of friction, communication delays, or behavioral areas needing refinement.</p>
                  <div className="space-y-3">
                    {plusDelta.delta.map((d, i) => (
                      <input 
                        key={i}
                        type="text"
                        placeholder={`Friction Area ${i + 1}`}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500/50"
                        value={d}
                        onChange={(e) => {
                          const next = [...plusDelta.delta];
                          next[i] = e.target.value;
                          setPlusDelta({ ...plusDelta, delta: next });
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-8">
                <button 
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors font-bold text-sm"
                >
                  <LogOut className="w-4 h-4" /> ABORT MISSION
                </button>
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                  <button 
                    onClick={() => setPhase('FINAL_DASHBOARD')}
                    disabled={plusDelta.plus.some(p => !p.trim()) || plusDelta.delta.some(d => !d.trim())}
                    className="w-full sm:w-auto px-12 py-4 bg-amber-500 text-amber-950 font-black rounded-xl hover:bg-amber-400 transition-all disabled:opacity-30 disabled:grayscale text-lg shadow-[0_0_30px_rgba(245,158,11,0.2)]"
                  >
                    SUBMIT FINAL REPORT
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* FINAL DASHBOARD PHASE */}
          {phase === 'FINAL_DASHBOARD' && (
            <motion.div 
              key="final"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-4xl mx-auto space-y-8 py-8 px-4"
            >
              <div className="text-center space-y-6">
                <div className="text-[10px] uppercase tracking-[0.4em] text-amber-500 font-bold">Official GACA Certification Record</div>
                <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tighter uppercase">Mission Dashboard</h2>
                
                <div className="bg-[#0a0f1a] border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-around gap-8">
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Final Performance Score</div>
                    <div className="text-7xl sm:text-8xl font-black text-amber-500 font-mono tracking-tighter">{score}</div>
                  </div>
                  <div className="h-24 w-px bg-slate-800 hidden md:block" />
                  <div className="text-left space-y-2">
                    <div className="text-xs text-slate-500 uppercase tracking-widest">Compliance Status</div>
                    <div className={`text-2xl sm:text-3xl font-black ${score >= 80 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {score >= 80 ? 'MISSION CERTIFIED' : 'RE-DRILL REQUIRED'}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-xs">
                      {score >= 80 
                        ? 'Operational metrics meet GACA Part 139 readiness standards for King Salman International Airport.' 
                        : 'Significant tactical omissions identified. Technical remediation and secondary assessment required.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    onClick={downloadDossier}
                    className="flex items-center justify-center gap-3 p-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl transition-all shadow-xl"
                  >
                    <Download className="w-6 h-6" />
                    DOWNLOAD TECHNICAL DOSSIER
                  </button>
                  <button 
                    onClick={sendWhatsApp}
                    className="flex items-center justify-center gap-3 p-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-xl"
                  >
                    <Radio className="w-6 h-6" />
                    SEND VIA WHATSAPP
                  </button>
                </div>

                <button 
                  onClick={() => window.location.reload()}
                  className="text-slate-500 hover:text-white transition-colors font-bold text-xs uppercase tracking-widest pt-4"
                >
                  Return to Main Lobby
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(51, 65, 85, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(245, 158, 11, 0.3);
        }
      `}</style>
    </div>
  );
}
