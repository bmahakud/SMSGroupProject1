'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Wrench,
  Calendar,
  Clock,
  User,
  Hash,
  Scale,
  Building,
  MapPin,
  Tag,
  Sliders,
  PlusCircle,
  TrendingUp,
  Plus,
  Trash2,
  FolderKanban,
  FileText,
} from 'lucide-react';
import { updateBackendProject } from '../lib/api';
import TaskScheduleSlider from './TaskScheduleSlider';

interface EditTaskItem {
  id: string;
  task_name: string;
  allocated_hours: number | string;
  duration_months: number | string;
  location: string;
  start_date?: string;
  adjustment_month_index: number | string;
  actual_utilized_hours: number | string;
  buffer_month_index: number | string;
  buffer_hours: number | string;
}

interface ProjectDetailsModalProps {
  project: any | null;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: () => void;
}

function getProjectMonthSteps(startDateStr: string, endDateStr: string) {
  const start = startDateStr ? new Date(startDateStr) : new Date(2026, 7, 1);
  let end = endDateStr ? new Date(endDateStr) : new Date(start.getFullYear(), start.getMonth() + 5, 1);
  if (isNaN(start.getTime())) {
    return [{ label: 'Aug 2026', dateStr: '2026-08-01', monthIndex: 0 }];
  }
  if (isNaN(end.getTime()) || end < start) {
    end = new Date(start.getFullYear(), start.getMonth() + 5, 1);
  }

  const steps: { label: string; dateStr: string; monthIndex: number }[] = [];
  let curr = new Date(start.getFullYear(), start.getMonth(), 1);
  let idx = 0;

  while (curr <= end || steps.length < 3) {
    if (steps.length >= 24) break;
    const year = curr.getFullYear();
    const month = String(curr.getMonth() + 1).padStart(2, '0');
    const dateStr = `${year}-${month}-01`;
    const label = curr.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    steps.push({ label, dateStr, monthIndex: idx });
    curr.setMonth(curr.getMonth() + 1);
    idx++;
  }
  return steps;
}

