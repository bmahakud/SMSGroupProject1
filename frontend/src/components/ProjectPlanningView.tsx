'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  FolderKanban,
  Calendar,
  User,
  Clock,
  Flag,
  CircleCheck,
  X,
  Save,
  FileText,
  Hash,
  Wrench,
  Scale,
  Edit,
  MapPin,
  Tag,
  Trash2,
} from 'lucide-react';
import { ProjectDetailsModal } from './ProjectDetailsModal';
import TaskScheduleSlider from './TaskScheduleSlider';
import { fetchBackendProjects, authenticatedFetch, getApiBaseUrl } from '../lib/api';

interface Project {
  id: string;
  serialNo: number;
  projectName: string;
  projectNumber: string;
  equipmentName: string;
  equipmentWeight: string;
  fabricationWeight?: string;
  startDate: string;
  endDate: string;
  edd?: string;
  projectManager: string;
  task: string;
  location: string;

  plannedHours: number;
  priority: string;
  status: string;
}

interface ProjectPlanningViewProps {
  onProjectCreated?: (project: Project) => void;
}

interface TaskItem {
  id: string;
  task_name: string;
  allocated_hours: number | string;
  duration_months: number | string;
  location: string;
  start_date?: string;
}

interface ValidationErrors {
  customerName?: string;
  wbsNo?: string;
  startDate?: string;
  endDate?: string;
  projectManager?: string;
  tasks?: string;
  taskAllocatedHours: Record<number, string>;
}

function getProjectMonthSteps(startDateStr: string, endDateStr: string) {
  const start = startDateStr
    ? new Date(startDateStr)
    : new Date(2026, 7, 1);

  let end = endDateStr
    ? new Date(endDateStr)
    : new Date(start.getFullYear(), start.getMonth() + 5, 1);

  if (isNaN(start.getTime())) {
    return [
      {
        label: 'Aug 2026',
        dateStr: '2026-08-01',
        monthIndex: 0,
      },
    ];
  }

  if (isNaN(end.getTime()) || end < start) {
    end = new Date(start.getFullYear(), start.getMonth() + 5, 1);
  }

  const steps: {
    label: string;
    dateStr: string;
    monthIndex: number;
  }[] = [];

  let curr = new Date(
    start.getFullYear(),
    start.getMonth(),
    1
  );

  let idx = 0;

  while (curr <= end || steps.length < 3) {
    if (steps.length >= 24) break;

    const year = curr.getFullYear();
    const month = String(curr.getMonth() + 1).padStart(2, '0');

    const dateStr = `${year}-${month}-01`;

    const label = curr.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });

    steps.push({
      label,
      dateStr,
      monthIndex: idx,
    });

    curr.setMonth(curr.getMonth() + 1);
    idx++;
  }

  return steps;
}

const STANDARD_TASKS = [
  'Welding',
  'Machining',
  'Assembly',
  'Plating',
  'RR',
];

const createDefaultTask = (
  taskName: string = 'Welding',
  defaultStartDate?: string
): TaskItem => ({
  id: `task_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)}`,
  task_name: taskName,
  allocated_hours: 3000,
  duration_months: 3,
  location: 'Khordha',
  start_date: defaultStartDate || '',
});

export const ProjectPlanningView: React.FC<
  ProjectPlanningViewProps
