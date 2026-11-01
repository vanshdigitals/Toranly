import React, { useState, useEffect, useRef, useId } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  CheckSquare,
  Store,
  Users,
  Clock,
  Lightbulb,
  Sparkles,
  Settings,
  Layers,
  Printer,
  Download,
  Sliders,
  ChevronDown,
  MoreHorizontal,
  X,
  Plus,
  Check,
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  UserRound,
  Bell,
} from 'lucide-react';
import type { Plan } from '../domain/plan';
import { listPlans } from '../storage/db';
import { formatDisplayDate } from '../lib/dateFormat';
import type { SaveState } from '../lib/saveState';
import './PlannerWorkspaceShell.css';

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'timeline', label: 'Timeline', icon: CheckSquare },
  { id: 'vendors', label: 'Vendors', icon: Store },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'schedule', label: 'Schedule', icon: Clock },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'plan', label: 'AI plan', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface PlannerWorkspaceShellProps {
  plan: Plan;
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  saveStatus: SaveState;
  lastSavedAt: string | null;
  overdueTasksCount?: number;
  onDownloadBackup: () => void;
  children: React.ReactNode;
}

export const PlannerWorkspaceShell: React.FC<PlannerWorkspaceShellProps> = ({
  plan,
  activeTab,
  onSelectTab,
  saveStatus,
  lastSavedAt,
  overdueTasksCount = 0,
  onDownloadBackup,
  children,
}) => {
  const navigate = useNavigate();

  // Sidebar toggle state (persisted across sessions)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('toranly_planner_sidebar_collapsed');
      if (saved !== null) return saved === 'true';
      return typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024;
    } catch {
      return false;
    }
  });

  // Mobile drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Profile popover state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Notifications popover state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Plan selector states (for top header event switcher)
  const [savedPlans, setSavedPlans] = useState<Plan[]>([]);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const selectorListRef = useRef<HTMLDivElement>(null);

  // Mobile more sheet states
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const moreSheetRef = useRef<HTMLDivElement>(null);

  // Accessible IDs
  const planSelectorId = useId();
  const planListboxId = useId();

  // Load saved plans for switcher
  useEffect(() => {
    let isMounted = true;
    listPlans().then((plans) => {
      if (isMounted) setSavedPlans(plans);
    });
    return () => {
      isMounted = false;
    };
  }, [plan.id]);

  // Close menus on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (selectorRef.current && !selectorRef.current.contains(target)) {
        setIsSelectorOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setIsNotificationsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSelectorOpen(false);
        setIsProfileOpen(false);
        setIsNotificationsOpen(false);
        setIsMoreSheetOpen(false);
        setIsMobileSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Format save status
  const getSaveStatusInfo = () => {
    if (saveStatus === 'saving') {
      return { text: 'Saving…', state: 'saving' as const, isError: false };
    }
    if (saveStatus === 'error') {
      return { text: 'Save failed', state: 'error' as const, isError: true };
    }
    return { text: 'Saved', state: 'saved' as const, isError: false };
  };

  const statusInfo = getSaveStatusInfo();

  const saveTooltipText = (() => {
    if (saveStatus === 'saving') return 'Saving changes to local storage…';
    if (saveStatus === 'error') return 'Failed to save changes. Check storage permissions.';
    if (lastSavedAt) {
      try {
        const timeStr = new Date(lastSavedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `All changes saved locally · ${timeStr}`;
      } catch {
        return 'All changes saved locally';
      }
    }
    return 'All changes saved locally';
  })();

  // Toggle sidebar on desktop / tablet / mobile
  const handleToggleSidebar = () => {
    if (window.innerWidth < 768) {
      setIsMobileSidebarOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('toranly_planner_sidebar_collapsed', String(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  };

  // Tab navigation arrow keys handling
  const handleNavKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % NAV_ITEMS.length;
      onSelectTab(NAV_ITEMS[nextIndex].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + NAV_ITEMS.length) % NAV_ITEMS.length;
      onSelectTab(NAV_ITEMS[prevIndex].id);
    }
  };

  const currentNavItem = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="planner-shell-layout">
      {/* ------------------------------------------------------------- */}
      {/* FULL-WIDTH TOP HEADER (64px)                                   */}
      {/* ------------------------------------------------------------- */}
      <header className="planner-topbar" aria-label="Application header">
        <div className="planner-topbar-left">
          {/* 1. SIDEBAR TOGGLE BUTTON */}
          <button
            type="button"
            className="planner-sidebar-toggle-btn"
            onClick={handleToggleSidebar}
            aria-label={
              isMobileSidebarOpen
                ? 'Close sidebar'
                : isSidebarCollapsed
                  ? 'Expand sidebar'
                  : 'Collapse sidebar'
            }
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isSidebarCollapsed}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen size={19} className="planner-toggle-icon" />
            ) : (
              <PanelLeftClose size={19} className="planner-toggle-icon" />
            )}
          </button>

          {/* 2. TORANLY PNG LOGO */}
          <Link
            to="/events"
            className="planner-header-logo-link"
            title="Toranly - My plans"
            aria-label="Toranly celebrations"
          >
            <img
              src="/toranly-logo.png"
              alt="Toranly"
              className="planner-header-logo-img"
              width={90}
              height={36}
            />
          </Link>

          <span className="planner-topbar-divider" aria-hidden="true" />

          {/* 3 & 4. BREADCRUMBS WITH INTEGRATED COMPACT EVENT SWITCHER */}
          <nav aria-label="Breadcrumbs" className="planner-breadcrumb">
            <Link to="/events" className="planner-crumb-link" title="View all saved celebrations">
              My plans
            </Link>

            <span className="planner-crumb-separator" aria-hidden="true">
              /
            </span>

            {/* COMPACT EVENT SWITCHER DROPDOWN */}
            <div className="planner-header-switcher-container" ref={selectorRef}>
              <button
                id={planSelectorId}
                type="button"
                className={`planner-header-switcher-btn ${isSelectorOpen ? 'active' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={isSelectorOpen}
                aria-controls={planListboxId}
                aria-label={`Current celebration: ${plan.event.title}. Click to switch celebration`}
                title={`Switch celebration (Current: ${plan.event.title})`}
                onClick={() => setIsSelectorOpen(!isSelectorOpen)}
              >
                <span className="planner-switcher-title">{plan.event.title}</span>
                <ChevronDown
                  size={14}
                  className={`planner-switcher-chevron ${isSelectorOpen ? 'open' : ''}`}
                />
              </button>

              {isSelectorOpen && (
                <div
                  id={planListboxId}
                  role="listbox"
                  aria-labelledby={planSelectorId}
                  className="planner-header-switcher-popover"
                  ref={selectorListRef}
                >
                  <div className="planner-switcher-popover-header">
                    <span>Switch celebration</span>
                  </div>

                  <div className="planner-switcher-popover-list">
                    {savedPlans.map((p) => {
                      const isCurrent = p.id === plan.id;
                      const eventType = p.event?.type
                        ? p.event.type.charAt(0).toUpperCase() + p.event.type.slice(1)
                        : null;
                      const eventDate = p.event?.eventDate
                        ? formatDisplayDate(p.event.eventDate)
                        : null;
                      const metaText = [eventType, eventDate].filter(Boolean).join(' · ');

                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={isCurrent}
                          className={`planner-switcher-popover-item ${isCurrent ? 'active' : ''}`}
                          onClick={() => {
                            setIsSelectorOpen(false);
                            if (!isCurrent) {
                              navigate(`/events/${p.id}`);
                            }
                          }}
                        >
                          <div className="planner-switcher-item-info">
                            <span className="planner-switcher-item-title">{p.event.title}</span>
                            {metaText && (
                              <span className="planner-switcher-item-meta">{metaText}</span>
                            )}
                          </div>
                          {isCurrent && <Check size={16} className="planner-switcher-check" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="planner-switcher-popover-footer">
                    <Link
                      to="/events/new"
                      className="planner-switcher-popover-action"
                      onClick={() => setIsSelectorOpen(false)}
                    >
                      <Plus size={15} />
                      <span>Create new plan</span>
                    </Link>
                    <Link
                      to="/events"
                      className="planner-switcher-popover-action"
                      onClick={() => setIsSelectorOpen(false)}
                    >
                      <Layers size={15} />
                      <span>View all plans</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <span className="planner-crumb-separator" aria-hidden="true">
              /
            </span>

            <span className="planner-crumb-active">{currentNavItem.label}</span>
          </nav>
        </div>

        {/* 5. TOPBAR RIGHT: ACTIONS & PROFILE */}
        <div className="planner-topbar-right">
          {/* COMPACT CLOUD / DEVICE SAVE STATUS */}
          <div
            className={`planner-header-save-status ${statusInfo.state}`}
            role="status"
            aria-live="polite"
            title={saveTooltipText}
          >
            <span className="planner-header-save-dot" aria-hidden="true" />
            <span className="planner-header-save-text">{statusInfo.text}</span>
          </div>

          <div className="planner-topbar-actions">
            <Link
              to={`/events/${plan.id}/print`}
              className="planner-tool-btn"
              title="Print planner or save as PDF (A4)"
            >
              <Printer size={16} />
              <span className="planner-tool-btn-text">Print / PDF</span>
            </Link>

            <button
              type="button"
              className="planner-tool-btn"
              title="Download .toranly.json backup"
              onClick={onDownloadBackup}
            >
              <Download size={16} />
              <span className="planner-tool-btn-text">Backup</span>
            </button>

            {activeTab === 'overview' && (
              <Link
                to={`/events/${plan.id}/setup?step=1`}
                className="planner-edit-setup-btn"
                title="Edit celebration setup wizard"
              >
                <Sliders size={15} />
                <span className="planner-tool-btn-text">Edit setup</span>
              </Link>
            )}
          </div>

          <span className="planner-topbar-divider planner-divider-actions" aria-hidden="true" />

          {/* CONTROLS GROUP: Notification Bell + Profile Avatar (12-16px gap) */}
          <div className="planner-topbar-user-controls">
            {/* NOTIFICATION BELL */}
            <div className="planner-notifications-container" ref={notificationsRef}>
              <button
                type="button"
                className={`planner-notification-bell-btn ${isNotificationsOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsProfileOpen(false);
                }}
                aria-label={
                  overdueTasksCount > 0
                    ? `Notifications: ${overdueTasksCount} overdue tasks`
                    : 'Notifications'
                }
                title={
                  overdueTasksCount > 0
                    ? `${overdueTasksCount} overdue task alert${overdueTasksCount > 1 ? 's' : ''}`
                    : 'Notifications'
                }
                aria-haspopup="menu"
                aria-expanded={isNotificationsOpen}
              >
                <Bell size={19} className="planner-bell-icon" />
                {overdueTasksCount > 0 && <span className="planner-bell-dot" aria-hidden="true" />}
              </button>

              {/* Notifications Popover */}
              {isNotificationsOpen && (
                <div className="planner-notifications-dropdown" role="menu">
                  <div className="planner-notifications-header">
                    <span className="planner-notifications-title">Notifications</span>
                    {overdueTasksCount > 0 && (
                      <span className="planner-notifications-count-badge">
                        {overdueTasksCount} alert{overdueTasksCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="planner-notifications-body">
                    {overdueTasksCount > 0 ? (
                      <div className="planner-notification-item alert">
                        <div className="planner-notification-item-icon">
                          <AlertCircle size={16} />
                        </div>
                        <div className="planner-notification-item-content">
                          <span className="planner-notification-item-title">
                            {overdueTasksCount} overdue task{overdueTasksCount > 1 ? 's' : ''}
                          </span>
                          <span className="planner-notification-item-sub">
                            Tasks on your timeline need attention.
                          </span>
                          <button
                            type="button"
                            className="planner-notification-action-link"
                            onClick={() => {
                              setIsNotificationsOpen(false);
                              onSelectTab('timeline');
                            }}
                          >
                            View timeline tasks →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="planner-notifications-empty">
                        <Bell size={22} className="planner-notifications-empty-icon" />
                        <span className="planner-notifications-empty-title">All caught up</span>
                        <span className="planner-notifications-empty-sub">
                          No pending alerts for this celebration.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PROFILE CONTROL */}
            <div className="planner-profile-container" ref={profileRef}>
              <button
                type="button"
                className={`planner-profile-avatar-btn ${isProfileOpen ? 'active' : ''}`}
                aria-haspopup="menu"
                aria-expanded={isProfileOpen}
                aria-label="Guest planner profile and storage options"
                title="Guest profile & options"
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsNotificationsOpen(false);
                }}
              >
                <User size={18} strokeWidth={2} className="planner-profile-white-icon" />
              </button>

              {/* PROFILE MENU DROPDOWN */}
              {isProfileOpen && (
                <div className="planner-profile-dropdown" role="menu">
                  <div className="planner-profile-popover-header">
                    <div className="planner-profile-popover-avatar">
                      <User size={20} />
                    </div>
                    <div className="planner-profile-popover-info">
                      <span className="planner-profile-popover-name">Guest Planner</span>
                      <span className="planner-profile-popover-role">Local browser storage</span>
                    </div>
                  </div>

                  <div className="planner-profile-storage-badge">
                    <span className="planner-storage-dot" />
                    <span>Private IndexedDB mode</span>
                  </div>

                  <div className="planner-profile-menu-list">
                    <Link
                      to="/events"
                      className="planner-profile-menu-item"
                      role="menuitem"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <Layers size={16} />
                      <span>My celebrations</span>
                    </Link>

                    <button
                      type="button"
                      className="planner-profile-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onSelectTab('settings');
                      }}
                    >
                      <Settings size={16} />
                      <span>Celebration settings</span>
                    </button>

                    <button
                      type="button"
                      className="planner-profile-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onDownloadBackup();
                      }}
                    >
                      <Download size={16} />
                      <span>Download backup (.toranly.json)</span>
                    </button>

                    <Link
                      to={`/events/${plan.id}/print`}
                      className="planner-profile-menu-item"
                      role="menuitem"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <Printer size={16} />
                      <span>Print celebration plan</span>
                    </Link>
                  </div>

                  <div className="planner-profile-popover-footer">
                    <span>Guest-first mode · No login required</span>
                    <span className="planner-profile-footer-sub">Data stays on this device</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* APPLICATION BODY: SIDEBAR + MAIN CONTENT                       */}
      {/* ------------------------------------------------------------- */}
      <div className="planner-shell-body">
        {/* MOBILE SIDEBAR BACKDROP */}
        {isMobileSidebarOpen && (
          <div
            className="planner-sidebar-backdrop"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* DEDICATED LEFT SIDEBAR (ONLY NAVIGATION SECTIONS) */}
        <aside
          className={`planner-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileSidebarOpen ? 'mobile-open' : ''}`}
          aria-label="Planner navigation"
        >
          {/* MOBILE DRAWER TOP ROW (visible only in mobile drawer mode) */}
          <div className="planner-sidebar-mobile-close-row">
            <Link
              to="/events"
              className="planner-drawer-brand-link"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <img
                src="/toranly-logo.png"
                alt="Toranly"
                className="planner-drawer-logo-img"
                height={28}
              />
            </Link>
            <button
              type="button"
              className="planner-sidebar-close-btn"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close navigation sidebar"
            >
              <X size={20} />
            </button>
          </div>

          {/* SIDEBAR NAVIGATION (9 ITEMS) */}
          <nav className="planner-sidebar-nav" aria-label="Planner sections">
            {NAV_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isTimeline = item.id === 'timeline';

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`planner-nav-item ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                  onClick={() => {
                    onSelectTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  onKeyDown={(e) => handleNavKeyDown(e, idx)}
                >
                  <span className="planner-nav-icon-box">
                    <Icon size={20} />
                  </span>
                  <span className="planner-nav-label">{item.label}</span>
                  {isTimeline && overdueTasksCount > 0 && (
                    <span
                      className="planner-overdue-badge"
                      title={`${overdueTasksCount} overdue tasks`}
                    >
                      {overdueTasksCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* SIDEBAR FOOTER: Account Settings item */}
          <div className="planner-sidebar-footer">
            <button
              type="button"
              className={`planner-nav-item planner-account-item ${isProfileOpen ? 'active' : ''}`}
              title="Account Settings"
              aria-label="Account Settings"
              aria-haspopup="menu"
              aria-expanded={isProfileOpen}
              onClick={() => {
                setIsProfileOpen((prev) => !prev);
                setIsNotificationsOpen(false);
                setIsMobileSidebarOpen(false);
              }}
            >
              <span className="planner-nav-icon-box">
                <UserRound size={20} />
              </span>
              <span className="planner-nav-label">Account Settings</span>
            </button>
          </div>
        </aside>

        {/* ------------------------------------------------------------- */}
        {/* MAIN CONTENT AREA                                             */}
        {/* ------------------------------------------------------------- */}
        <div className="planner-content-area">
          <main id="main-content" className="planner-stage">
            <div className="planner-stage-inner">{children}</div>
          </main>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MOBILE 5-ITEM BOTTOM NAV (64px)                               */}
        {/* ------------------------------------------------------------- */}
        <nav className="planner-mobile-bottom-nav" aria-label="Mobile bottom navigation">
          {/* 1. Overview */}
          <button
            type="button"
            className={`planner-mobile-nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => onSelectTab('overview')}
            aria-label="Overview"
          >
            <span className="planner-bottom-icon-wrap">
              <LayoutDashboard size={20} />
            </span>
            <span className="planner-bottom-label">Overview</span>
          </button>

          {/* 2. Budget */}
          <button
            type="button"
            className={`planner-mobile-nav-btn ${activeTab === 'budget' ? 'active' : ''}`}
            onClick={() => onSelectTab('budget')}
            aria-label="Budget"
          >
            <span className="planner-bottom-icon-wrap">
              <Wallet size={20} />
            </span>
            <span className="planner-bottom-label">Budget</span>
          </button>

          {/* 3. Tasks (Timeline) */}
          <button
            type="button"
            className={`planner-mobile-nav-btn ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => onSelectTab('timeline')}
            aria-label="Tasks"
          >
            <span className="planner-bottom-icon-wrap">
              <CheckSquare size={20} />
              {overdueTasksCount > 0 && <span className="planner-bottom-overdue-dot" />}
            </span>
            <span className="planner-bottom-label">Tasks</span>
          </button>

          {/* 4. Vendors */}
          <button
            type="button"
            className={`planner-mobile-nav-btn ${activeTab === 'vendors' ? 'active' : ''}`}
            onClick={() => onSelectTab('vendors')}
            aria-label="Vendors"
          >
            <span className="planner-bottom-icon-wrap">
              <Store size={20} />
            </span>
            <span className="planner-bottom-label">Vendors</span>
          </button>

          {/* 5. More */}
          <button
            type="button"
            className={`planner-mobile-nav-btn ${
              ['guests', 'schedule', 'ideas', 'plan', 'settings'].includes(activeTab)
                ? 'active'
                : ''
            }`}
            onClick={() => setIsMoreSheetOpen(true)}
            aria-label="More navigation options"
            aria-expanded={isMoreSheetOpen}
          >
            <span className="planner-bottom-icon-wrap">
              <MoreHorizontal size={20} />
            </span>
            <span className="planner-bottom-label">More</span>
          </button>
        </nav>

        {/* ------------------------------------------------------------- */}
        {/* MOBILE "MORE" BOTTOM SHEET                                    */}
        {/* ------------------------------------------------------------- */}
        {isMoreSheetOpen && (
          <div
            className="planner-bottom-sheet-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
          >
            <div className="planner-bottom-sheet-card" ref={moreSheetRef}>
              <div className="planner-sheet-header">
                <h3 id="sheet-title" className="planner-sheet-title">
                  More navigation
                </h3>
                <button
                  type="button"
                  className="planner-sheet-close-btn"
                  onClick={() => setIsMoreSheetOpen(false)}
                  aria-label="Close navigation sheet"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="planner-sheet-list">
                {[
                  { id: 'guests', label: 'Guests', icon: Users },
                  { id: 'schedule', label: 'Schedule', icon: Clock },
                  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
                  { id: 'plan', label: 'AI plan', icon: Sparkles },
                  { id: 'settings', label: 'Settings', icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`planner-sheet-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setIsMoreSheetOpen(false);
                        onSelectTab(item.id);
                      }}
                    >
                      <Icon size={20} />
                      <span className="planner-sheet-item-label">{item.label}</span>
                      {isActive && <Check size={16} className="planner-sheet-check" />}
                    </button>
                  );
                })}

                <div className="planner-sheet-divider" />

                <Link
                  to="/events"
                  className="planner-sheet-item link"
                  onClick={() => setIsMoreSheetOpen(false)}
                >
                  <Layers size={20} />
                  <span className="planner-sheet-item-label">My plans dashboard</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