const STANDARD_TASKS = ['Welding', 'Machining', 'Assembly', 'Plating', 'RR'];

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  project,
  isOpen,
  onClose,
  onProjectUpdated,
}) => {
  const [projectMeta, setProjectMeta] = useState<any>({
    id: '',
    customerName: '',
    wbsNo: '',
    projectCode: '',
    location: '',
    equipmentName: '',
    equipmentWeight: '',
    description: '',
    startDate: '',
    endDate: '',
    projectManager: '',
    priority: 'Medium',
    status: 'Planned',
  });

  const [tasks, setTasks] = useState<EditTaskItem[]>([]);
  const [activeTaskIdx, setActiveTaskIdx] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMsg, setSaveMsg] = useState<string>('');

  useEffect(() => {
    if (project) {
      const cName = project.customer_name || project.customerName || project.project_name || project.projectName || '';
      const wbs = project.wbs_no || project.wbsNo || project.project_number || project.projectNumber || '';
      const pCode = project.project_code || project.projectCode || wbs;
      const loc = project.location || '';

      setProjectMeta({
        id: project.id,
        customerName: cName,
        wbsNo: wbs,
        projectCode: pCode,
        location: loc,
        projectName: cName,
        projectNumber: wbs,
        equipmentName: project.equipment_name || project.equipmentName || '',
        equipmentWeight: project.equipment_weight || project.equipmentWeight || '',
        description: project.description || '',
        startDate: project.zero_date || project.startDate || '',
        endDate: project.cdd || project.endDate || '',
        projectManager: project.project_manager || project.projectManager || '',
        priority: project.priority || 'Medium',
        status: project.status || 'Planned',
      });

      // Extract tasks array
      const rawTasks = project.tasks && project.tasks.length > 0 ? project.tasks : null;
      if (rawTasks) {
        const mappedTasks: EditTaskItem[] = rawTasks.map((t: any, idx: number) => ({
          id: t.id || `task_${idx}_${Date.now()}`,
          task_name: t.task_name || t.name || t.task || 'Welding',
          allocated_hours: t.allocated_hours !== undefined ? t.allocated_hours : (t.hours || 3000),
          duration_months: t.duration_months || t.duration || 3,
          location: t.location || loc || 'Khordha',
          start_date: t.start_date || t.zero_date || project.zero_date || project.startDate || '',
          adjustment_month_index: t.adjustment_month_index !== undefined && t.adjustment_month_index !== null ? t.adjustment_month_index : (t.adjustmentMonthIndex || ''),
          actual_utilized_hours: t.actual_utilized_hours !== undefined && t.actual_utilized_hours !== null ? t.actual_utilized_hours : (t.actualUtilizedHours || ''),
          buffer_month_index: t.buffer_month_index !== undefined && t.buffer_month_index !== null ? t.buffer_month_index : (t.bufferMonthIndex || ''),
          buffer_hours: t.buffer_hours !== undefined && t.buffer_hours !== null ? t.buffer_hours : (t.bufferHours || ''),
        }));
        setTasks(mappedTasks);
      } else {
        // Fallback for legacy single task project
        setTasks([
          {
            id: `task_0_${Date.now()}`,
            task_name: project.task || 'Welding',
            allocated_hours: project.total_planned_hours || project.plannedHours || 3000,
            duration_months: project.duration_months || 3,
            location: loc || 'Khordha',
            adjustment_month_index: project.adjustmentMonthIndex || '',
            actual_utilized_hours: project.actualUtilizedHours || '',
            buffer_month_index: project.bufferMonthIndex || '',
            buffer_hours: project.bufferHours || '',
          },
        ]);
      }

      setSaveMsg('');
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleMetaChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setProjectMeta((prev: any) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addTask = () => {
    if (tasks.length >= 5) return;
    const existingNames = tasks.map((t) => t.task_name);
    const nextName = STANDARD_TASKS.find((n) => !existingNames.includes(n)) || 'Machining';
    setTasks((prev) => [
      ...prev,
      {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        task_name: nextName,
        allocated_hours: 3000,
        duration_months: 3,
        location: 'Khordha',
        start_date: projectMeta.startDate || '',
        adjustment_month_index: '',
        actual_utilized_hours: '',
        buffer_month_index: '',
        buffer_hours: '',
      },
    ]);
  };

  const removeTask = (index: number) => {
    if (tasks.length <= 1) return;
    setTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTaskChange = (index: number, field: keyof EditTaskItem, value: any) => {
    setTasks((prev) => {
      const copy = [...prev];
      const updatedTask = { ...copy[index], [field]: value };
      // Enforce Khordha for non-Welding tasks
      if (field === 'task_name' && value !== 'Welding') {
        if (updatedTask.location !== 'Khordha') {
          updatedTask.location = 'Khordha';
        }
      }
      copy[index] = updatedTask;
      return copy;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const cName = projectMeta.customerName || projectMeta.projectName;
    const wbs = projectMeta.wbsNo || projectMeta.projectNumber;
    const pCode = projectMeta.projectCode || wbs;

    const totalPlannedHours = tasks.reduce(
      (sum, t) => sum + (Number(t.allocated_hours) || 0),
      0
    );

    const primaryTask = tasks[0] || {};

    const updatedTasksPayload = tasks.map((t) => {
      const adjMonth = t.adjustment_month_index !== '' && t.adjustment_month_index !== null ? Number(t.adjustment_month_index) : null;
      const actualHours = t.actual_utilized_hours !== '' && t.actual_utilized_hours !== null ? Number(t.actual_utilized_hours) : null;
      const bufMonth = t.buffer_month_index !== '' && t.buffer_month_index !== null ? Number(t.buffer_month_index) : null;
      const bufHours = t.buffer_hours ? Number(t.buffer_hours) : 0;

      return {
        id: t.id,
        task_name: t.task_name,
        task_code: String(t.task_name).toLowerCase().replace(/\s+/g, '_'),
        allocated_hours: Number(t.allocated_hours) || 0,
        duration_months: Number(t.duration_months) || 3,
        start_date: t.start_date || projectMeta.startDate,
        location: t.location || 'Khordha',
        adjustmentMonthIndex: adjMonth,
        adjustment_month_index: adjMonth,
        actualUtilizedHours: actualHours,
        actual_utilized_hours: actualHours,
        bufferMonthIndex: bufMonth,
        buffer_month_index: bufMonth,
        bufferHours: bufHours,
        buffer_hours: bufHours,
      };
    });

    const updatedPayload = {
      customerName: cName,
      customer_name: cName,
      wbsNo: wbs,
      wbs_no: wbs,
      projectCode: pCode,
      project_code: pCode,
      location: primaryTask.location || projectMeta.location || 'Khordha',
      projectName: cName,
      project_name: cName,
      projectNumber: wbs,
      project_number: wbs,
      equipmentName: projectMeta.equipmentName,
      equipment_name: projectMeta.equipmentName,
      equipmentWeight: projectMeta.equipmentWeight,
      equipment_weight: projectMeta.equipmentWeight,
      description: projectMeta.description,
      startDate: projectMeta.startDate,
      zero_date: projectMeta.startDate,
      endDate: projectMeta.endDate,
      cdd: projectMeta.endDate,
      projectManager: projectMeta.projectManager,
      project_manager: projectMeta.projectManager,
      plannedHours: totalPlannedHours,
      total_planned_hours: totalPlannedHours,
      priority: projectMeta.priority,
      status: projectMeta.status,
      task: primaryTask.task_name || 'Welding',
      tasks: updatedTasksPayload,
    };

    // 1. Update backend DB if project.id exists
    if (project.id) {
      await updateBackendProject(project.id, updatedPayload);
    }

    // 2. Update localStorage projects list
    try {
      const savedLocal = localStorage.getItem('sms_project_planning');
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        const updatedList = parsed.map((p: any) => {
          if (
            (project.id && p.id === project.id) ||
            p.projectNumber === projectMeta.projectNumber ||
            p.project_number === projectMeta.projectNumber ||
            p.wbsNo === wbs ||
            p.wbs_no === wbs
          ) {
            return {
              ...p,
              ...updatedPayload,
              id: p.id || project.id,
            };
          }
          return p;
        });
        localStorage.setItem('sms_project_planning', JSON.stringify(updatedList));
      }
    } catch (err) {
      console.warn('LocalStorage save warning:', err);
    }

    setIsSaving(false);
    setSaveMsg('All project tasks updated with individual adjustments & buffers!');
    onProjectUpdated();

    setTimeout(() => {
      setSaveMsg('');
      onClose();
    }, 800);
  };

  // Per-task monthly breakdown preview calculation
  const calculateTaskPreview = (tItem: EditTaskItem) => {
    const baseHours = Number(tItem.allocated_hours) || 0;
    const duration = Number(tItem.duration_months) || 3;
    if (baseHours <= 0 || duration <= 0) return [];

    const taskStartStr = tItem.start_date || projectMeta.startDate;
    const startDt = taskStartStr ? new Date(taskStartStr) : new Date(2026, 7, 1);
    const isWelding = String(tItem.task_name || '').toLowerCase().includes('weld');

    let monthlyHours: number[] = [];

    // 1. Baseline
    if (isWelding && duration > 1) {
      let m1Base = Math.round(baseHours * 0.15 * 100) / 100;
      let remBaseTotal = baseHours - m1Base;
      let remCount = duration - 1;
      let baseRemaining = Math.round((remBaseTotal / remCount) * 100) / 100;
      monthlyHours.push(m1Base);
      for (let i = 1; i < duration; i++) {
        if (i === duration - 1) {
          let sumSoFar = monthlyHours.reduce((a, b) => a + b, 0);
          monthlyHours.push(Math.round((baseHours - sumSoFar) * 100) / 100);
        } else {
          monthlyHours.push(baseRemaining);
        }
      }
    } else {
      let baseRemaining = Math.round((baseHours / duration) * 100) / 100;
      for (let i = 0; i < duration; i++) {
        if (i === duration - 1) {
          let sumSoFar = monthlyHours.reduce((a, b) => a + b, 0);
          monthlyHours.push(Math.round((baseHours - sumSoFar) * 100) / 100);
        } else {
          monthlyHours.push(baseRemaining);
        }
      }
    }

    // 2. Adjustment
    const adjIdx =
      tItem.adjustment_month_index !== '' && tItem.adjustment_month_index !== null
        ? Number(tItem.adjustment_month_index) - 1
        : -1;
    const actualH =
      tItem.actual_utilized_hours !== '' && tItem.actual_utilized_hours !== null
        ? Number(tItem.actual_utilized_hours)
        : null;
    let isAdjustedArr = new Array(duration).fill(false);

    if (adjIdx >= 0 && adjIdx < duration && actualH !== null) {
      isAdjustedArr[adjIdx] = true;
      const plannedVal = monthlyHours[adjIdx];
      const diff = plannedVal - actualH;
      monthlyHours[adjIdx] = actualH;

      const subCount = duration - (adjIdx + 1);
      if (subCount > 0) {
        const addPerMonth = Math.round((diff / subCount) * 100) / 100;
        let accDiff = 0;
        for (let k = adjIdx + 1; k < duration; k++) {
          if (k === duration - 1) {
            monthlyHours[k] = Math.round((monthlyHours[k] + (diff - accDiff)) * 100) / 100;
          } else {
            monthlyHours[k] = Math.round((monthlyHours[k] + addPerMonth) * 100) / 100;
            accDiff += addPerMonth;
          }
        }
      }
    }

    // 3. Buffer
    const bufIdx =
      tItem.buffer_month_index !== '' && tItem.buffer_month_index !== null
        ? Number(tItem.buffer_month_index) - 1
        : -1;
    const bufH = tItem.buffer_hours ? Number(tItem.buffer_hours) : 0;
    let isBufferArr = new Array(duration).fill(false);

    if (bufIdx >= 0 && bufIdx < duration && bufH > 0) {
      isBufferArr[bufIdx] = true;
      monthlyHours[bufIdx] = Math.round((monthlyHours[bufIdx] + bufH) * 100) / 100;
    }

    const totalEffHours = monthlyHours.reduce((a, b) => a + b, 0);

    return monthlyHours.map((h, i) => {
      const d = new Date(startDt.getFullYear(), startDt.getMonth() + i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const pct = totalEffHours > 0 ? Math.round((h / totalEffHours) * 1000) / 10 : 0;

      return {
        month: label,
        hours: h,
        pct: pct,
        index: i + 1,
        isAdjusted: isAdjustedArr[i],
        isBuffer: isBufferArr[i],
      };
    });
  };

  const totalProjectPlannedHours = tasks.reduce(
    (sum, t) => sum + (Number(t.allocated_hours) || 0),
    0
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 11, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0e1726 0%, #090d16 100%)',
          border: '1px solid rgba(0, 210, 255, 0.25)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          color: '#fff',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Building size={20} color="var(--accent-cyan)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Edit Project Details & Tasks: <span style={{ color: 'var(--accent-cyan)' }}>{projectMeta.customerName}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.3rem',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY FORM */}
        <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* PROJECT METADATA SECTION */}
          <div
            style={{
              padding: '1rem 1.25rem',
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
            }}
          >
            <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--accent-cyan)', fontSize: '0.9rem', fontWeight: 800 }}>
              Project Information
            </h4>

            {/* ROW 1: Customer Name & Location */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Customer Name *
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={projectMeta.customerName}
                  onChange={handleMetaChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'rgba(10, 16, 30, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Primary Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={projectMeta.location}
                  onChange={handleMetaChange}
                  placeholder="e.g. Khordha"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'rgba(10, 16, 30, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.88rem',
                  }}
                />
              </div>
            </div>

            {/* ROW 2: WBS No & Project Code */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  WBS No. *
                </label>
                <input
                  type="text"
                  name="wbsNo"
                  value={projectMeta.wbsNo}
                  onChange={handleMetaChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'rgba(10, 16, 30, 0.8)',
                    border: '1px solid rgba(0, 210, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'var(--accent-cyan)',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Project Code
                </label>
                <input
                  type="text"
                  name="projectCode"
                  value={projectMeta.projectCode}
                  onChange={handleMetaChange}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'rgba(10, 16, 30, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.88rem',
                  }}
                />
              </div>
            </div>

            {/* ROW 3: Equipment Name & Equipment Weight */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Equipment Name
                </label>
                <input
                  type="text"
                  name="equipmentName"
                  value={projectMeta.equipmentName}
                  onChange={handleMetaChange}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'rgba(10, 16, 30, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Equipment Weight (kg)
                </label>
                <input
                  type="number"
                  name="equipmentWeight"
                  value={projectMeta.equipmentWeight}
                  onChange={handleMetaChange}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'rgba(10, 16, 30, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.88rem',
                  }}
                />
              </div>
            </div>

            {/* ROW 4: Dates & Project Manager */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Zero Date (Start Date) *
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={projectMeta.startDate}
                  onChange={handleMetaChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'rgba(10, 16, 30, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  CDD (End Date) *
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={projectMeta.endDate}
                  onChange={handleMetaChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'rgba(10, 16, 30, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Project Manager *
                </label>
                <input
                  type="text"
                  name="projectManager"
                  value={projectMeta.projectManager}
                  onChange={handleMetaChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'rgba(10, 16, 30, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.88rem',
                  }}
                />
              </div>
            </div>
          </div>

          {/* PROJECT TASKS SECTION (MULTI-TASK EDITING WITH PER-TASK ADJUSTMENT & BUFFER) */}
          <div
            style={{
              padding: '1.25rem',
              background: 'rgba(0, 210, 255, 0.03)',
              border: '1px solid rgba(0, 210, 255, 0.25)',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div>
                <h4 style={{ margin: 0, color: '#ffffff', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FolderKanban size={18} color="var(--accent-cyan)" />
                  Project Tasks ({tasks.length} / 5 Max)
                </h4>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Each task is managed separately with its own capacity hours, location, and progress adjustments & buffers.
                </p>
              </div>

              <button
                type="button"
                onClick={addTask}
                disabled={tasks.length >= 5}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  background: tasks.length >= 5 ? 'rgba(255,255,255,0.05)' : 'rgba(0, 210, 255, 0.15)',
                  border: '1px solid rgba(0, 210, 255, 0.3)',
                  borderRadius: '7px',
                  color: tasks.length >= 5 ? 'var(--text-dim)' : 'var(--accent-cyan)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: tasks.length >= 5 ? 'not-allowed' : 'pointer',
                }}
              >
                <Plus size={15} /> Add Task ({5 - tasks.length} left)
              </button>
            </div>

            {/* SINGLE MASTER PROJECT KICKOFF TIMELINE SCHEDULE BANNER */}
            {(() => {
              const projectMonthSteps = getProjectMonthSteps(projectMeta.startDate, projectMeta.endDate);
              const colors = ['#00d2ff', '#a855f7', '#10b981', '#f59e0b', '#ec4899'];
              const currentTask = tasks[activeTaskIdx] || tasks[0];
              const currentTaskStartDate = currentTask?.start_date || projectMeta.startDate;
              let activeStepIdx = projectMonthSteps.findIndex((s) => s.dateStr === currentTaskStartDate);
              if (activeStepIdx < 0) activeStepIdx = 0;

              return (
                <div
                  style={{
                    padding: '1.15rem',
                    background: 'linear-gradient(135deg, rgba(14, 23, 38, 0.9) 0%, rgba(9, 13, 22, 0.9) 100%)',
                    border: '1px solid rgba(0, 210, 255, 0.3)',
                    borderRadius: '12px',
                    marginBottom: '1.25rem',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
                  }}
                >
                  {/* BANNER HEADER */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h4 style={{ margin: 0, color: '#ffffff', fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={18} color="var(--accent-cyan)" />
                        Master Project Kickoff Timeline & Schedule
                      </h4>
                      <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.73rem' }}>
                        Visual multi-task Gantt schedule. Adjust kickoff month via single slider or click any task pill below.
                      </p>
                    </div>

                    {currentTask && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0, 210, 255, 0.12)', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid rgba(0, 210, 255, 0.3)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Controlling:</span>
                        <strong style={{ fontSize: '0.78rem', color: colors[activeTaskIdx % colors.length] }}>
                          Task #{activeTaskIdx + 1}: {currentTask.task_name}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* GANTT TRACK VISUALIZER */}
                  <div
                    style={{
                      padding: '0.85rem',
                      background: 'rgba(5, 11, 20, 0.7)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      marginBottom: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${projectMonthSteps.length}, 1fr)`, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.35rem', textAlign: 'center' }}>
                      {projectMonthSteps.map((m) => (
                        <span key={m.dateStr} style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {m.label}
                        </span>
                      ))}
                    </div>

                    {tasks.map((t, idx) => {
                      const tStart = t.start_date || projectMeta.startDate;
                      let startIdx = projectMonthSteps.findIndex((s) => s.dateStr === tStart);
                      if (startIdx < 0) startIdx = 0;
                      const dur = Number(t.duration_months) || 1;
                      const isSelected = idx === activeTaskIdx;
                      const tColor = colors[idx % colors.length];

                      return (
                        <div
                          key={idx}
                          onClick={() => setActiveTaskIdx(idx)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${projectMonthSteps.length}, 1fr)`,
                            alignItems: 'center',
                            cursor: 'pointer',
                            padding: '0.15rem 0',
                            opacity: isSelected ? 1 : 0.75,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div
                            style={{
                              gridColumnStart: startIdx + 1,
                              gridColumnEnd: Math.min(startIdx + dur + 1, projectMonthSteps.length + 1),
                              background: `linear-gradient(90deg, ${tColor}dd 0%, ${tColor}99 100%)`,
                              borderRadius: '6px',
                              padding: '0.3rem 0.6rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              boxShadow: isSelected ? `0 0 12px ${tColor}88` : 'none',
                              border: isSelected ? `1.5px solid ${tColor}` : '1px solid transparent',
                            }}
                          >
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#050b14', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              #{idx + 1} {t.task_name} ({t.duration_months} mo)
                            </span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#050b14', opacity: 0.9 }}>
                              {projectMonthSteps[startIdx]?.label || 'Start'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                    {/* DUAL POINTER SCHEDULE CONTROLLER FOR ACTIVE TASK */}
                    {(() => {
                      const tStart = currentTask?.start_date || projectMeta.startDate;
                      let startIdx = projectMonthSteps.findIndex((s) => s.dateStr === tStart);
                      if (startIdx < 0) startIdx = 0;
                      const dur = Number(currentTask?.duration_months) || 1;
                      let endIdx = Math.min(startIdx + dur - 1, projectMonthSteps.length - 1);
                      if (endIdx < startIdx) endIdx = startIdx;
                      const tColor = colors[activeTaskIdx % colors.length];

                      return (
                        <TaskScheduleSlider
                          taskTitle={`Task #${activeTaskIdx + 1} (${currentTask?.task_name || 'Task'})`}
                          taskColor={tColor}
                          projectMonthSteps={projectMonthSteps}
                          startIdx={startIdx}
                          endIdx={endIdx}
                          durationMonths={dur}
                          onChange={(newStartIdx, newEndIdx) => {
                            const newStartDate = projectMonthSteps[newStartIdx]?.dateStr || projectMeta.startDate;
                            const newDur = Math.max(1, newEndIdx - newStartIdx + 1);
                            handleTaskChange(activeTaskIdx, 'start_date', newStartDate);
                            handleTaskChange(activeTaskIdx, 'duration_months', newDur);
                          }}
                        />
                      );
                    })()}
                </div>
              );
            })()}

            {/* LIST OF INDIVIDUAL TASK CARDS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {tasks.map((tItem, tIdx) => {
                const previewMonths = calculateTaskPreview(tItem);
                const projectMonthSteps = getProjectMonthSteps(projectMeta.startDate, projectMeta.endDate);

                return (
                  <div
                    key={tItem.id || tIdx}
                    onClick={() => setActiveTaskIdx(tIdx)}
                    style={{
                      background: 'rgba(10, 16, 30, 0.85)',
                      border: tIdx === activeTaskIdx ? '1px solid rgba(0, 210, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      cursor: 'pointer',
                    }}
                  >
                    {/* TASK HEADER */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: tIdx === activeTaskIdx ? 'var(--accent-cyan)' : '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Wrench size={16} /> Task #{tIdx + 1}: {tItem.task_name} {tIdx === activeTaskIdx && '(Selected on Master Schedule)'}
                      </span>
                      {tasks.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTask(tIdx);
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            color: '#f87171',
                            padding: '0.3rem 0.6rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <Trash2 size={13} /> Remove Task
                        </button>
                      )}
                    </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.1fr 1.1fr 0.9fr', gap: '0.65rem' }}>
                        {/* TASK NAME */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                            Task Type *
                          </label>
                          <select
                            value={tItem.task_name}
                            onChange={(e) => handleTaskChange(tIdx, 'task_name', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.55rem 0.75rem',
                              background: 'rgba(15, 23, 42, 0.9)',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              borderRadius: '8px',
                              color: '#fff',
                              fontSize: '0.85rem',
                            }}
                          >
                            <option value="Welding">Welding</option>
                            <option value="Machining">Machining</option>
                            <option value="Assembly">Assembly</option>
                            <option value="Plating">Plating</option>
                            <option value="RR">RR (Roll Repair)</option>
                          </select>
                        </div>

                        {/* ALLOCATED HOURS */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                            Allocated Hours *
                          </label>
                          <input
                            type="number"
                            value={tItem.allocated_hours}
                            onChange={(e) => handleTaskChange(tIdx, 'allocated_hours', e.target.value)}
                            min="1"
                            required
                            style={{
                              width: '100%',
                              padding: '0.55rem 0.75rem',
                              background: 'rgba(15, 23, 42, 0.9)',
                              border: '1px solid rgba(0, 210, 255, 0.3)',
                              borderRadius: '8px',
                              color: 'var(--accent-cyan)',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                            }}
                          />
                        </div>

                        {/* LOCATION */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                            Location
                          </label>
                          <select
                            value={tItem.location || 'Khordha'}
                            onChange={(e) => handleTaskChange(tIdx, 'location', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.55rem 0.75rem',
                              background: 'rgba(15, 23, 42, 0.9)',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              borderRadius: '8px',
                              color: '#fff',
                              fontSize: '0.85rem',
                            }}
                          >
                            <option value="Khordha">Khordha</option>
                            {tItem.task_name === 'Welding' && (
                              <>
                                <option value="Mancheswar">Mancheswar</option>
                                <option value="K+M">K+M</option>
                              </>
                            )}
                          </select>
                        </div>

                        {/* KICKOFF (START) MONTH SELECTOR */}
                        {(() => {
                          const tStart = tItem.start_date || projectMeta.startDate;
                          let sIdx = projectMonthSteps.findIndex((s) => s.dateStr === tStart);
                          if (sIdx < 0) sIdx = 0;
                          const dur = Number(tItem.duration_months) || 1;
                          let eIdx = Math.min(sIdx + dur - 1, projectMonthSteps.length - 1);
                          if (eIdx < sIdx) eIdx = sIdx;

                          return (
                            <>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                                  Start Month
                                </label>
                                <select
                                  value={tStart}
                                  onChange={(e) => {
                                    const newStartDate = e.target.value;
                                    const newStartIdx = projectMonthSteps.findIndex((s) => s.dateStr === newStartDate);
                                    let newDur = eIdx - (newStartIdx >= 0 ? newStartIdx : 0) + 1;
                                    if (newDur < 1) newDur = 1;
                                    handleTaskChange(tIdx, 'start_date', newStartDate);
                                    handleTaskChange(tIdx, 'duration_months', newDur);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem 0.75rem',
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '0.85rem',
                                  }}
                                >
                                  {projectMonthSteps.map((m, idx) => (
                                    <option key={m.dateStr} value={m.dateStr}>
                                      {idx === 0 ? `M1: ${m.label} (Zero)` : `M${idx + 1}: ${m.label}`}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* END MONTH SELECTOR */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                                  End Month
                                </label>
                                <select
                                  value={projectMonthSteps[eIdx]?.dateStr || tStart}
                                  onChange={(e) => {
                                    const newEndDate = e.target.value;
                                    const newEndIdx = projectMonthSteps.findIndex((s) => s.dateStr === newEndDate);
                                    const newDur = Math.max(1, newEndIdx - sIdx + 1);
                                    handleTaskChange(tIdx, 'duration_months', newDur);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem 0.75rem',
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '0.85rem',
                                  }}
                                >
                                  {projectMonthSteps.map((m, idx) => (
                                    <option key={m.dateStr} value={m.dateStr} disabled={idx < sIdx}>
                                      M{idx + 1}: {m.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </>
                          );
                        })()}

                        {/* DURATION (MONTHS) DISPLAY */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                            Duration
                          </label>
                          <div
                            style={{
                              padding: '0.55rem 0.75rem',
                              background: 'rgba(15, 23, 42, 0.9)',
                              border: '1px solid rgba(0, 210, 255, 0.3)',
                              borderRadius: '8px',
                              color: 'var(--accent-cyan)',
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              textAlign: 'center',
                            }}
                          >
                            {tItem.duration_months || 1} mo
                          </div>
                        </div>
                      </div>

                    {/* ROW 2: IN-PROGRESS ADJUSTMENTS & BUFFERS FOR THIS TASK */}
                    <div
                      style={{
                        padding: '1rem',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(0, 210, 255, 0.06) 100%)',
                        borderRadius: '10px',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <Sliders size={16} color="var(--accent-emerald)" />
                        <h5 style={{ margin: 0, color: '#ffffff', fontSize: '0.85rem', fontWeight: 800 }}>
                          Task #{tIdx + 1} ({tItem.task_name}) — Progress Adjustments & Buffers
                        </h5>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                        {/* ADJUSTMENT FOR THIS TASK */}
                        <div
                          style={{
                            padding: '0.85rem',
                            background: 'rgba(10, 16, 30, 0.7)',
                            borderRadius: '8px',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f59e0b', fontSize: '0.78rem', fontWeight: 800, marginBottom: '0.6rem' }}>
                            <TrendingUp size={14} /> 1. Utilization Adjustment
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                Adjustment After Month
                              </label>
                              <select
                                value={tItem.adjustment_month_index || ''}
                                onChange={(e) => handleTaskChange(tIdx, 'adjustment_month_index', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.45rem 0.65rem',
                                  background: 'rgba(15, 23, 42, 0.9)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '0.8rem',
                                }}
                              >
                                <option value="">No Adjustment</option>
                                {previewMonths.map((pm: any, idx: number) => (
                                  <option key={idx + 1} value={idx + 1}>
                                    After Task Month {idx + 1} ({pm.month})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              {(() => {
                                const adjIdx = Number(tItem.adjustment_month_index);
                                const adjObj = adjIdx > 0 && previewMonths[adjIdx - 1] ? previewMonths[adjIdx - 1] : null;
                                const adjTxt = adjObj ? `Task Month ${adjIdx} (${adjObj.month})` : `Month ${tItem.adjustment_month_index || 1}`;
                                return (
                                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                    Actual Utilized Hours in {adjTxt}
                                  </label>
                                );
                              })()}
                              <input
                                type="number"
                                placeholder="e.g. 500"
                                value={tItem.actual_utilized_hours || ''}
                                onChange={(e) => handleTaskChange(tIdx, 'actual_utilized_hours', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.45rem 0.65rem',
                                  background: 'rgba(15, 23, 42, 0.9)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  borderRadius: '6px',
                                  color: '#f59e0b',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* BUFFER FOR THIS TASK */}
                        <div
                          style={{
                            padding: '0.85rem',
                            background: 'rgba(10, 16, 30, 0.7)',
                            borderRadius: '8px',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a855f7', fontSize: '0.78rem', fontWeight: 800, marginBottom: '0.6rem' }}>
                            <PlusCircle size={14} /> 2. Introduced Buffer Hours
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                Buffer Introduced In Month
                              </label>
                              <select
                                value={tItem.buffer_month_index || ''}
                                onChange={(e) => handleTaskChange(tIdx, 'buffer_month_index', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.45rem 0.65rem',
                                  background: 'rgba(15, 23, 42, 0.9)',
                                  border: '1px solid rgba(168, 85, 247, 0.3)',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '0.8rem',
                                }}
                              >
                                <option value="">No Buffer</option>
                                {previewMonths.map((pm: any, idx: number) => (
                                  <option key={idx + 1} value={idx + 1}>
                                    Task Month {idx + 1} ({pm.month})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              {(() => {
                                const bufIdx = Number(tItem.buffer_month_index);
                                const bufObj = bufIdx > 0 && previewMonths[bufIdx - 1] ? previewMonths[bufIdx - 1] : null;
                                const bufTxt = bufObj ? `Task Month ${bufIdx} (${bufObj.month})` : `Month ${tItem.buffer_month_index || 1}`;
                                return (
                                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                    Extra Buffer Capacity (Hours) in {bufTxt}
                                  </label>
                                );
                              })()}
                              <input
                                type="number"
                                placeholder="e.g. 500 extra hours"
                                value={tItem.buffer_hours || ''}
                                onChange={(e) => handleTaskChange(tIdx, 'buffer_hours', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.45rem 0.65rem',
                                  background: 'rgba(15, 23, 42, 0.9)',
                                  border: '1px solid rgba(168, 85, 247, 0.3)',
                                  borderRadius: '6px',
                                  color: '#a855f7',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* DYNAMIC MONTHLY BREAKDOWN PREVIEW FOR THIS TASK */}
                    {previewMonths.length > 0 && (
                      <div
                        style={{
                          background: 'rgba(10, 16, 30, 0.75)',
                          borderRadius: '8px',
                          padding: '0.85rem',
                          border: '1px solid rgba(0, 210, 255, 0.2)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                            Monthly Breakdown Preview ({tItem.task_name} {tItem.task_name === 'Welding' ? '15% Ramp-up Engine' : 'Equal Split Engine'})
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Task Total: <strong style={{ color: '#fff' }}>{previewMonths.reduce((a, b) => a + b.hours, 0).toLocaleString()} hrs</strong>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${previewMonths.length}, 1fr)`, gap: '0.5rem' }}>
                          {previewMonths.map((m) => (
                            <div
                              key={m.index}
                              style={{
                                padding: '0.5rem',
                                background: m.isAdjusted
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : m.isBuffer
                                  ? 'rgba(168, 85, 247, 0.15)'
                                  : m.index === 1 && tItem.task_name === 'Welding'
                                  ? 'rgba(0, 210, 255, 0.12)'
                                  : 'rgba(255, 255, 255, 0.03)',
                                border: m.isAdjusted
                                  ? '1px solid #f59e0b'
                                  : m.isBuffer
                                  ? '1px solid #a855f7'
                                  : m.index === 1 && tItem.task_name === 'Welding'
                                  ? '1px solid var(--accent-cyan)'
                                  : '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '6px',
                                textAlign: 'center',
                              }}
                            >
                              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                M{m.index}: {m.month}
                              </div>

                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: m.isAdjusted ? '#f59e0b' : m.isBuffer ? '#a855f7' : m.index === 1 && tItem.task_name === 'Welding' ? 'var(--accent-cyan)' : '#fff', marginTop: '0.1rem' }}>
                                {m.hours.toLocaleString()} hrs
                              </div>

                              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: m.isAdjusted ? '#f59e0b' : m.isBuffer ? '#a855f7' : m.index === 1 && tItem.task_name === 'Welding' ? '#00d2ff' : '#10b981' }}>
                                {m.isAdjusted ? '(Adjusted)' : m.isBuffer ? '(Buffer Added)' : (m.index === 1 && tItem.task_name === 'Welding' ? '(15% Ramp-up)' : '(Equal Split)')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>

          {/* SAVE MESSAGE */}
          {saveMsg && (
            <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', color: '#10b981', fontSize: '0.82rem', fontWeight: 700 }}>
              {saveMsg}
            </div>
          )}

          {/* ACTIONS & TOTAL HOURS SUMMARY */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Total Project Planned Capacity: <strong style={{ color: 'var(--accent-cyan)', fontSize: '1rem' }}>{totalProjectPlannedHours.toLocaleString()} hrs</strong> ({tasks.length} {tasks.length === 1 ? 'task' : 'tasks'})
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.65rem 1.2rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                style={{
                  padding: '0.65rem 1.4rem',
                  background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#050b14',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Save size={16} /> {isSaving ? 'Saving Edits...' : 'Save & Recalculate Project'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
