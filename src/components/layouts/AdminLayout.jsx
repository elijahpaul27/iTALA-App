import { BarChart3, Settings, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { ShellLayout } from './ShellLayout';

const adminNavigation = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'teachers', label: 'Teachers', icon: UsersRound },
  { id: 'settings', label: 'Settings', icon: Settings }
];

export function AdminLayout({ activeTab, onSelectTab, onSwitchRole, children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <ShellLayout
      roleLabel="Admin"
      identity={{ initials: 'AD', name: 'School Admin' }}
      subtitle="iTALA administration"
      activeTab={activeTab}
      navigation={adminNavigation}
      onSelectTab={onSelectTab}
      onSwitchRole={onSwitchRole}
      isCollapsed={isCollapsed}
      onToggleCollapse={() => setIsCollapsed((current) => !current)}
      topbarMeta={{
        schoolYear: 'S.Y. 2025-2026',
        title: 'Admin Console',
        detail: 'Teachers and settings'
      }}
    >
      {children}
    </ShellLayout>
  );
}
