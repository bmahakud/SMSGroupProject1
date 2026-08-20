'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  Layers,
  CheckCircle2,
  Calendar,
  Wrench,
  RefreshCw,
  Clock,
  MapPin,
  Building,
  User,
  Hash,
  Scale,
} from 'lucide-react';
import { fetchBackendProjects, ProjectTaskMonthlyDistribution } from '../lib/api';

export const BackendProjectProgress: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);

  const loadProjects = async () => {
    setLoadingProjects(true);
    let combinedProjects: any[] = [];

    // 1. Fetch backend projects from Django REST API
    try {
      const apiProjects = await fetchBackendProjects();
      if (apiProjects && apiProjects.length > 0) {
        combinedProjects = [...apiProjects];
      }
    } catch (e) {
      console.warn('Backend fetch warning:', e);
    }

    // 2. Read local storage projects created in Project Planning View
    try {
      const savedLocal = localStorage.getItem('sms_project_planning');
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        parsed.forEach((lp: any) => {
          const exists = combinedProjects.some(
            (bp) => bp.project_number === lp.projectNumber || bp.projectNumber === lp.projectNumber
          );
          if (!exists) {
            combinedProjects.push(lp);
          }
        });
      }
    } catch (e) {
      console.error('Local projects read error:', e);
    }

    setProjects(combinedProjects);
    setLoadingProjects(false);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Helper to calculate Welding 15% distribution if not already computed on project object
  const getWeldingDistribution = (allocatedHours: number, durationMonths: number, startDateStr?: string): ProjectTaskMonthlyDistribution[] => {
    if (!allocatedHours || allocatedHours <= 0) return [];
    const duration = durationMonths && durationMonths > 0 ? durationMonths : 3;

    const startDt = startDateStr ? new Date(startDateStr) : new Date(2026, 7, 1);
    const monthsList: ProjectTaskMonthlyDistribution[] = [];

    if (duration === 1) {
      const label = startDt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthsList.push({
        month_index: 1,
        month_label: label,
        hours: allocatedHours,
        percentage: 100.0,
      });
      return monthsList;
    }

    const month1Hours = Math.round(allocatedHours * 0.15 * 100) / 100;
    const remainingHours = allocatedHours - month1Hours;
    const remainingMonthsCount = duration - 1;
    const baseRemaining = Math.round((remainingHours / remainingMonthsCount) * 100) / 100;

    let accumulated = month1Hours;

    for (let i = 0; i < duration; i++) {
      const curDate = new Date(startDt.getFullYear(), startDt.getMonth() + i, 1);
      const label = curDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (i === 0) {
        monthsList.push({
          month_index: 1,
          month_label: label,
          hours: month1Hours,
          percentage: 15.0,
        });
      } else {
        let mHours = baseRemaining;
        if (i === duration - 1) {
          mHours = Math.round((allocatedHours - accumulated) * 100) / 100;
        }
        accumulated += mHours;
        const pct = Math.round((mHours / allocatedHours) * 1000) / 10;
        monthsList.push({
          month_index: i + 1,
          month_label: label,
          hours: mHours,
          percentage: pct,
        });
      }
    }
    return monthsList;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* HEADER BANNER */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, rgba(13, 25, 48, 0.9) 0%, rgba(10, 16, 30, 0.95) 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(0, 210, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 210, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ padding: '0.65rem', background: 'rgba(0, 210, 255, 0.15)', borderRadius: '10px' }}>
              <Layers size={24} color="var(--accent-cyan)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.15rem', fontWeight: 800 }}>
                  Project Planning Breakdown & Task Progress Summary
                </h3>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.2rem 0.6rem',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '20px',
                    color: '#10b981',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={12} /> Read-Only Progress Display
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Calculated monthly capacity progress for all created projects, adhering strictly to task-based ramp-up rules (e.g. Welding: 15% Month 1, equal split remaining).
              </p>
            </div>
          </div>

          <button
            onClick={loadProjects}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1rem',
              background: 'rgba(0, 210, 255, 0.1)',
              border: '1px solid rgba(0, 210, 255, 0.3)',
              borderRadius: '8px',
              color: 'var(--accent-cyan)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loadingProjects ? 'animate-spin' : ''} /> Refresh Summary
          </button>
        </div>
      </div>

      {/* SAVED PROJECTS & CALCULATED MONTHLY BREAKDOWN DISPLAY */}
      <div
        className="glass-panel"
        style={{
          padding: '1.5rem',
          background: 'rgba(10, 16, 30, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.05rem', fontWeight: 800 }}>
            Planned Projects & Calculated Monthly Task Hours ({projects.length})
          </h3>
        </div>

        {projects.length === 0 ? (
          <div
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.5)',
              borderRadius: '10px',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
            }}
          >
            <Layers size={32} color="var(--accent-cyan)" style={{ marginBottom: '0.75rem', opacity: 0.8 }} />
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>No Projects Created Yet</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Add a new project in the <strong>Project Planning</strong> section to view its detailed monthly capacity breakdown here.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {projects.map((proj, pIdx) => {
              const customerName = proj.customer_name || proj.customerName || proj.project_name || proj.projectName || `Customer #${pIdx + 1}`;
              const wbsNo = proj.wbs_no || proj.wbsNo || proj.project_number || proj.projectNumber || `WBS-2026-00${pIdx + 1}`;
              const projectCode = proj.project_code || proj.projectCode || wbsNo;
              const location = proj.location || 'N/A';
              const eqName = proj.equipment_name || proj.equipmentName || 'N/A';
              const eqWeight = proj.equipment_weight || proj.equipmentWeight || 'N/A';
              const manager = proj.project_manager || proj.projectManager || 'N/A';
              const zeroDate = proj.zero_date || proj.startDate || 'N/A';
              const cdd = proj.cdd || proj.endDate || 'N/A';
              const totalHours = Number(proj.total_planned_hours || proj.plannedHours || 0);

              // Extract tasks
              let tasksList: any[] = [];
              if (proj.tasks && proj.tasks.length > 0) {
                tasksList = proj.tasks;
              } else if (proj.task) {
                tasksList = [{
                  task_name: proj.task,
                  task_code: strCode(proj.task),
                  allocated_hours: totalHours,
                  duration_months: 3,
                  location: proj.location || '',
                  smi: proj.smi || '',
                  labour_supply: proj.labourSupply || proj.labour_supply || '',
                  job_contractor: proj.jobContractor || proj.job_contractor || '',
                }];
              }

              return (
                <div
                  key={proj.id || wbsNo + pIdx}
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    borderRadius: '12px',
                    padding: '1.25rem 1.5rem',
                    border: '1px solid rgba(0, 210, 255, 0.25)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  {/* PROJECT HEADER INFORMATION (READ ONLY) */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      paddingBottom: '1rem',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      marginBottom: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.6rem',
                            background: 'rgba(0, 210, 255, 0.15)',
                            color: 'var(--accent-cyan)',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            border: '1px solid rgba(0, 210, 255, 0.3)',
                          }}
                        >
                          WBS: {wbsNo}
                        </span>
                        {projectCode && projectCode !== wbsNo && (
                          <span
                            style={{
                              padding: '0.25rem 0.6rem',
                              background: 'rgba(168, 85, 247, 0.15)',
                              color: '#a855f7',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                            }}
                          >
                            Code: {projectCode}
                          </span>
                        )}
                        <h4 style={{ margin: 0, color: '#ffffff', fontSize: '1.1rem', fontWeight: 800 }}>
                          Customer: {customerName}
                        </h4>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '1.2rem',
                          marginTop: '0.6rem',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <span>Location: <strong style={{ color: 'var(--accent-cyan)' }}>{location}</strong></span>
                        <span>Equipment: <strong style={{ color: '#fff' }}>{eqName}</strong> ({eqWeight} kg)</span>
                        <span>Manager: <strong style={{ color: '#fff' }}>{manager}</strong></span>
                        <span>Zero Date: <strong style={{ color: 'var(--accent-emerald)' }}>{zeroDate}</strong></span>
                        <span>CDD: <strong style={{ color: 'var(--accent-cyan)' }}>{cdd}</strong></span>
                      </div>
                    </div>


                    <div
                      style={{
                        padding: '0.6rem 1rem',
                        background: 'rgba(0, 210, 255, 0.08)',
                        borderRadius: '8px',
                        border: '1px solid rgba(0, 210, 255, 0.2)',
                        textAlign: 'right',
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Total Planned Hours
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '0.1rem' }}>
                        {totalHours.toLocaleString()} hrs
                      </div>
                    </div>
                  </div>

                  {/* TASKS BREAKDOWN SECTION (READ ONLY) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {tasksList.map((taskItem, tIdx) => {
                      const tName = taskItem.task_name || taskItem.name || taskItem.task || 'Welding';
                      const tCode = taskItem.task_code || strCode(tName);
                      const tHours = Number(taskItem.allocated_hours || taskItem.hours || totalHours);
                      const tDuration = Number(taskItem.duration_months || taskItem.duration || 3);
                      const location = taskItem.location || '';
                      const smi = taskItem.smi || '';
                      const labourSupply = taskItem.labour_supply || taskItem.labourSupply || '';
                      const jobContractor = taskItem.job_contractor || taskItem.jobContractor || '';

                      // Get distributions
                      let distributions: ProjectTaskMonthlyDistribution[] = [];
                      if (taskItem.monthly_distributions && taskItem.monthly_distributions.length > 0) {
                        distributions = taskItem.monthly_distributions;
                      } else {
                        distributions = getWeldingDistribution(tHours, tDuration, zeroDate);
                      }

                      return (
                        <div
                          key={tIdx}
                          style={{
                            background: 'rgba(10, 16, 30, 0.8)',
                            borderRadius: '10px',
                            padding: '1rem 1.25rem',
                            border: '1px solid rgba(255, 255, 255, 0.07)',
                          }}
                        >
                          {/* TASK SUB HEADER */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '0.75rem',
                              marginBottom: '0.85rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                              <Wrench size={18} color="var(--accent-cyan)" />
                              <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.95rem' }}>
                                Task: {tName}
                              </span>

                              {location && (
                                <span style={{ padding: '0.15rem 0.5rem', background: 'rgba(58, 123, 213, 0.2)', color: 'var(--accent-blue)', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                  Location: {location}
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              Allocated: <strong style={{ color: 'var(--accent-cyan)' }}>{tHours.toLocaleString()} hrs</strong> ({tDuration} Months Duration)
                            </div>
                          </div>

                          {/* MONTHLY BREAKDOWN CARDS */}
                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`, gap: '0.75rem' }}>
                            {distributions.map((m) => (
                              <div
                                key={m.month_index}
                                style={{
                                  padding: '0.7rem 0.8rem',
                                  background: m.month_index === 1 ? 'rgba(0, 210, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                                  border: m.month_index === 1 ? '1px solid rgba(0, 210, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                                  borderRadius: '8px',
                                  textAlign: 'center',
                                }}
                              >
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                                  Month {m.month_index} ({m.month_label})
                                </div>

                                <div
                                  style={{
                                    fontSize: '1.15rem',
                                    fontWeight: 800,
                                    color: m.month_index === 1 ? 'var(--accent-cyan)' : '#ffffff',
                                    marginTop: '0.2rem',
                                  }}
                                >
                                  {m.hours.toLocaleString()} hrs
                                </div>

                                <div
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: Math.abs(m.percentage - 15.0) < 0.1 ? '#00d2ff' : '#10b981',
                                    marginTop: '0.15rem',
                                  }}
                                >
                                  {m.percentage}% {Math.abs(m.percentage - 15.0) < 0.1 ? '(15% Ramp-up)' : '(Equal Split)'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

function strCode(val: any): string {
  return String(val || '').toLowerCase().replace(/\s+/g, '_');
}
