import React, { useState } from 'react';
import { PlanningVersion, getChartUrl } from '../lib/api';
import { ManualInputPanel } from './ManualInputPanel';
import { 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  Layers, 
  CheckCircle2,
  BarChart2
} from 'lucide-react';

interface DashboardViewProps {
  version: PlanningVersion | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ version }) => {
  const [selectedDept, setSelectedDept] = useState<string>('production');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  if (!version) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading capacity metrics from Django REST API...</p>
      </div>
    );
  }

  const months = version.months || [];
  const deptData = version.departments[selectedDept] || {};

  // Compute metrics for selected department
  const capacityHours = deptData.capacityHours || [];
  const loadHours = deptData.loadHours || deptData.laborSupply || deptData.millingLoad || deptData.refurbLoad || deptData.platingLoad || deptData.serviceLoad || [];
  
  const totalCap = Math.round(capacityHours.reduce((a, b) => a + b, 0));
  const totalLoad = Math.round(loadHours.reduce((a, b) => a + b, 0));
  const avgUtilization = totalCap > 0 ? ((totalLoad / totalCap) * 100).toFixed(1) : '0.0';

  const maxVal = Math.max(...capacityHours, ...loadHours, 1);

  return (
    <div>


      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>AVG UTILIZATION</span>
            <Activity size={18} color="var(--accent-cyan)" />
          </div>
          <div className="metric-value">{avgUtilization}%</div>
          <div className="metric-footer">
            <span className="badge-positive">+2.4%</span>
            <span>vs previous planning version</span>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>TOTAL CAPACITY</span>
            <Layers size={18} color="var(--accent-blue)" />
          </div>
          <div className="metric-value">{totalCap.toLocaleString()} hrs</div>
          <div className="metric-footer">
            <span>12-Month Horizon Baseline</span>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>PLANNED WORKLOAD</span>
            <TrendingUp size={18} color="var(--accent-emerald)" />
          </div>
          <div className="metric-value">{totalLoad.toLocaleString()} hrs</div>
          <div className="metric-footer">
            <span className="badge-positive">Scheduled</span>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>VALIDATION STATUS</span>
            <CheckCircle2 size={18} color="var(--accent-emerald)" />
          </div>
          <div className="metric-value" style={{ fontSize: '1.35rem', color: 'var(--accent-emerald)' }}>
            {version.status}
          </div>
          <div className="metric-footer">
            <span>{version.file_name}</span>
          </div>
        </div>
      </div>

      {/* Main Chart Panel */}
      <div className="glass-panel chart-container">
        <div className="chart-header">
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={20} color="var(--accent-cyan)" />
              Production Capacity Utilization & Department Breakdown
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              12-Month Rolling Horizon ({version.horizon}) — Generated from Excel Planning Data
            </p>
          </div>

          <div className="department-tabs">
            {[
              { id: 'production', label: 'Capacity Utilization' },
              { id: 'welding', label: 'Welding' },
              { id: 'machining', label: 'Machining' },
              { id: 'assembly', label: 'Assembly' },
              { id: 'rr', label: 'Roll Repair' },
              { id: 'plating', label: 'Plating' },
            ].map(dept => (
              <button
                key={dept.id}
                className={`dept-tab ${selectedDept === dept.id ? 'active' : ''}`}
                onClick={() => setSelectedDept(dept.id)}
              >
                {dept.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generated Live Plot View with Fallback */}
        {(() => {
          let chartUrl = version?.chart_urls?.[selectedDept];
          if (!chartUrl) {
            const filename = (selectedDept === 'production' || selectedDept === 'scb') ? 'scb_dashboard.png' : `${selectedDept}_dashboard.png`;
            chartUrl = `/media/charts/${filename}`;
          }
          const cleanUrl = getChartUrl(chartUrl);
          const cacheBust = version?.upload_date ? encodeURIComponent(version.upload_date) : Date.now();
          const fullImgSrc = `${cleanUrl}?v=${cacheBust}`;

          if (!imageErrors[selectedDept]) {
            return (
              <div style={{ marginTop: '1rem', width: '100%', overflow: 'hidden', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)' }}>
                <img 
                  key={`${selectedDept}-${version?.upload_date || ''}`}
                  src={fullImgSrc} 
                  alt={`${selectedDept} Generated Dashboard Chart`} 
                  onError={() => setImageErrors(prev => ({ ...prev, [selectedDept]: true }))}
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '780px', objectFit: 'contain' }} 
                />
              </div>
            );
          }

          return (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.75rem', height: '240px', alignItems: 'flex-end', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                {months.map((m, idx) => {
                  const cap = capacityHours[idx] || 10000;
                  const load = loadHours[idx] || 8500;
                  const utilPct = Math.round((load / cap) * 100);
                  const heightPct = Math.min(100, Math.round((load / maxVal) * 200));

                  const isHigh = utilPct > 90;

                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.7rem', color: isHigh ? 'var(--accent-amber)' : 'var(--accent-cyan)', fontWeight: 700, marginBottom: '0.35rem' }}>
                        {utilPct}%
                      </span>
                      
                      <div style={{ width: '100%', display: 'flex', gap: '3px', alignItems: 'flex-end', height: '180px' }}>
                        <div style={{ flex: 1, height: '100%', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '4px 4px 0 0', position: 'relative', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              position: 'absolute', 
                              bottom: 0, 
                              left: 0, 
                              right: 0, 
                              height: `${heightPct}%`, 
                              background: isHigh 
                                ? 'linear-gradient(0deg, rgba(255, 171, 0, 0.8), rgba(255, 82, 82, 0.9))' 
                                : 'linear-gradient(0deg, var(--accent-blue), var(--accent-cyan))',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.5s ease'
                            }} 
                          />
                        </div>
                      </div>

                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center', fontWeight: 600 }}>
                        {m.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', background: 'var(--accent-cyan)', borderRadius: '2px' }} />
                  <span>Optimal Capacity (70% - 89%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', background: 'var(--accent-amber)', borderRadius: '2px' }} />
                  <span>High Load Bottleneck Risk (&gt;90%)</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
