import { BookOpenCheck, CalendarDays, ClipboardList, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { ShellLayout } from './ShellLayout';

const teacherNavigation = [
  { id: 'classes', label: 'Classes', icon: ClipboardList },
  { id: 'gradebook', label: 'Gradebook', icon: BookOpenCheck },
  { id: 'attendance', label: 'Attendance', icon: CalendarDays },
  { id: 'forms', label: 'Forms', icon: FileSpreadsheet }
];

function initialsFromName(name) {
  return String(name ?? 'Teacher')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TR';
}

export function TeacherLayout({ teacher, selectedClass, selectedSubject, activeTab, onSelectTab, onSwitchRole, children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <ShellLayout
      roleLabel="Teacher"
      identity={{ initials: initialsFromName(teacher?.name), name: teacher?.name ?? 'Teacher' }}
      subtitle={teacher?.school_name ?? 'Local teacher profile'}
      activeTab={activeTab}
      navigation={teacherNavigation}
      onSelectTab={onSelectTab}
      onSwitchRole={onSwitchRole}
      isCollapsed={isCollapsed}
      onToggleCollapse={() => setIsCollapsed((current) => !current)}
      topbarMeta={{
        schoolYear: selectedClass?.school_year ?? 'S.Y. 2025-2026',
        title: selectedClass ? `${selectedClass.grade_level} - ${selectedClass.section}` : 'No class selected',
        detail: selectedSubject?.name ?? teacher?.school_id ?? 'Select a class'
      }}
    >
      {children}
    </ShellLayout>
  );
}
