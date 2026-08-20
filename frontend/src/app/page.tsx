'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { DashboardView } from '../components/DashboardView';
import { UploadView } from '../components/UploadView';
import { CapacityPlanningView } from "../components/CapacityPlanningView";
import { SummaryView } from "../components/SummaryView";
import { HistoryView } from '../components/HistoryView';
import { BenchmarksView } from '../components/BenchmarksView';
import { ProjectPlanningView } from '../components/ProjectPlanningView';
import { LoginView } from '../components/LoginView';
import { SmsGroupLogo } from '../components/SmsGroupLogo';
import { 
  fetchPlanningVersions, 
  fetchLatestPlanningVersion, 
  fetchBenchmarks, 
  verifyCurrentToken,
  logoutUserApi,
  PlanningVersion, 
  ManualCalculationResponse,
  BenchmarkItem,
  AuthUser
} from '../lib/api';

const FALLBACK_VERSION: PlanningVersion = {
  id: 1,
  version_id: "2026-08-V1",
  month_name: "August 2026",
  horizon: "Aug 2026 - Jul 2027",
  upload_date: new Date().toISOString(),
  uploaded_by: "J. Smith (Sr. Production Planner)",
  status: "Validated",
  file_name: "PD-Bhubaneswar-Aug2026-Planning.xlsx",
  file_size: "4.8 MB",
  processing_time_ms: 1420,
  months: [
    "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026", "Jan 2027",
    "Feb 2027", "Mar 2027", "Apr 2027", "May 2027", "Jun 2027", "Jul 2027"
  ],
  departments: {
    production: {
      capacityHours: [12000, 12000, 12500, 12000, 11500, 12000, 12000, 12500, 12000, 12000, 12500, 12000],
      loadHours:     [10500, 11200, 11800, 12400, 10900, 10800, 11400, 11900, 11100, 11600, 12100, 11300],
      ordersCount:   [145, 152, 160, 168, 140, 142, 150, 158, 149, 155, 162, 151]
    },
    welding: {
      capacityHours: [4500, 4500, 4500, 4500, 4200, 4500, 4500, 4500, 4500, 4500, 4500, 4500],
      laborSupply:   [4400, 4450, 4500, 4550, 4200, 4450, 4480, 4520, 4460, 4490, 4510, 4470]
    },
    machining: {
      capacityHours: [5200, 5200, 5200, 5200, 4900, 5200, 5200, 5200, 5200, 5200, 5200, 5200],
      millingLoad:   [2600, 2750, 2850, 3010, 2500, 2650, 2780, 2890, 2710, 2820, 2940, 2760]
    },
    rr: {
      capacityHours: [3100, 3100, 3100, 3100, 2900, 3100, 3100, 3100, 3100, 3100, 3100, 3100],
      refurbLoad:    [2700, 2800, 2910, 2980, 2600, 2720, 2830, 2890, 2780, 2850, 2920, 2810]
    },
    plating: {
      capacityHours: [2200, 2200, 2200, 2200, 2000, 2200, 2200, 2200, 2200, 2200, 2200, 2200],
      platingLoad:   [1850, 1920, 1990, 2080, 1780, 1860, 1940, 2010, 1910, 1970, 2030, 1930]
    },
    service_machining: {
      capacityHours: [1800, 1800, 1800, 1800, 1600, 1800, 1800, 1800, 1800, 1800, 1800, 1800],
      serviceLoad:   [1420, 1510, 1580, 1650, 1380, 1460, 1520, 1590, 1490, 1540, 1610, 1500]
    },
    scb: {
      capacityHours: [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000],
      groupCompany:  [5800, 6100, 6400, 6700, 5400, 5900, 6200, 6500, 6000, 6300, 6600, 6100]
    }
  },
  chart_urls: {
    production: '/media/charts/production_dashboard.png',
    welding: '/media/charts/welding_dashboard.png',
    machining: '/media/charts/machining_dashboard.png',
    rr: '/media/charts/rr_dashboard.png',
    plating: '/media/charts/plating_dashboard.png',
    scb: '/media/charts/scb_dashboard.png',
    service_machining: '/media/charts/service_machining_dashboard.png',
  },
  validation_warnings: [
    "Capacity utilization in Nov 2026 reaches 96.4% in Machining Dept.",
    "Service Machining contract hours slightly above historical baseline."
  ]
};

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [versions, setVersions] = useState<PlanningVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<PlanningVersion | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkItem[]>([]);
  const [apiConnected, setApiConnected] = useState<boolean>(false);
  const [manualCalculationResult, setManualCalculationResult] = useState<ManualCalculationResponse | null>(null);

  useEffect(() => {
    async function initSession() {
      try {
        const access = localStorage.getItem("access");
        const savedUser = localStorage.getItem("sms_user");

        if (access && access !== 'demo-access-token') {
          // Verify JWT token against backend endpoint /api/v1/auth/me/
          const verifiedUser = await verifyCurrentToken();
          if (verifiedUser) {
            setCurrentUser(verifiedUser);
            setIsAuthenticated(true);
          } else if (savedUser) {
            // Fallback parsing savedUser if network transient fail
            const parsed = JSON.parse(savedUser);
            if (parsed && parsed.username && parsed.role) {
              setCurrentUser(parsed);
              setIsAuthenticated(true);
            } else {
              localStorage.clear();
              setCurrentUser(null);
              setIsAuthenticated(false);
            }
          } else {
            localStorage.clear();
            setCurrentUser(null);
            setIsAuthenticated(false);
          }
        } else {
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
          localStorage.removeItem("sms_user");
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } catch (e) {
        console.warn("Failed to restore session:", e);
        localStorage.clear();
      } finally {
        setIsInitializing(false);
      }
    }

    initSession();
  }, []);

  const isAdmin = Boolean(currentUser?.role === 'administrator' || currentUser?.is_superuser || currentUser?.is_staff);

  // Access control guard: regular users cannot access capacity-planning, project-planning, or upload
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      if (['capacity-planning', 'project-planning', 'upload'].includes(currentView)) {
        setCurrentView('dashboard');
      }
    }
  }, [isAuthenticated, isAdmin, currentView]);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadInitialData() {
      try {
        const [verList, latestVer, bList] = await Promise.all([
          fetchPlanningVersions(),
          fetchLatestPlanningVersion(),
          fetchBenchmarks()
        ]);

        if (verList && verList.length > 0) {
          setVersions(verList);
          setApiConnected(true);
        } else {
          setVersions([FALLBACK_VERSION]);
        }

        if (latestVer) {
          setSelectedVersion(latestVer);
        } else {
          setSelectedVersion(FALLBACK_VERSION);
        }

        if (bList && bList.length > 0) {
          setBenchmarks(bList);
        }
      } catch (err) {
        console.warn('Backend API connection check fallback:', err);
        setVersions([FALLBACK_VERSION]);
        setSelectedVersion(FALLBACK_VERSION);
      }
    }

    loadInitialData();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (currentView === 'dashboard') {
      fetchLatestPlanningVersion().then(latestVer => {
        if (latestVer) {
          setSelectedVersion(latestVer);
        }
      }).catch(err => console.warn('Failed refreshing latest version on dashboard view:', err));
    }
  }, [currentView, isAuthenticated]);

  const handleLoginSuccess = (
    user: AuthUser,
    access: string,
    refresh: string
  ) => {
    setCurrentUser(user);
    setIsAuthenticated(true);

    try {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      localStorage.setItem("sms_user", JSON.stringify(user));
    } catch (e) {
      console.warn("LocalStorage save failed:", e);
    }
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    await logoutUserApi();
    window.location.href = "/";
  };

  const handleUploadSuccess = (newVersion: PlanningVersion) => {
    setVersions(prev => [newVersion, ...prev]);
    setSelectedVersion(newVersion);
    setCurrentView('dashboard');
  };

  const handleSelectVersion = (version: PlanningVersion) => {
    setSelectedVersion(version);
    setCurrentView('dashboard');
  };

  if (isInitializing) {
    return (
      <div className="login-container">
        <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="spinner-sm" />
          Initializing SMS Group System...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      <Sidebar 
        currentView={currentView} 
        onSelectView={setCurrentView}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <header className="top-header">
          <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <SmsGroupLogo height={32} textColor="#ffffff" />
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.25rem' }}>
              <h2>SMS Capacity Planning Platform</h2>
              <p>SMS Group Enterprise Plant — 12 Month Capacity Horizon</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="status-indicator">
              <div className="dot-online" />
              <span>{apiConnected ? 'System Operational' : 'Offline Mode'}</span>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: isAdmin ? 'rgba(0, 210, 255, 0.12)' : 'rgba(0, 230, 118, 0.12)',
              color: isAdmin ? 'var(--accent-cyan)' : 'var(--accent-emerald)',
              border: `1px solid ${isAdmin ? 'rgba(0, 210, 255, 0.3)' : 'rgba(0, 230, 118, 0.3)'}`
            }}>
              <span>{isAdmin ? '🛡️ Administrator' : '👁️ User (View Only)'}</span>
            </div>

            <button 
              onClick={handleLogout} 
              className="header-logout-btn"
              title="Sign out of system"
            >
              Log Out
            </button>
          </div>
        </header>

        {currentView === 'dashboard' && (
          <DashboardView version={selectedVersion} />
        )}

        {currentView === 'upload' && (
          <UploadView onUploadSuccess={handleUploadSuccess} />
        )}

        {currentView === "capacity-planning" && (
          <CapacityPlanningView onCalculationResultChange={setManualCalculationResult} />
        )}

        {currentView === "project-planning" && (
          <ProjectPlanningView />
        )}

        {currentView === "summary" && (
  <SummaryView
    calculationResult={manualCalculationResult}
    onCalculationResultLoaded={setManualCalculationResult}
  />
)}
        {currentView === 'history' && (
          <HistoryView versions={versions} onSelectVersion={handleSelectVersion} />
        )}

        {currentView === 'benchmarks' && (
          <BenchmarksView benchmarks={benchmarks} />
        )}
      </main>
    </div>
  );
}

