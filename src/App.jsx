import { useState } from 'react';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TeacherManagement } from './components/admin/TeacherManagement';
import { AttendancePanel } from './components/attendance/AttendancePanel';
import { Gradebook } from './components/grading/Gradebook';
import { SubjectManager } from './components/grading/SubjectManager';
import { AdminLayout } from './components/layouts/AdminLayout';
import { RoleGate } from './components/layouts/RoleGate';
import { TeacherLayout } from './components/layouts/TeacherLayout';
import { ClassManager } from './components/roster/ClassManager';
import { ClassRollover } from './components/roster/ClassRollover';
import { ProfileGate } from './components/roster/ProfileGate';
import { RosterManager } from './components/roster/RosterManager';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { FormGenerationPanel } from './components/sf10/FormGenerationPanel';

export function App() {
  const [role, setRole] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [adminTab, setAdminTab] = useState('dashboard');
  const [teacherTab, setTeacherTab] = useState('classes');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [spreadsheetMode, setSpreadsheetMode] = useState(false);

  function switchRole() {
    setRole(null);
    setTeacher(null);
    setSelectedClass(null);
    setSelectedSubject(null);
    setAdminTab('dashboard');
    setTeacherTab('classes');
  }

  function handleSelectClass(classRecord) {
    if (selectedClass?.id !== classRecord?.id) {
      setSelectedSubject(null);
    }
    setSelectedClass(classRecord);
  }

  function handleRolloverClassCreated() {
    setTeacherTab('classes');
  }

  if (!role) {
    return <RoleGate onSelectRole={setRole} />;
  }

  if (role === 'admin') {
    return (
      <AdminLayout activeTab={adminTab} onSelectTab={setAdminTab} onSwitchRole={switchRole}>
        {adminTab === 'dashboard' ? <AdminDashboard /> : null}
        {adminTab === 'teachers' ? <TeacherManagement /> : null}
        {adminTab === 'settings' ? <SettingsPanel /> : null}
      </AdminLayout>
    );
  }

  if (!teacher) {
    return (
      <main className="flex h-screen w-screen overflow-hidden bg-background px-6 py-8 text-foreground">
        <ProfileGate onUnlock={setTeacher} />
      </main>
    );
  }

  return (
    <TeacherLayout
      teacher={teacher}
      selectedClass={selectedClass}
      selectedSubject={selectedSubject}
      activeTab={teacherTab}
      onSelectTab={setTeacherTab}
      onSwitchRole={switchRole}
    >
      {teacherTab === 'classes' ? (
        <div className="grid gap-5">
          <ClassManager teacher={teacher} selectedClass={selectedClass} onSelectClass={handleSelectClass} />
          <RosterManager selectedClass={selectedClass} />
          <SubjectManager selectedClass={selectedClass} selectedSubject={selectedSubject} onSelectSubject={setSelectedSubject} />
        </div>
      ) : null}
      {teacherTab === 'gradebook' ? (
        <Gradebook
          teacher={teacher}
          selectedClass={selectedClass}
          selectedSubject={selectedSubject}
          spreadsheetMode={spreadsheetMode}
          onToggleSpreadsheetMode={() => setSpreadsheetMode((current) => !current)}
          onSelectClass={handleSelectClass}
          onSelectSubject={setSelectedSubject}
        />
      ) : null}
      {teacherTab === 'attendance' ? <AttendancePanel selectedClass={selectedClass} /> : null}
      {teacherTab === 'forms' ? (
        <div className="grid gap-5">
          <FormGenerationPanel selectedClass={selectedClass} />
          <ClassRollover selectedClass={selectedClass} onClassCreated={handleRolloverClassCreated} />
        </div>
      ) : null}
    </TeacherLayout>
  );
}