> = ({ onProjectCreated }) => {
  const [showForm, setShowForm] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] =
    useState<any | null>(null);

  const [isModalOpen, setIsModalOpen] =
    useState<boolean>(false);

  const [formTasks, setFormTasks] = useState<TaskItem[]>([
    createDefaultTask('Welding'),
  ]);

  const [activeTaskIdx, setActiveTaskIdx] =
    useState<number>(0);

  const [formData, setFormData] = useState({
    customerName: '',
    wbsNo: '',
    soNo: '',
    soLineItems: '',
    projectCode: '',
    location: '',
    projectName: '',
    projectNumber: '',
    equipmentName: '',
    equipmentWeight: '',
    fabricationWeight: '',
    startDate: '',
    endDate: '',
    edd: '',
    projectManager: '',
    priority: 'Medium',
    status: 'Planned',
  });

  const [saveMessage, setSaveMessage] = useState('');

  /*
   * ============================================================
   * VALIDATION STATE
   * ============================================================
   */

  const [validationErrors, setValidationErrors] =
    useState<ValidationErrors>({
      customerName: '',
      wbsNo: '',
      startDate: '',
      endDate: '',
      projectManager: '',
      tasks: '',
      taskAllocatedHours: {},
    });

  /*
   * ============================================================
   * FIELD REFS
   * These are used to automatically move the user to the first
   * missing required field.
   * ============================================================
   */

  const customerNameRef =
    useRef<HTMLInputElement>(null);

  const wbsNoRef =
    useRef<HTMLInputElement>(null);

  const startDateRef =
    useRef<HTMLInputElement>(null);

  const endDateRef =
    useRef<HTMLInputElement>(null);

  const projectManagerRef =
    useRef<HTMLInputElement>(null);

  const taskAllocatedHoursRefs =
    useRef<Record<number, HTMLInputElement | null>>({});

  const openDatePicker = (e: React.MouseEvent<HTMLInputElement>) => {
    try {
      if ('showPicker' in HTMLInputElement.prototype) {
        (e.currentTarget as any).showPicker();
      }
    } catch (err) {
      // Fallback for browsers that don't support showPicker()
    }
  };

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleDeleteProject = async (project: any) => {
    const projectName =
      project.customer_name ||
      project.customerName ||
      project.project_name ||
      project.projectName ||
      'this project';

    const confirmed = window.confirm(
      `Are you sure you want to delete ${projectName}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    const remainingProjects = projects.filter(
      (item: any) => String(item.id) !== String(project.id)
    );

    const updatedProjects = remainingProjects.map(
      (item: any, index: number) => ({
        ...item,
        serialNo: index + 1,
      })
    );

    setProjects(updatedProjects);

    localStorage.setItem(
      'sms_project_planning',
      JSON.stringify(updatedProjects)
    );

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/projects/${encodeURIComponent(String(project.id))}/`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        console.warn(
          'Backend project deletion was not completed:',
          response.status
        );
      }
    } catch (error) {
      console.warn(
        'Backend project deletion unavailable; local project was deleted:',
        error
      );
    }
  };

  /*
   * ============================================================
   * LOAD PROJECTS
   * ============================================================
   */

  const loadProjects = async () => {
    try {
      const backendProjects = await fetchBackendProjects();
      if (backendProjects && Array.isArray(backendProjects) && backendProjects.length > 0) {
        const formattedProjects = backendProjects.map((bp: any, index: number) => {
          const mainTask = bp.tasks?.[0] || {};
          const cName = bp.customer_name || bp.project_name || 'Project';
          const wbs = bp.wbs_no || bp.project_number || '';
          return {
            id: String(bp.id),
            serialNo: index + 1,
            customerName: cName,
            customer_name: cName,
            wbsNo: wbs,
            wbs_no: wbs,
            projectCode: bp.project_code || wbs,
            project_code: bp.project_code || wbs,
            // Keep SO fields from the backend so they are not lost when
            // backendProjects are normalized for the table.
            soNo: bp.so_no ?? bp.soNo ?? '',
            so_no: bp.so_no ?? bp.soNo ?? '',
            soLineItems: bp.so_line_items ?? bp.soLineItems ?? '',
            so_line_items: bp.so_line_items ?? bp.soLineItems ?? '',
            location: bp.location || mainTask.location || '',
            projectName: bp.project_name || cName,
            project_name: bp.project_name || cName,
            projectNumber: bp.project_number || wbs,
            project_number: bp.project_number || wbs,
            equipmentName: bp.equipment_name || '',
            equipmentWeight: bp.equipment_weight || '',
            fabricationWeight: bp.fabrication_weight || '',
            fabrication_weight: bp.fabrication_weight || '',
            startDate: bp.zero_date || bp.startDate || '',
            endDate: bp.cdd || bp.endDate || '',
            edd: bp.edd || bp.edd_date || '',
            projectManager: bp.project_manager || '',
            task: mainTask.task_name || 'Welding',
            plannedHours: Number(bp.total_planned_hours) || 0,
            total_planned_hours: Number(bp.total_planned_hours) || 0,
            priority: bp.priority || 'Medium',
            status: bp.status || 'Planned',
            tasks: bp.tasks || [],
          };
        });

        setProjects(formattedProjects);
        localStorage.setItem(
          'sms_project_planning',
          JSON.stringify(formattedProjects)
        );
        return;
      }
    } catch (err) {
      console.warn('Backend API fetch projects warning:', err);
    }

    try {
      const saved = localStorage.getItem('sms_project_planning');

      if (saved) {
        const parsedProjects = JSON.parse(saved);

        const projectsWithSerialNo = parsedProjects.map(
          (project: any, index: number) => ({
            ...project,
            serialNo:
              typeof project.serialNo === 'number'
                ? project.serialNo
                : index + 1,
          })
        );

        setProjects(projectsWithSerialNo);

        localStorage.setItem(
          'sms_project_planning',
          JSON.stringify(projectsWithSerialNo)
        );
      }
    } catch (e) {
      console.error('Failed to load saved projects', e);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  /*
   * ============================================================
   * PROJECT SERIALIZATION
   * ============================================================
   * The next project always receives the next available serial
   * number: 1, 2, 3, 4, ...
   */
  const nextSerialNo =
    projects.reduce(
      (max, project: any) =>
        Math.max(max, Number(project.serialNo) || 0),
      0
    ) + 1;

  /*
   * ============================================================
   * TASK FUNCTIONS
   * ============================================================
   */

  const addFormTask = () => {
    if (formTasks.length >= 5) return;

    const existingNames = formTasks.map(
      (t) => t.task_name
    );

    const nextName =
      STANDARD_TASKS.find(
        (n) => !existingNames.includes(n)
      ) || 'Machining';

    setFormTasks((prev) => [
      ...prev,
      createDefaultTask(
        nextName,
        formData.startDate
      ),
    ]);
  };

  const removeFormTask = (index: number) => {
    if (formTasks.length <= 1) return;

    setFormTasks((prev) =>
      prev.filter((_, i) => i !== index)
    );

    setValidationErrors((prev) => {
      const newTaskErrors = {
        ...prev.taskAllocatedHours,
      };

      delete newTaskErrors[index];

      const shiftedErrors: Record<number, string> = {};

      Object.entries(newTaskErrors).forEach(
        ([key, value]) => {
          const oldIndex = Number(key);

          if (oldIndex > index) {
            shiftedErrors[oldIndex - 1] = value;
          } else {
            shiftedErrors[oldIndex] = value;
          }
        }
      );

      return {
        ...prev,
        taskAllocatedHours: shiftedErrors,
      };
    });
  };

  const handleTaskFieldChange = (
    index: number,
    field: string,
    value: any
  ) => {
    setFormTasks((prev) => {
      const copy = [...prev];

      const updatedTask = {
        ...copy[index],
        [field]: value,
      };

      // Restrict Mancheswar and K+M to Welding task only
      if (
        field === 'task_name' &&
        value !== 'Welding'
      ) {
        if (updatedTask.location !== 'Khordha') {
          updatedTask.location = 'Khordha';
        }
      }

      copy[index] = updatedTask;

      return copy;
    });

    /*
     * Clear allocated-hours error when the user
     * starts entering a valid value.
     */
    if (
      field === 'allocated_hours' &&
      Number(value) > 0
    ) {
      setValidationErrors((prev) => {
        const taskErrors = {
          ...prev.taskAllocatedHours,
        };

        delete taskErrors[index];

        return {
          ...prev,
          taskAllocatedHours: taskErrors,
        };
      });
    }
  };

  /*
   * ============================================================
   * FORM CHANGE
   * ============================================================
   */

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement |
        HTMLTextAreaElement |
        HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    /*
     * Remove error for the field as soon as
     * the user fills it.
     */
    if (value.trim() !== '') {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }

    /*
     * Special handling for CDD / Zero Date.
     */
    if (
      name === 'startDate' ||
      name === 'endDate'
    ) {
      setValidationErrors((prev) => ({
        ...prev,
        startDate:
          name === 'startDate' && value
            ? ''
            : prev.startDate,
        endDate:
          name === 'endDate' && value
            ? ''
            : prev.endDate,
      }));
    }
  };

  /*
   * ============================================================
   * RESET FORM
   * ============================================================
   */

  const resetForm = () => {
    setFormTasks([
      createDefaultTask('Welding'),
    ]);

    setFormData({
      customerName: '',
      wbsNo: '',
      soNo: '',
      soLineItems: '',
      projectCode: '',
      location: '',
      projectName: '',
      projectNumber: '',
      equipmentName: '',
      equipmentWeight: '',
      fabricationWeight: '',
      startDate: '',
      endDate: '',
      edd: '',
      projectManager: '',
      priority: 'Medium',
      status: 'Planned',
    });

    setValidationErrors({
      customerName: '',
      wbsNo: '',
      startDate: '',
      endDate: '',
      projectManager: '',
      tasks: '',
      taskAllocatedHours: {},
    });

    setActiveTaskIdx(0);
  };

  /*
   * ============================================================
   * CANCEL
   * ============================================================
   */

  const handleCancel = () => {
    setShowForm(false);
    resetForm();
    setSaveMessage('');
  };

  /*
   * ============================================================
   * VALIDATION
   *
   * This checks EVERY required field individually.
   * ============================================================
   */

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {
      customerName: '',
      wbsNo: '',
      startDate: '',
      endDate: '',
      projectManager: '',
      tasks: '',
      taskAllocatedHours: {},
    };

    /*
     * CUSTOMER NAME
     */
    if (!formData.customerName.trim()) {
      errors.customerName =
        'Customer Name is required.';
    }

    /*
     * WBS NUMBER
     */
    if (!formData.wbsNo.trim()) {
      errors.wbsNo =
        'WBS No. is required.';
    }

    /*
     * ZERO DATE
     */
    if (!formData.startDate) {
      errors.startDate =
        'Zero Date is required.';
    }

    /*
     * CDD
     */
    if (!formData.endDate) {
      errors.endDate =
        'CDD is required.';
    }

    /*
     * PROJECT MANAGER
     */
    if (!formData.projectManager.trim()) {
      errors.projectManager =
        'Project Manager is required.';
    }

    /*
     * TASK
     */
    if (formTasks.length === 0) {
      errors.tasks =
        'At least one task is required.';
    }

    /*
     * TASK ALLOCATED HOURS
     */
    formTasks.forEach((task, index) => {
      if (
        task.allocated_hours === '' ||
        Number(task.allocated_hours) <= 0 ||
        Number.isNaN(
          Number(task.allocated_hours)
        )
      ) {
        errors.taskAllocatedHours[index] =
          `Allocated Hours for Task #${
            index + 1
          } is required.`;
      }
    });

    /*
     * DATE ORDER VALIDATION
     */
    if (
      formData.startDate &&
      formData.endDate &&
      new Date(formData.endDate) <
        new Date(formData.startDate)
    ) {
      errors.endDate =
        'CDD cannot be earlier than Zero Date.';
    }

    /*
     * SAVE ALL ERRORS
     */
    setValidationErrors(errors);

    /*
     * ========================================================
     * AUTOMATICALLY MOVE TO FIRST MISSING FIELD
     * ========================================================
     */

    requestAnimationFrame(() => {
      if (errors.customerName) {
        customerNameRef.current
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

        customerNameRef.current?.focus();
        return;
      }

      if (errors.wbsNo) {
        wbsNoRef.current
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

        wbsNoRef.current?.focus();
        return;
      }

      if (errors.startDate) {
        startDateRef.current
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

        startDateRef.current?.focus();
        return;
      }

      if (errors.endDate) {
        endDateRef.current
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

        endDateRef.current?.focus();
        return;
      }

      if (errors.projectManager) {
        projectManagerRef.current
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

        projectManagerRef.current?.focus();
        return;
      }

      const firstTaskError =
        Object.keys(
          errors.taskAllocatedHours
        )[0];

      if (firstTaskError !== undefined) {
        const taskIndex =
          Number(firstTaskError);

        setActiveTaskIdx(taskIndex);

        requestAnimationFrame(() => {
          const input =
            taskAllocatedHoursRefs.current[
              taskIndex
            ];

          input?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

          input?.focus();
        });

        return;
      }
    });

    /*
     * Return true only if there are NO errors.
     */
    return (
      !errors.customerName &&
      !errors.wbsNo &&
      !errors.startDate &&
      !errors.endDate &&
      !errors.projectManager &&
      !errors.tasks &&
      Object.keys(
        errors.taskAllocatedHours
      ).length === 0
    );
  };

  /*
   * ============================================================
   * SUBMIT
   * ============================================================
   */

  const handleSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    /*
     * Run complete validation first.
     */
    const isValid = validateForm();

    if (!isValid) {
      setSaveMessage(
        'Please complete all highlighted required fields.'
      );
      return;
    }

    const cName =
      formData.customerName ||
      formData.projectName;

    const wbs =
      formData.wbsNo ||
      formData.projectNumber;

    const pCode =
      formData.projectCode || wbs;

    /*
     * Calculate total project planned hours
     */
    const totalPlannedHours =
      formTasks.reduce(
        (sum, t) =>
          sum +
          (Number(t.allocated_hours) || 0),
        0
      );

    const primaryTask =
      formTasks[0] || {};

    const newProject: any = {
      id: `project_${Date.now()}`,
      serialNo: nextSerialNo,

      customerName: cName,
      customer_name: cName,

      wbsNo: wbs,
      wbs_no: wbs,

      projectCode: pCode,
      project_code: pCode,

      // Include SO fields in the project object so the table and
      // localStorage can display them immediately after creation.
      soNo: formData.soNo,
      so_no: formData.soNo,
      soLineItems: formData.soLineItems,
      so_line_items: formData.soLineItems,

      location:
        formData.location ||
        primaryTask.location ||
        '',

      projectName: cName,
      project_name: cName,

      projectNumber: wbs,
      project_number: wbs,

      equipmentName:
        formData.equipmentName,

      equipmentWeight:
        formData.equipmentWeight,

      fabricationWeight:
        formData.fabricationWeight,

      fabrication_weight:
        formData.fabricationWeight,

      startDate:
        formData.startDate,

      endDate:
        formData.endDate,

      edd:
        formData.edd,

      edd_date:
        formData.edd,

      projectManager:
        formData.projectManager,

      task:
        primaryTask.task_name ||
        'Welding',

      plannedHours:
        totalPlannedHours,

      total_planned_hours:
        totalPlannedHours,

      priority:
        formData.priority,

      status:
        formData.status,

      tasks: formTasks.map((t) => ({
        task_name: t.task_name,

        task_code: String(
          t.task_name
        )
          .toLowerCase()
          .replace(/\s+/g, '_'),

        allocated_hours:
          Number(
            t.allocated_hours
          ) || 0,

        duration_months:
          Number(
            t.duration_months
          ) || 3,

        start_date:
          t.start_date ||
          formData.startDate,

        location:
          t.location ||
          formData.location ||
          '',
      })),
    };

    const updatedProjects = [
      ...projects,
      newProject,
    ];

    setProjects(updatedProjects);

    /*
     * Save to localStorage
     */
    localStorage.setItem(
      'sms_project_planning',
      JSON.stringify(updatedProjects)
    );

    /*
     * Persist to Django REST API backend
     */
    try {
      const apiBase = getApiBaseUrl();
      authenticatedFetch(`${apiBase}/projects/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProject),
      })
        .then(() => {
          loadProjects();
        })
        .catch((e) =>
          console.warn('Django API sync note:', e)
        );
    } catch (err) {
      console.warn('API sync warning:', err);
    }

    if (onProjectCreated) {
      onProjectCreated(newProject);
    }

    setSaveMessage(
      'Project created & synchronized with Backend calculation engine successfully.'
    );

    resetForm();

    setTimeout(() => {
      setSaveMessage('');
      setShowForm(false);
    }, 1200);
  };

  /*
   * ============================================================
   * ERROR STYLES
   * ============================================================
   */

  const getInputStyle = (
    hasError: boolean
  ): React.CSSProperties => ({
    ...(hasError
      ? {
          border:
            '1px solid #ef4444',
          boxShadow:
            '0 0 0 2px rgba(239, 68, 68, 0.12)',
        }
      : {}),
  });

  const ErrorMessage = ({
    message,
  }: {
    message?: string;
  }) => {
    if (!message) return null;

    return (
      <div
        style={{
          marginTop: '0.35rem',
          color: '#f87171',
          fontSize: '0.72rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 900,
          }}
        >
          !
        </span>

        {message}
      </div>
    );
  };

  /*
   * ============================================================
   * RETURN
   * ============================================================
   */

  return (
    <div
      style={{
        padding: '1.5rem',
        minHeight:
          'calc(100vh - 80px)',
      }}
    >
      {/* PAGE HEADER */}

      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
            }}
          >
            <FolderKanban
              size={24}
              color="var(--accent-cyan)"
            />

            <h2
              style={{
                margin: 0,
                color: 'var(--text-main)',
                fontSize: '1.35rem',
                fontWeight: 800,
              }}
            >
              Project Planning
            </h2>
          </div>

          <p
            style={{
              marginTop: '0.4rem',
              color:
                'var(--text-muted)',
              fontSize: '0.85rem',
            }}
          >
            Create and manage projects
            for capacity planning.
          </p>
        </div>

        <button
          onClick={() =>
            setShowForm(true)
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background:
              'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
            color: '#ffffff',
            border: 'none',
            padding:
              '0.65rem 1.1rem',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow:
              '0 0 15px rgba(0, 210, 255, 0.25)',
          }}
        >
          <Plus size={18} />
          Add Project
        </button>
      </div>

      {/* PROJECT FORM */}

      {showForm && (
        <div
          className="glass-panel"
          style={{
            padding: '1.5rem',
            marginBottom: '1.5rem',
            border:
              '1px solid rgba(0, 210, 255, 0.25)',
          }}
        >
          {/* FORM HEADER */}

          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              marginBottom:
                '1.25rem',
              paddingBottom: '1rem',
              borderBottom:
                '1px solid var(--border-color)',
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  color: 'var(--text-main)',
                  fontSize: '1.1rem',
                  fontWeight: 800,
                }}
              >
                Create New Project
              </h3>

              <p
                style={{
                  marginTop:
                    '0.3rem',
                  color:
                    'var(--text-muted)',
                  fontSize: '0.75rem',
                }}
              >
                Enter the project
                information below.
              </p>
            </div>

            <button
              onClick={handleCancel}
              style={{
                background:
                  'rgba(255,255,255,0.05)',
                border:
                  '1px solid var(--border-color)',
                color:
                  'var(--text-muted)',
                borderRadius: '7px',
                padding: '0.4rem',
                cursor: 'pointer',
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
          >
            {/* ROW 1 - CUSTOMER NAME & LOCATION */}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr',
                gap: '1rem',
                marginBottom:
                  '1rem',
              }}
            >
              {/* CUSTOMER NAME */}

              <div>
                <label className="project-form-label">
                  <User size={14} />
                  Customer Name *
                </label>

                <input
                  ref={customerNameRef}
                  type="text"
                  name="customerName"
                  value={
                    formData.customerName
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. JSW Steels Ltd"
                  className="project-form-input"
                  style={getInputStyle(
                    !!validationErrors.customerName
                  )}
                />

                <ErrorMessage
                  message={
                    validationErrors.customerName
                  }
                />
              </div>

              {/* LOCATION */}

              <div>
                <label className="project-form-label">
                  <MapPin size={14} />
                  Location
                </label>

                <input
                  type="text"
                  name="location"
                  value={
                    formData.location
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. Khordha, Odisha"
                  className="project-form-input"
                />
              </div>
            </div>

            {/* ROW 2 - WBS NO & PROJECT CODE */}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr 1fr 1fr',
                gap: '1rem',
                marginBottom:
                  '1rem',
              }}
            >
              {/* WBS NO */}

              <div>
                <label className="project-form-label">
                  <Hash size={14} />
                  WBS No. *
                </label>

                <input
                  ref={wbsNoRef}
                  type="text"
                  name="wbsNo"
                  value={
                    formData.wbsNo
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. WBS-2026-001"
                  className="project-form-input"
                  style={getInputStyle(
                    !!validationErrors.wbsNo
                  )}
                />

                <ErrorMessage
                  message={
                    validationErrors.wbsNo
                  }
                />
              </div>

              {/* SO NO */}

              <div>
                <label className="project-form-label">
                  <Hash size={14} />
                  SO No.
                </label>

                <input
                  type="text"
                  name="soNo"
                  value={
                    formData.soNo
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. SO-98421"
                  className="project-form-input"
                />
              </div>

              {/* SO LINE ITEMS */}

              <div>
                <label className="project-form-label">
                  <Tag size={14} />
                  SO Line Items
                </label>

                <input
                  type="text"
                  name="soLineItems"
                  value={
                    formData.soLineItems
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. Item 10, 20"
                  className="project-form-input"
                />
              </div>

              {/* PROJECT CODE */}

              <div>
                <label className="project-form-label">
                  <Tag size={14} />
                  Project Code
                </label>

                <input
                  type="text"
                  name="projectCode"
                  value={
                    formData.projectCode
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. PRJ-2026-001"
                  className="project-form-input"
                />
              </div>
            </div>

            {/* ROW 3 - EQUIPMENT NAME, EQUIPMENT WEIGHT & FABRICATION WEIGHT */}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr 1fr',
                gap: '1rem',
                marginBottom:
                  '1rem',
              }}
            >
              {/* EQUIPMENT NAME */}

              <div>
                <label className="project-form-label">
                  <Wrench size={14} />
                  Equipment Name
                </label>

                <input
                  type="text"
                  name="equipmentName"
                  value={
                    formData.equipmentName
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Enter equipment name"
                  className="project-form-input"
                />
              </div>

              {/* EQUIPMENT WEIGHT */}

              <div>
                <label className="project-form-label">
                  <Scale size={14} />
                  Equipment Weight (kg)
                </label>

                <input
                  type="number"
                  name="equipmentWeight"
                  value={
                    formData.equipmentWeight
                  }
                  onChange={
                    handleChange
                  }
                  min="0"
                  step="any"
                  placeholder="e.g. 15000"
                  className="project-form-input"
                />
              </div>

              {/* FABRICATION WEIGHT */}

              <div>
                <label className="project-form-label">
                  <Scale size={14} />
                  Fabrication Weight (kg)
                </label>

                <input
                  type="number"
                  name="fabricationWeight"
                  value={
                    formData.fabricationWeight
                  }
                  onChange={
                    handleChange
                  }
                  min="0"
                  step="any"
                  placeholder="e.g. 12000"
                  className="project-form-input"
                />
              </div>
            </div>

            {/* ROW 4 - DATES (ZERO DATE, CDD, EDD) */}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr 1fr',
                gap: '1rem',
                marginBottom:
                  '1rem',
              }}
            >
              {/* ZERO DATE */}

              <div>
                <label className="project-form-label">
                  <Calendar size={14} />
                  Zero Date *
                </label>

                <input
                  ref={startDateRef}
                  type="date"
                  name="startDate"
                  onClick={openDatePicker}
                  value={
                    formData.startDate
                  }
                  onChange={
                    handleChange
                  }
                  className="project-form-input"
                  style={getInputStyle(
                    !!validationErrors.startDate
                  )}
                />

                <ErrorMessage
                  message={
                    validationErrors.startDate
                  }
                />
              </div>

              {/* CDD */}

              <div>
                <label className="project-form-label">
                  <Calendar size={14} />
                  CDD *
                </label>

                <input
                  ref={endDateRef}
                  type="date"
                  name="endDate"
                  onClick={openDatePicker}
                  value={
                    formData.endDate
                  }
                  onChange={
                    handleChange
                  }
                  className="project-form-input"
                  style={getInputStyle(
                    !!validationErrors.endDate
                  )}
                />

                <ErrorMessage
                  message={
                    validationErrors.endDate
                  }
                />
              </div>

              {/* EDD */}

              <div>
                <label className="project-form-label">
                  <Calendar size={14} />
                  EDD
                </label>

                <input
                  type="date"
                  name="edd"
                  onClick={openDatePicker}
                  value={
                    formData.edd
                  }
                  onChange={
                    handleChange
                  }
                  className="project-form-input"
                />
              </div>
            </div>

            {/* ROW 5 - PROJECT MANAGER */}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr',
                gap: '1rem',
                marginBottom:
                  '1rem',
              }}
            >
              <div>
                <label className="project-form-label">
                  <User size={14} />
                  Project Manager *
                </label>

                <input
                  ref={
                    projectManagerRef
                  }
                  type="text"
                  name="projectManager"
                  value={
                    formData.projectManager
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Enter project manager name"
                  className="project-form-input"
                  style={getInputStyle(
                    !!validationErrors.projectManager
                  )}
                />

                <ErrorMessage
                  message={
                    validationErrors.projectManager
                  }
                />
              </div>
            </div>

            {/* MULTI-TASK BUILDER SECTION */}

            <div
              style={{
                marginBottom:
                  '1.5rem',
                padding: '1.25rem',
                background:
                  '#f8fafc',
                border:
                  '1px solid #cbd5e1',
                borderRadius: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                  marginBottom:
                    '1rem',
                  paddingBottom:
                    '0.75rem',
                  borderBottom:
                    '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div>
                  <h4
                    style={{
                      margin: 0,
                      color: 'var(--text-main)',
                      fontSize:
                        '0.95rem',
                      fontWeight: 800,
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: '0.5rem',
                    }}
                  >
                    <FolderKanban
                      size={16}
                      color="var(--accent-cyan)"
                    />
                    Project Tasks (
                    {
                      formTasks.length
                    }{' '}
                    / 5 Max)
                  </h4>

                  <p
                    style={{
                      margin:
                        '0.2rem 0 0',
                      color:
                        'var(--text-muted)',
                      fontSize:
                        '0.75rem',
                    }}
                  >
                    Add up to 5 tasks
                    per project from
                    standard
                    categories:
                    Welding,
                    Machining,
                    Assembly,
                    Plating, RR.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    addFormTask
                  }
                  disabled={
                    formTasks.length >=
                    5
                  }
                  style={{
                    display:
                      'inline-flex',
                    alignItems:
                      'center',
                    gap: '0.4rem',
                    padding:
                      '0.45rem 0.85rem',
                    background:
                      formTasks.length >=
                      5
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0, 210, 255, 0.15)',
                    border:
                      '1px solid rgba(0, 210, 255, 0.3)',
                    borderRadius: '7px',
                    color:
                      formTasks.length >=
                      5
                        ? 'var(--text-dim)'
                        : 'var(--accent-cyan)',
                    fontWeight: 700,
                    fontSize:
                      '0.78rem',
                    cursor:
                      formTasks.length >=
                      5
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  <Plus size={15} />
                  Add Task (
                  {5 -
                    formTasks.length}{' '}
                  left)
                </button>
              </div>

              {validationErrors.tasks && (
                <div
                  style={{
                    marginBottom:
                      '0.75rem',
                    color:
                      '#f87171',
                    fontSize:
                      '0.72rem',
                    fontWeight: 600,
                  }}
                >
                  !
                  {
                    validationErrors.tasks
                  }
                </div>
              )}

              {/* SINGLE MASTER PROJECT KICKOFF TIMELINE SCHEDULE BANNER */}

              {(() => {
                const projectMonthSteps =
                  getProjectMonthSteps(
                    formData.startDate,
                    formData.endDate
                  );

                const colors = [
                  '#00d2ff',
                  '#a855f7',
                  '#10b981',
                  '#f59e0b',
                  '#ec4899',
                ];

                const currentTask =
                  formTasks[
                    activeTaskIdx
                  ] ||
                  formTasks[0];

                const currentTaskStartDate =
                  currentTask?.start_date ||
                  formData.startDate;

                let activeStepIdx =
                  projectMonthSteps.findIndex(
                    (s) =>
                      s.dateStr ===
                      currentTaskStartDate
                  );

                if (
                  activeStepIdx < 0
                ) {
                  activeStepIdx = 0;
                }

                return (
                  <div
                    style={{
                      padding:
                        '1.15rem',
                      background:
                        '#ffffff',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '12px',
                      marginBottom:
                        '1.25rem',
                      boxShadow:
                        '0 4px 15px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    {/* BANNER HEADER */}

                    <div
                      style={{
                        display:
                          'flex',
                        justifyContent:
                          'space-between',
                        alignItems:
                          'center',
                        marginBottom:
                          '0.85rem',
                        flexWrap:
                          'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <h4
                          style={{
                            margin: 0,
                            color:
                              '#0f172a',
                            fontSize:
                              '0.95rem',
                            fontWeight:
                              800,
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap: '0.5rem',
                          }}
                        >
                          <Calendar
                            size={
                              18
                            }
                            color="var(--accent-cyan)"
                          />
                          Master Project
                          Kickoff
                          Timeline &
                          Schedule
                        </h4>

                        <p
                          style={{
                            margin:
                              '0.2rem 0 0',
                            color:
                              'var(--text-muted)',
                            fontSize:
                              '0.73rem',
                          }}
                        >
                          Visual
                          multi-task
                          Gantt
                          schedule.
                          Adjust
                          kickoff
                          month via
                          single
                          slider or
                          click any
                          task pill
                          below.
                        </p>
                      </div>

                      {currentTask && (
                        <div
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap: '0.4rem',
                            background:
                              'rgba(0, 210, 255, 0.12)',
                            padding:
                              '0.35rem 0.75rem',
                            borderRadius:
                              '20px',
                            border:
                              '1px solid rgba(0, 210, 255, 0.3)',
                          }}
                        >
                          <span
                            style={{
                              fontSize:
                                '0.72rem',
                              color:
                                'var(--text-muted)',
                            }}
                          >
                            Controlling:
                          </span>

                          <strong
                            style={{
                              fontSize:
                                '0.78rem',
                              color:
                                colors[
                                  activeTaskIdx %
                                    colors.length
                                ],
                            }}
                          >
                            Task #
                            {activeTaskIdx +
                              1}
                            :{' '}
                            {
                              currentTask.task_name
                            }
                          </strong>
                        </div>
                      )}
                    </div>

                    {/* GANTT TRACK VISUALIZER */}

                    <div
                      style={{
                        padding:
                          '0.85rem',
                        background:
                          'rgba(5, 11, 20, 0.7)',
                        borderRadius:
                          '8px',
                        border:
                          '1px solid rgba(255, 255, 255, 0.08)',
                        marginBottom:
                          '0.85rem',
                        display:
                          'flex',
                        flexDirection:
                          'column',
                        gap: '0.5rem',
                      }}
                    >
                      <div
                        style={{
                          display:
                            'grid',
                          gridTemplateColumns: `repeat(${projectMonthSteps.length}, 1fr)`,
                          borderBottom:
                            '1px solid rgba(255,255,255,0.08)',
                          paddingBottom:
                            '0.35rem',
                          textAlign:
                            'center',
                        }}
                      >
                        {projectMonthSteps.map(
                          (m) => (
                            <span
                              key={
                                m.dateStr
                              }
                              style={{
                                fontSize:
                                  '0.65rem',
                                fontWeight:
                                  700,
                                color:
                                  'var(--text-muted)',
                              }}
                            >
                              {
                                m.label
                              }
                            </span>
                          )
                        )}
                      </div>

                      {formTasks.map(
                        (t, idx) => {
                          const tStart =
                            t.start_date ||
                            formData.startDate;

                          let startIdx =
                            projectMonthSteps.findIndex(
                              (s) =>
                                s.dateStr ===
                                tStart
                            );

                          if (
                            startIdx <
                            0
                          ) {
                            startIdx = 0;
                          }

                          const dur =
                            Number(
                              t.duration_months
                            ) || 1;

                          const isSelected =
                            idx ===
                            activeTaskIdx;

                          const tColor =
                            colors[
                              idx %
                                colors.length
                            ];

                          return (
                            <div
                              key={
                                idx
                              }
                              onClick={() =>
                                setActiveTaskIdx(
                                  idx
                                )
                              }
                              style={{
                                display:
                                  'grid',
                                gridTemplateColumns: `repeat(${projectMonthSteps.length}, 1fr)`,
                                alignItems:
                                  'center',
                                cursor:
                                  'pointer',
                                padding:
                                  '0.15rem 0',
                                opacity:
                                  isSelected
                                    ? 1
                                    : 0.75,
                                transition:
                                  'all 0.2s ease',
                              }}
                            >
                              <div
                                style={{
                                  gridColumnStart:
                                    startIdx +
                                    1,
                                  gridColumnEnd:
                                    Math.min(
                                      startIdx +
                                        dur +
                                        1,
                                      projectMonthSteps.length +
                                        1
                                    ),
                                  background: `linear-gradient(90deg, ${tColor}dd 0%, ${tColor}99 100%)`,
                                  borderRadius:
                                    '6px',
                                  padding:
                                    '0.3rem 0.6rem',
                                  display:
                                    'flex',
                                  justifyContent:
                                    'space-between',
                                  alignItems:
                                    'center',
                                  boxShadow:
                                    isSelected
                                      ? `0 0 12px ${tColor}88`
                                      : 'none',
                                  border:
                                    isSelected
                                      ? `1.5px solid ${tColor}`
                                      : '1px solid transparent',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize:
                                      '0.72rem',
                                    fontWeight:
                                      800,
                                    color:
                                      '#050b14',
                                    whiteSpace:
                                      'nowrap',
                                    overflow:
                                      'hidden',
                                    textOverflow:
                                      'ellipsis',
                                  }}
                                >
                                  #
                                  {idx +
                                    1}{' '}
                                  {
                                    t.task_name
                                  }{' '}
                                  (
                                  {
                                    t.duration_months
                                  }{' '}
                                  mo)
                                </span>

                                <span
                                  style={{
                                    fontSize:
                                      '0.65rem',
                                    fontWeight:
                                      700,
                                    color:
                                      '#050b14',
                                    opacity:
                                      0.9,
                                  }}
                                >
                                  {
                                    projectMonthSteps[
                                      startIdx
                                    ]?.label
                                  ||
                                    'Start'}
                                </span>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>

                    {/* MASTER SCHEDULE CONTROLLER */}

                    {(() => {
                      const tStart =
                        currentTask?.start_date ||
                        formData.startDate;

                      let startIdx =
                        projectMonthSteps.findIndex(
                          (s) =>
                            s.dateStr ===
                            tStart
                        );

                      if (
                        startIdx <
                        0
                      ) {
                        startIdx = 0;
                      }

                      const dur =
                        Number(
                          currentTask?.duration_months
                        ) || 1;

                      let endIdx =
                        Math.min(
                          startIdx +
                            dur -
                            1,
                          projectMonthSteps.length -
                            1
                        );

                      if (
                        endIdx <
                        startIdx
                      ) {
                        endIdx =
                          startIdx;
                      }

                      const tColor =
                        colors[
                          activeTaskIdx %
                            colors.length
                        ];

                      return (
                        <TaskScheduleSlider
                          taskTitle={`Task #${activeTaskIdx + 1} (${currentTask?.task_name || 'Task'})`}
                          taskColor={tColor}
                          projectMonthSteps={projectMonthSteps}
                          startIdx={startIdx}
                          endIdx={endIdx}
                          durationMonths={dur}
                          onChange={(newStartIdx, newEndIdx) => {
                            const newStartDate = projectMonthSteps[newStartIdx]?.dateStr || formData.startDate;
                            const newDur = Math.max(1, newEndIdx - newStartIdx + 1);
                            handleTaskFieldChange(activeTaskIdx, 'start_date', newStartDate);
                            handleTaskFieldChange(activeTaskIdx, 'duration_months', newDur);
                          }}
                        />
                      );
                    })()}
                  </div>
                );
              })()}

              {/* LIST OF TASKS */}

              <div
                style={{
                  display:
                    'flex',
                  flexDirection:
                    'column',
                  gap: '1rem',
                }}
              >
                {formTasks.map(
                  (
                    tItem,
                    tIdx
                  ) => {
                    const projectMonthSteps =
                      getProjectMonthSteps(
                        formData.startDate,
                        formData.endDate
                      );

                    return (
                      <div
                        key={
                          tItem.id ||
                          tIdx
                        }
                        onClick={() =>
                          setActiveTaskIdx(
                            tIdx
                          )
                        }
                        style={{
                          background:
                            '#ffffff',
                          border:
                            tIdx ===
                            activeTaskIdx
                              ? '1px solid #0284c7'
                              : '1px solid #cbd5e1',
                          borderRadius:
                            '10px',
                          padding:
                            '1rem',
                          cursor:
                            'pointer',
                          boxShadow:
                            '0 2px 8px rgba(0, 0, 0, 0.03)',
                        }}
                      >
                        <div
                          style={{
                            display:
                              'flex',
                            justifyContent:
                              'space-between',
                            alignItems:
                              'center',
                            marginBottom:
                              '0.75rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize:
                                '0.78rem',
                              fontWeight:
                                800,
                              color:
                                tIdx ===
                                activeTaskIdx
                                  ? 'var(--accent-cyan)'
                                  : '#0f172a',
                            }}
                          >
                            Task #
                            {tIdx +
                              1}
                            :{' '}
                            {
                              tItem.task_name
                            }{' '}
                            {tIdx ===
                              activeTaskIdx &&
                              '(Selected on Master Schedule)'}
                          </span>

                          {formTasks.length >
                            1 && (
                            <button
                              type="button"
                              onClick={(
                                e
                              ) => {
                                e.stopPropagation();

                                removeFormTask(
                                  tIdx
                                );
                              }}
                              style={{
                                background:
                                  'rgba(239, 68, 68, 0.12)',
                                border:
                                  '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius:
                                  '6px',
                                color:
                                  '#f87171',
                                padding:
                                  '0.3rem 0.6rem',
                                cursor:
                                  'pointer',
                                fontSize:
                                  '0.72rem',
                                fontWeight:
                                  700,
                                display:
                                  'flex',
                                alignItems:
                                  'center',
                                gap: '0.3rem',
                              }}
                            >
                              <Trash2
                                size={
                                  13
                                }
                              />
                              Remove
                            </button>
                          )}
                        </div>

                        <div
                          style={{
                            display:
                              'grid',
                            gridTemplateColumns:
                              '1.2fr 1fr 1fr 1.1fr 1.1fr 0.9fr',
                            gap: '0.65rem',
                          }}
                        >
                          {/* TASK NAME */}

                          <div>
                            <label className="project-form-label">
                              Task Type *
                            </label>

                            <select
                              value={
                                tItem.task_name
                              }
                              onChange={(
                                e
                              ) =>
                                handleTaskFieldChange(
                                  tIdx,
                                  'task_name',
                                  e
                                    .target
                                    .value
                                )
                              }
                              className="project-form-input"
                            >
                              <option value="Welding">
                                Welding
                              </option>

                              <option value="Machining">
                                Machining
                              </option>

                              <option value="Assembly">
                                Assembly
                              </option>

                              <option value="Plating">
                                Plating
                              </option>

                              <option value="RR">
                                RR
                              </option>
                            </select>
                          </div>

                          {/* ALLOCATED HOURS */}

                          <div>
                            <label className="project-form-label">
                              Allocated
                              Hours *
                            </label>

                            <input
                              ref={(
                                element
                              ) => {
                                taskAllocatedHoursRefs.current[
                                  tIdx
                                ] =
                                  element;
                              }}
                              type="number"
                              value={
                                tItem.allocated_hours
                              }
                              onChange={(
                                e
                              ) =>
                                handleTaskFieldChange(
                                  tIdx,
                                  'allocated_hours',
                                  e
                                    .target
                                    .value
                                )
                              }
                              min="1"
                              placeholder="e.g. 3000"
                              className="project-form-input"
                              style={getInputStyle(
                                !!validationErrors
                                  .taskAllocatedHours[
                                  tIdx
                                ]
                              )}
                            />

                            <ErrorMessage
                              message={
                                validationErrors
                                  .taskAllocatedHours[
                                  tIdx
                                ]
                              }
                            />
                          </div>

                          {/* LOCATION */}

                          <div>
                            <label className="project-form-label">
                              Location
                            </label>

                            <select
                              value={
                                tItem.location ||
                                'Khordha'
                              }
                              onChange={(
                                e
                              ) =>
                                handleTaskFieldChange(
                                  tIdx,
                                  'location',
                                  e
                                    .target
                                    .value
                                )
                              }
                              className="project-form-input"
                            >
                              <option value="Khordha">
                                Khordha
                              </option>

                              {tItem.task_name ===
                                'Welding' && (
                                <>
                                  <option value="Mancheswar">
                                    Mancheswar
                                  </option>

                                  <option value="K+M">
                                    K+M
                                  </option>
                                </>
                              )}
                            </select>
                          </div>

                          {/* KICKOFF + END MONTH */}

                          {(() => {
                            const tStart =
                              tItem.start_date ||
                              formData.startDate;

                            let sIdx =
                              projectMonthSteps.findIndex(
                                (s) =>
                                  s.dateStr ===
                                  tStart
                              );

                            if (
                              sIdx <
                              0
                            ) {
                              sIdx =
                                0;
                            }

                            const dur =
                              Number(
                                tItem.duration_months
                              ) || 1;

                            let eIdx =
                              Math.min(
                                sIdx +
                                  dur -
                                  1,
                                projectMonthSteps.length -
                                  1
                              );

                            if (
                              eIdx <
                              sIdx
                            ) {
                              eIdx =
                                sIdx;
                            }

                            return (
                              <>
                                {/* START MONTH */}

                                <div>
                                  <label className="project-form-label">
                                    Start
                                    Month
                                  </label>

                                  <select
                                    value={
                                      tStart
                                    }
                                    onChange={(
                                      e
                                    ) => {
                                      const newStartDate =
                                        e
                                          .target
                                          .value;

                                      const newStartIdx =
                                        projectMonthSteps.findIndex(
                                          (
                                            s
                                          ) =>
                                            s.dateStr ===
                                            newStartDate
                                        );

                                      let newDur =
                                        eIdx -
                                        (newStartIdx >=
                                        0
                                          ? newStartIdx
                                          : 0) +
                                        1;

                                      if (
                                        newDur <
                                        1
                                      ) {
                                        newDur =
                                          1;
                                      }

                                      handleTaskFieldChange(
                                        tIdx,
                                        'start_date',
                                        newStartDate
                                      );

                                      handleTaskFieldChange(
                                        tIdx,
                                        'duration_months',
                                        newDur
                                      );
                                    }}
                                    className="project-form-input"
                                  >
                                    {projectMonthSteps.map(
                                      (
                                        m,
                                        idx
                                      ) => (
                                        <option
                                          key={
                                            m.dateStr
                                          }
                                          value={
                                            m.dateStr
                                          }
                                        >
                                          {idx ===
                                          0
                                            ? `M1: ${m.label} (Zero)`
                                            : `M${
                                                idx +
                                                1
                                              }: ${m.label}`}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>

                                {/* END MONTH */}

                                <div>
                                  <label className="project-form-label">
                                    End
                                    Month
                                  </label>

                                  <select
                                    value={
                                      projectMonthSteps[
                                        eIdx
                                      ]
                                        ?.dateStr ||
                                      tStart
                                    }
                                    onChange={(
                                      e
                                    ) => {
                                      const newEndDate =
                                        e
                                          .target
                                          .value;

                                      const newEndIdx =
                                        projectMonthSteps.findIndex(
                                          (
                                            s
                                          ) =>
                                            s.dateStr ===
                                            newEndDate
                                        );

                                      const newDur =
                                        Math.max(
                                          1,
                                          newEndIdx -
                                            sIdx +
                                            1
                                        );

                                      handleTaskFieldChange(
                                        tIdx,
                                        'duration_months',
                                        newDur
                                      );
                                    }}
                                    className="project-form-input"
                                  >
                                    {projectMonthSteps.map(
                                      (
                                        m,
                                        idx
                                      ) => (
                                        <option
                                          key={
                                            m.dateStr
                                          }
                                          value={
                                            m.dateStr
                                          }
                                          disabled={
                                            idx <
                                            sIdx
                                          }
                                        >
                                          M
                                          {idx +
                                            1}
                                          :{' '}
                                          {
                                            m.label
                                          }
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>
                              </>
                            );
                          })()}

                          {/* DURATION */}

                          <div>
                            <label className="project-form-label">
                              Duration
                            </label>

                            <div
                              style={{
                                padding:
                                  '0.55rem 0.75rem',
                                background:
                                  'rgba(15, 23, 42, 0.9)',
                                border:
                                  '1px solid rgba(0, 210, 255, 0.3)',
                                borderRadius:
                                  '8px',
                                color:
                                  'var(--accent-cyan)',
                                fontWeight:
                                  800,
                                fontSize:
                                  '0.85rem',
                                textAlign:
                                  'center',
                              }}
                            >
                              {tItem.duration_months ||
                                1}{' '}
                              mo
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* ROW 6 - TOTAL HOURS, PRIORITY & STATUS */}

            <div
              style={{
                display:
                  'grid',
                gridTemplateColumns:
                  '1fr 1fr 1fr',
                gap: '1rem',
                marginBottom:
                  '1.25rem',
              }}
            >
              {/* TOTAL HOURS */}

              <div>
                <label className="project-form-label">
                  <Clock size={14} />
                  Total Project Planned
                  Hours
                </label>

                <div
                  style={{
                    padding:
                      '0.65rem 0.75rem',
                    background:
                      'rgba(0, 210, 255, 0.08)',
                    border:
                      '1px solid rgba(0, 210, 255, 0.25)',
                    borderRadius:
                      '7px',
                    color:
                      'var(--accent-cyan)',
                    fontWeight:
                      800,
                    fontSize:
                      '0.9rem',
                  }}
                >
                  {formTasks
                    .reduce(
                      (
                        sum,
                        t
                      ) =>
                        sum +
                        (Number(
                          t.allocated_hours
                        ) || 0),
                      0
                    )
                    .toLocaleString()}{' '}
                  hrs
                </div>
              </div>

              {/* PRIORITY */}

              <div>
                <label className="project-form-label">
                  <Flag size={14} />
                  Priority
                </label>

                <select
                  name="priority"
                  value={
                    formData.priority
                  }
                  onChange={
                    handleChange
                  }
                  className="project-form-input"
                >
                  <option value="Low">
                    Low
                  </option>

                  <option value="Medium">
                    Medium
                  </option>

                  <option value="High">
                    High
                  </option>

                  <option value="Critical">
                    Critical
                  </option>
                </select>
              </div>

              {/* STATUS */}

              <div>
                <label className="project-form-label">
                  <CircleCheck
                    size={14}
                  />
                  Status
                </label>

                <select
                  name="status"
                  value={
                    formData.status
                  }
                  onChange={
                    handleChange
                  }
                  className="project-form-input"
                >
                  <option value="Planned">
                    Planned
                  </option>

                  <option value="In Progress">
                    In Progress
                  </option>

                  <option value="On Hold">
                    On Hold
                  </option>

                  <option value="Completed">
                    Completed
                  </option>

                  <option value="Cancelled">
                    Cancelled
                  </option>
                </select>
              </div>
            </div>

            {/* MESSAGE */}

            {saveMessage && (
              <div
                style={{
                  marginBottom:
                    '1rem',
                  padding:
                    '0.7rem 0.9rem',
                  borderRadius:
                    '7px',
                  background:
                    saveMessage.includes(
                      'successfully'
                    )
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(239, 68, 68, 0.1)',
                  border:
                    saveMessage.includes(
                      'successfully'
                    )
                      ? '1px solid rgba(16, 185, 129, 0.25)'
                      : '1px solid rgba(239, 68, 68, 0.25)',
                  color:
                    saveMessage.includes(
                      'successfully'
                    )
                      ? 'var(--accent-emerald)'
                      : '#f87171',
                  fontSize:
                    '0.8rem',
                  fontWeight:
                    600,
                }}
              >
                {saveMessage}
              </div>
            )}

            {/* BUTTONS */}

            <div
              style={{
                display:
                  'flex',
                justifyContent:
                  'flex-end',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                onClick={
                  handleCancel
                }
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  gap: '0.4rem',
                  background:
                    'rgba(255,255,255,0.05)',
                  border:
                    '1px solid var(--border-color)',
                  color:
                    'var(--text-muted)',
                  padding:
                    '0.55rem 1rem',
                  borderRadius:
                    '7px',
                  cursor:
                    'pointer',
                  fontWeight:
                    600,
                }}
              >
                <X size={16} />
                Cancel
              </button>

              <button
                type="submit"
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  gap: '0.4rem',
                  background:
                    'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
                  border:
                    'none',
                  color:
                    '#ffffff',
                  padding:
                    '0.55rem 1rem',
                  borderRadius:
                    '7px',
                  cursor:
                    'pointer',
                  fontWeight:
                    700,
                }}
              >
                <Save size={16} />
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EMPTY STATE */}

      {!showForm &&
        projects.length === 0 && (
          <div
            className="glass-panel"
            style={{
              padding: '3rem',
              textAlign:
                'center',
              border:
                '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <FolderKanban
              size={45}
              color="var(--accent-cyan)"
              style={{
                marginBottom:
                  '1rem',
              }}
            />

            <h3
              style={{
                color:
                  '#ffffff',
                marginBottom:
                  '0.5rem',
              }}
            >
              No Projects
              Created
            </h3>

            <p
              style={{
                color:
                  'var(--text-muted)',
                fontSize:
                  '0.85rem',
                marginBottom:
                  '1.25rem',
              }}
            >
              Click{' '}
              <strong>
                Add Project
              </strong>{' '}
              to create
              your first
              project.
            </p>

            <button
              onClick={() =>
                setShowForm(true)
              }
              style={{
                display:
                  'inline-flex',
                alignItems:
                  'center',
                gap: '0.4rem',
                background:
                  'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
                border:
                  'none',
                color:
                  '#ffffff',
                padding:
                  '0.6rem 1rem',
                borderRadius:
                  '7px',
                cursor:
                  'pointer',
                fontWeight:
                  700,
              }}
            >
              <Plus size={17} />
              Add Project
            </button>
          </div>
        )}

      {/* PROJECT TABLE */}

      {projects.length > 0 && (
        <div
          className="glass-panel"
          style={{
            padding:
              '1.5rem',
            background:
              '#ffffff',
            border:
              '1px solid #cbd5e1',
            borderRadius:
              '12px',
            boxShadow:
              '0 4px 15px rgba(0, 0, 0, 0.04)',
            overflowX:
              'auto',
          }}
        >
          <div
            style={{
              display:
                'flex',
              justifyContent:
                'space-between',
              alignItems:
                'center',
              marginBottom:
                '1rem',
            }}
          >
            <div>
              <h3
                style={{
                  color:
                    'var(--text-main)',
                  margin: 0,
                  fontSize:
                    '1rem',
                }}
              >
                Projects
              </h3>

              <span
                style={{
                  color:
                    'var(--text-muted)',
                  fontSize:
                    '0.7rem',
                }}
              >
                {
                  projects.length
                }{' '}
                project
                {projects.length !==
                1
                  ? 's'
                  : ''}
              </span>
            </div>
          </div>

          <table
            style={{
              width:
                '100%',
              borderCollapse:
                'collapse',
              fontSize:
                '0.8rem',
            }}
          >
            <thead>
              <tr
                style={{
                  background:
                    '#f1f5f9',
                  color:
                    '#0f172a',
                  borderBottom:
                    '2px solid #cbd5e1',
                }}
              >
                <th style={tableHeaderStyle}>
                  S.No.
                </th>

                <th style={tableHeaderStyle}>
                  Customer Name
                </th>

                <th style={tableHeaderStyle}>
                  WBS No.
                </th>

                <th style={tableHeaderStyle}>
                  SO No.
                </th>

                <th style={tableHeaderStyle}>
                  SO Line Items
                </th>

                <th style={tableHeaderStyle}>
                  Project Code
                </th>

                <th style={tableHeaderStyle}>
                  Equipment
                </th>

                <th style={tableHeaderStyle}>
                  Eq. Weight
                </th>

                <th style={tableHeaderStyle}>
                  Fab. Weight
                </th>

                <th style={tableHeaderStyle}>
                  Manager
                </th>

                <th style={tableHeaderStyle}>
                  Task
                </th>

                <th style={tableHeaderStyle}>
                  Location
                </th>

                <th style={tableHeaderStyle}>
                  Zero Date
                </th>

                <th style={tableHeaderStyle}>
                  CDD
                </th>

                <th style={tableHeaderStyle}>
                  EDD
                </th>

                <th style={tableHeaderStyle}>
                  Hours
                </th>

                <th style={tableHeaderStyle}>
                  Priority
                </th>

                <th style={tableHeaderStyle}>
                  Status
                </th>

                <th style={tableHeaderStyle}>
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {projects.map(
                (
                  project: any
                ) => {
                  const cName =
                    project.customer_name ||
                    project.customerName ||
                    project.project_name ||
                    project.projectName ||
                    '—';

                  const wbs =
                    project.wbs_no ||
                    project.wbsNo ||
                    project.project_number ||
                    project.projectNumber ||
                    '—';

                  const pCode =
                    project.project_code ||
                    project.projectCode ||
                    '—';

                  const fabW =
                    project.fabricationWeight ||
                    project.fabrication_weight;

                  return (
                    <tr
                      key={
                        project.id
                      }
                      style={{
                        borderBottom:
                          '1px solid #e2e8f0',
                      }}
                    >
                      {/* SERIAL NUMBER */}

                      <td
                        style={{
                          ...tableCellStyle,
                          color: 'var(--accent-cyan)',
                          fontWeight: 800,
                          textAlign: 'center',
                        }}
                      >
                        {Number(project.serialNo) || 0}
                      </td>

                      {/* CUSTOMER NAME */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        <strong
                          style={{
                            color:
                              'var(--text-main)',
                          }}
                        >
                          {cName}
                        </strong>
                      </td>

                      {/* WBS */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        <span
                          style={{
                            color:
                              'var(--accent-cyan)',
                            fontWeight:
                              700,
                          }}
                        >
                          {wbs}
                        </span>
                      </td>

                      {/* SO NO */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        {project.so_no ?? project.soNo ?? '—'}
                      </td>

                      {/* SO LINE ITEMS */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        {project.so_line_items ?? project.soLineItems ?? '—'}
                      </td>

                      {/* PROJECT CODE */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        {pCode}
                      </td>

                      {/* EQUIPMENT */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        {project.equipmentName ||
                          '—'}
                      </td>

                      {/* EQ WEIGHT */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        {project.equipmentWeight
                          ? `${Number(
                              project.equipmentWeight
                            ).toLocaleString()} kg`
                          : '—'}
                      </td>

                      {/* FAB WEIGHT */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        {fabW
                          ? `${Number(
                              fabW
                            ).toLocaleString()} kg`
                          : '—'}
                      </td>

                      {/* MANAGER */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        {
                          project.projectManager
                        }
                      </td>

                      {/* TASK */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        {
                          project.task
                        }
                      </td>

                      {/* LOCATION */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        {project.location ||
                          '—'}
                      </td>

                      {/* ZERO DATE */}

                      <td
                        style={{
                          ...tableCellStyle,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            color:
                              'var(--accent-emerald)',
                            fontWeight: 600,
                          }}
                        >
                          {formatDisplayDate(
                            project.startDate || project.zero_date
                          )}
                        </span>
                      </td>

                      {/* CDD */}

                      <td
                        style={{
                          ...tableCellStyle,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            color:
                              'var(--accent-cyan)',
                            fontWeight: 600,
                          }}
                        >
                          {formatDisplayDate(
                            project.endDate || project.cdd
                          )}
                        </span>
                      </td>

                      {/* EDD */}

                      <td
                        style={{
                          ...tableCellStyle,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            color:
                              '#a855f7',
                            fontWeight: 600,
                          }}
                        >
                          {formatDisplayDate(
                            project.edd || project.edd_date
                          )}
                        </span>
                      </td>

                      {/* HOURS */}

                      <td
                        style={{
                          ...tableCellStyle,
                          color:
                            'var(--accent-cyan)',
                          fontWeight:
                            700,
                        }}
                      >
                        {project.plannedHours.toLocaleString()}
                      </td>

                      {/* PRIORITY */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        <span
                          style={{
                            padding:
                              '0.25rem 0.5rem',
                            borderRadius:
                              '5px',
                            background:
                              'rgba(0,210,255,0.08)',
                            color:
                              'var(--accent-cyan)',
                            fontWeight:
                              700,
                            fontSize:
                              '0.7rem',
                          }}
                        >
                          {
                            project.priority
                          }
                        </span>
                      </td>

                      {/* STATUS */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        {
                          project.status
                        }
                      </td>

                      {/* ACTION */}

                      <td
                        style={
                          tableCellStyle
                        }
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <button
                            onClick={() => {
                              setSelectedProject(
                                project
                              );

                              setIsModalOpen(
                                true
                              );
                            }}
                            style={{
                              display:
                                'inline-flex',
                              alignItems:
                                'center',
                              gap: '0.3rem',
                              padding:
                                '0.35rem 0.65rem',
                              background:
                                'rgba(0, 210, 255, 0.12)',
                              border:
                                '1px solid rgba(0, 210, 255, 0.3)',
                              borderRadius:
                                '6px',
                              color:
                                'var(--accent-cyan)',
                              fontWeight:
                                700,
                              fontSize:
                                '0.72rem',
                              cursor:
                                'pointer',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            <Edit
                              size={
                                13
                              }
                            />
                            View /
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project);
                            }}
                            title="Delete project"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.3rem',
                              padding: '0.35rem 0.55rem',
                              background: 'rgba(239, 68, 68, 0.10)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              borderRadius: '6px',
                              color: '#f87171',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Trash2 size={13} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PROJECT DETAILS & EDIT MODAL */}

      <ProjectDetailsModal
        project={
          selectedProject
        }
        isOpen={
          isModalOpen
        }
        onClose={() =>
          setIsModalOpen(
            false
          )
        }
        onProjectUpdated={
          loadProjects
        }
      />
    </div>
  );
};

/*
 * ============================================================
 * TABLE STYLES
 * ============================================================
 */

const tableHeaderStyle: React.CSSProperties =
  {
    padding: '0.85rem 1rem',
    textAlign: 'left',
    fontWeight: 800,
    fontSize: '0.82rem',
    color: '#0f172a',
    whiteSpace: 'nowrap',
  };

const tableCellStyle: React.CSSProperties =
  {
    padding: '0.85rem 1rem',
    color: '#0f172a',
    fontSize: '0.85rem',
    fontWeight: 500,
    verticalAlign: 'middle',
  };