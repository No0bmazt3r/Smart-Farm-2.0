/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Droplets, 
  Thermometer, 
  Wind, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Zap, 
  ZapOff,
  Leaf,
  Bug
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

// Register Chart.js models
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement
);

// Types based on the expected response
interface BlockData {
  block: string;
  moisture: number;
  temperature: number;
  humidity: number;
  sprinkler: boolean;
  status: 'optimal' | 'low' | 'high' | 'critical';
  last_updated: string;
}

interface ActivityEvent {
  timestamp: string;
  event: string;
  triggered_by: string;
}

interface SystemStatus {
  alert_active: boolean;
  alert_message: string;
  last_command: string;
  last_command_time: string;
}

interface DashboardData {
  blocks: BlockData[];
  system: SystemStatus;
  activity: ActivityEvent[];
}

// Utils
const formatMYTime = (isoString: string) => {
  try {
    return new Date(isoString).toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return 'N/A';
  }
};

const getStatusColor = (level: number) => {
  if (level <= 30) return '#ef4444'; // Red
  if (level <= 60) return '#f59e0b'; // Yellow
  if (level <= 80) return '#10b981'; // Green
  return '#3b82f6'; // Blue
};

// Components
const ConnectionStatusIndicator: React.FC<{ lastSynced: number, connected: boolean }> = ({ lastSynced, connected }) => (
  <div className="flex items-center bg-[#1f2937] rounded-lg px-3 py-1.5 space-x-3">
    <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-[#10b981] animate-pulse' : 'bg-[#ef4444]'}`} />
    <div className="flex flex-col">
      <span className="text-[10px] leading-none font-bold">{connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
      <span className="text-[9px] text-[#9ca3af]">Last synced: {lastSynced}s ago</span>
    </div>
  </div>
);

const Gauge: React.FC<{ value: number, label: string }> = ({ value, label }) => {
  const color = getStatusColor(value);
  
  const data = {
    datasets: [{
      data: [value, 100 - value],
      backgroundColor: [color, '#1f2937'],
      borderWidth: 0,
      circumference: 240,
      rotation: 240,
      cutout: '80%',
    }]
  };

  const options = {
    plugins: {
      tooltip: { enabled: false },
      legend: { display: false }
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  return (
    <div className="relative w-40 h-40 mx-auto">
      <Doughnut data={data} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
        <span className="text-3xl font-bold" style={{ color }}>{value}%</span>
        <span className="text-[10px] text-[#9ca3af] uppercase font-semibold tracking-tighter">{label}</span>
      </div>
      {/* Water fill effect for optimal+ levels */}
      {value > 60 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-12 h-1 overflow-hidden rounded-full opacity-50">
          <div className="w-full h-full bg-[#3b82f6] animate-pulse" />
        </div>
      )}
    </div>
  );
};

const Sparkline: React.FC<{ history: number[] }> = ({ history }) => {
  const data = {
    labels: history.map((_, i) => i),
    datasets: [{
      data: history,
      borderColor: '#10b981',
      borderWidth: 1,
      pointRadius: 0,
      tension: 0.4,
      fill: false,
    }]
  };

  const options = {
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false, min: 0, max: 100 }
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  return (
    <div className="h-8 w-full mt-2 opacity-50">
      <Line data={data} options={options} />
    </div>
  );
};

interface BlockCardProps {
  data: BlockData;
  history: number[];
}

const BlockCard: React.FC<BlockCardProps> = ({ data, history }) => {
  const isCritical = data.moisture <= 30;
  const isWarning = data.moisture > 30 && data.moisture <= 60;
  
  return (
    <motion.div 
      layout
      className={`relative bg-[#111827] border rounded-xl p-6 flex flex-col transition-all duration-300 overflow-hidden group ${
        isCritical ? 'border-[#ef4444] border-2 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 
        isWarning ? 'border-[#f59e0b]/30' : 'border-[#10b981]/30'
      }`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {/* Watermark Illustration */}
      <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none ${
        isCritical ? 'text-[#ef4444]' : isWarning ? 'text-[#f59e0b]' : 'text-[#10b981]'
      }`}>
        {data.moisture < 40 ? <Droplets size={120} /> : data.moisture > 80 ? <Bug size={120} /> : <Leaf size={120} />}
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#f9fafb]">{data.block}</h2>
          <span className="text-[10px] text-[#9ca3af] uppercase tracking-widest font-semibold">
            {data.block === 'Block A' ? 'North-East Sector' : data.block === 'Block B' ? 'Central Sector' : 'South Sector'}
          </span>
        </div>
        <div className={`px-2 py-1 border text-[10px] font-bold rounded uppercase tracking-wider ${
          data.status === 'optimal' ? 'bg-[#10b981]/10 border-[#10b981]/40 text-[#10b981]' : 
          data.status === 'critical' ? 'bg-[#ef4444]/20 border-[#ef4444] text-[#ef4444]' :
          'bg-[#f59e0b]/10 border-[#f59e0b]/40 text-[#f59e0b]'
        }`}>
          {data.status}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <Gauge value={data.moisture} label="Soil Moisture" />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="bg-[#0a0d14] p-3 rounded-lg border border-[#1f2937] transition-colors hover:border-[#3b82f6]/50">
          <span className="text-[#9ca3af] text-[10px] uppercase block mb-1 font-bold">Temp</span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold">{data.temperature}°C</span>
            <span className="text-lg">{data.temperature > 30 ? '☀️' : data.temperature > 25 ? '🌤️' : '🌥️'}</span>
          </div>
        </div>
        <div className="bg-[#0a0d14] p-3 rounded-lg border border-[#1f2937] transition-colors hover:border-[#3b82f6]/50">
          <span className="text-[#9ca3af] text-[10px] uppercase block mb-1 font-bold">Humidity</span>
          <span className="text-xl font-bold">{data.humidity}%</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {data.sprinkler ? (
            <>
              <div className="w-2.5 h-2.5 bg-[#10b981] rounded-full sprinkler-on" />
              <span className="text-xs text-[#10b981] font-bold">Sprinkler ON</span>
            </>
          ) : (
            <>
              <div className="w-2.5 h-2.5 bg-[#4b5563] rounded-full" />
              <span className="text-xs text-[#9ca3af]">Sprinkler OFF</span>
            </>
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-[#4b5563] tabular-nums">Sync: {formatMYTime(data.last_updated)}</span>
          <div className="w-24 h-1 mt-1">
            <Sparkline history={history} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastSynced, setLastSynced] = useState(0);
  const [historyMap, setHistoryMap] = useState<Record<string, number[]>>({});
  
  // Refs to avoid re-renders on every tick
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const counterTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = async () => {
    try {
      const startTime = Date.now();
      const res = await fetch('/api/dashboard-data');
      if (!res.ok) throw new Error('Fetch failed');
      const json: DashboardData = await res.json();
      
      setData(json);
      setConnected(true);
      setLastSynced(0);

      // Update history for sparklines
      setHistoryMap(prev => {
        const newMap = { ...prev };
        json.blocks.forEach(b => {
          if (!newMap[b.block]) {
            // Generate some fake historical data on load
            newMap[b.block] = Array.from({ length: 9 }, () => Math.max(0, b.moisture + Math.floor(Math.random() * 10 - 5)));
            newMap[b.block].push(b.moisture);
          } else {
            const h = [...newMap[b.block]];
            h.push(b.moisture);
            if (h.length > 10) h.shift();
            newMap[b.block] = h;
          }
        });
        return newMap;
      });

    } catch (e) {
      setConnected(false);
    }
  };

  useEffect(() => {
    fetchData(); // Initial fetch
    
    syncTimerRef.current = setInterval(fetchData, 3000);
    counterTimerRef.current = setInterval(() => {
      setLastSynced(s => s + 1);
    }, 1000);

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      if (counterTimerRef.current) clearInterval(counterTimerRef.current);
    };
  }, []);

  const anyCritical = useMemo(() => {
    return data?.blocks.some(b => b.moisture <= 30) || false;
  }, [data]);

  const criticalBlock = useMemo(() => {
    return data?.blocks.find(b => b.moisture <= 30);
  }, [data]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0d14] text-[#f9fafb] font-sans overflow-hidden select-none">
      <style>{`
        .sprinkler-on {
          width: 12px;
          height: 12px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>

      {/* SYSTEM STATUS BAR */}
      <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-[#111827] border-b border-[#1f2937] z-30 shadow-2xl">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${anyCritical ? 'bg-[#ef4444] animate-pulse' : 'bg-[#10b981]'}`}></div>
            <span className="text-lg font-black tracking-tighter">SMART FARM OS v2.4</span>
          </div>
          <div className="h-8 w-px bg-[#1f2937]"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#9ca3af] uppercase tracking-widest font-bold">System Status</span>
            <span className={`${anyCritical ? 'text-[#ef4444]' : 'text-[#10b981]'} text-sm font-medium`}>
              {anyCritical ? `WARNING: Critical Moisture in ${criticalBlock?.block}` : 'ALL SYSTEMS OPTIMAL'}
            </span>
          </div>
          <div className="hidden lg:flex flex-col border-l border-[#1f2937] pl-6">
            <span className="text-[10px] text-[#9ca3af] uppercase tracking-widest font-bold">Last Command</span>
            <span className="text-white text-sm">
              {data?.system.last_command || 'Listening...'} 
              <span className="text-[#9ca3af] ml-2 text-xs font-mono">{formatMYTime(data?.system.last_command_time || '')}</span>
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] text-[#9ca3af] uppercase tracking-widest font-bold">Active Alerts</span>
            <span className="text-white text-sm font-mono">{anyCritical ? '01' : '00'} Active</span>
          </div>
          <ConnectionStatusIndicator connected={connected} lastSynced={lastSynced} />
        </div>
      </header>

      {/* CRITICAL ALERT BANNER */}
      <AnimatePresence>
        {anyCritical && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#ef4444] text-white py-3 px-6 flex items-center justify-between animate-pulse flex-shrink-0"
          >
            <div className="flex items-center space-x-3 font-black uppercase tracking-tight">
              <AlertTriangle size={24} />
              <span className="text-lg">CRITICAL: {criticalBlock?.block} SOIL MOISTURE AT {criticalBlock?.moisture}% — IRRIGATION REQUIRED</span>
            </div>
            <div className="text-sm bg-black/20 px-3 py-1 rounded font-bold">ACTION PENDING</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN FIELD GRID */}
      <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {data?.blocks?.map(block => (
          <BlockCard 
            key={block.block} 
            data={block} 
            history={historyMap[block.block] || []}
          />
        ))}
      </main>

      {/* ACTIVITY LOG PANEL */}
      <footer className="h-[180px] flex-shrink-0 bg-[#111827] border-t border-[#1f2937] p-4 flex flex-col z-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[#10b981]" />
            <span className="text-xs font-black text-[#9ca3af] uppercase tracking-widest">System Activity Log</span>
          </div>
          <span className="text-[10px] text-[#4b5563] font-mono">Viewing last 10 telemetry events</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-2">
          {data?.activity?.slice().reverse().map((event, i) => {
            const type = event.event.toLowerCase();
            let borderClass = 'border-[#3b82f6]';
            let bgClass = 'bg-[#0a0d14]';
            
            if (type.includes('sprinkler')) {
              borderClass = 'border-[#10b981]';
            } else if (type.includes('alert') || type.includes('critical')) {
              borderClass = 'border-[#ef4444]';
              bgClass = 'bg-[#ef4444]/10';
            } else if (type.includes('system')) {
              borderClass = 'border-gray-600';
            }

            return (
              <div key={i} className={`flex items-center px-4 py-2 rounded ${bgClass} border-l-4 ${borderClass} transition-colors hover:bg-white/5`}>
                <span className="text-[#4b5563] text-[10px] w-24 tabular-nums font-mono">{formatMYTime(event.timestamp)}</span>
                <span className="text-sm text-[#f9fafb] flex-1">
                  {event.event}
                  {event.triggered_by !== 'system' && (
                    <span className="text-[#4b5563] ml-2 text-[10px] italic font-medium opacity-60">(via {event.triggered_by})</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
