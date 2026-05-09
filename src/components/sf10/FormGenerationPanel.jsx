import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';
import { SF10FormPanel } from './SF10FormPanel';
import { SF10HistoryForm } from './SF10HistoryForm';

export function FormGenerationPanel({ selectedClass }) {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [message, setMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateMessage, setTemplateMessage] = useState('');
  const [uploadingTemplate, setUploadingTemplate] = useState('');

  useEffect(() => {
    setMessage('');
    setSelectedStudentId('');
    if (!selectedClass) {
      setStudents([]);
      return;
    }

    refreshStudents();
  }, [selectedClass?.id]);

  useEffect(() => {
    refreshTemplates();
  }, []);

  async function refreshTemplates() {
    try {
      setTemplates(await api.templates.list());
    } catch (error) {
      setTemplateMessage(error.message);
    }
  }

  async function refreshStudents() {
    if (!selectedClass) {
      setStudents([]);
      return;
    }

    try {
      setStudents(await api.students.list(selectedClass.id));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function uploadTemplate(templateType) {
    setUploadingTemplate(templateType);
    setTemplateMessage('');
    try {
      const result = await api.templates.upload(templateType);
      if (result?.canceled) {
        setTemplateMessage('Template upload canceled.');
      } else {
        await refreshTemplates();
        setTemplateMessage(`${result.template.label} template saved.`);
      }
    } catch (error) {
      setTemplateMessage(error.message);
    } finally {
      setUploadingTemplate('');
    }
  }

  async function runExport(exporter) {
    setIsExporting(true);
    setMessage('');
    try {
      const result = await exporter();
      if (result?.canceled) setMessage('Export canceled.');
      else setMessage(`Saved: ${result.filePath}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsExporting(false);
    }
  }

  function exportSf10(studentId) {
    return runExport(() => api.forms.exportSf10({ classId: selectedClass.id, studentId }));
  }

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Template Manager</CardTitle>
          <CardDescription>Upload the official DepEd workbooks used for exports.</CardDescription>
        </CardHeader>
        <CardContent>
        <div className="grid gap-3 lg:grid-cols-2">
          {templates.map((template) => (
            <div className="rounded-xl border border-border p-4 shadow-inset" key={template.type}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{template.label} template</p>
                  <p className={`text-sm ${template.exists ? 'text-green-700' : 'text-red-600'}`}>
                    {template.exists ? 'Installed' : 'Missing'}
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-500">{template.exists ? template.filePath : template.fileName}</p>
                </div>
                <button
                  className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={Boolean(uploadingTemplate)}
                  type="button"
                  onClick={() => uploadTemplate(template.type)}
                >
                  {uploadingTemplate === template.type ? 'Uploading...' : 'Upload'}
                </button>
              </div>
              {template.updatedAt ? <p className="mt-2 text-xs text-slate-500">Updated {new Date(template.updatedAt).toLocaleString()}</p> : null}
            </div>
          ))}
        </div>
        {templateMessage ? <p className="mt-4 rounded border bg-slate-50 p-3 text-sm text-slate-700">{templateMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DepEd form generation</CardTitle>
          <CardDescription>Export workbook copies from the official templates while preserving formatting.</CardDescription>
        </CardHeader>
        <CardContent>
        <div className="grid gap-3 lg:grid-cols-2">
          <Button
            className="h-auto justify-start px-4 py-3 text-left"
            variant="secondary"
            disabled={!selectedClass || isExporting}
            onClick={() => runExport(() => api.forms.exportSf5(selectedClass.id))}
          >
            <span>
              <span className="block font-medium">Generate SF5</span>
              <span className="text-sm text-muted-foreground">{selectedClass ? `${selectedClass.grade_level} - ${selectedClass.section}` : 'Select a class first'}</span>
            </span>
          </Button>
        </div>

        {message ? <p className="mt-4 rounded border bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}
        </CardContent>
      </Card>

      <SF10FormPanel
        selectedClass={selectedClass}
        students={students}
        selectedStudentId={selectedStudentId}
        onSelectStudent={setSelectedStudentId}
        onExport={exportSf10}
        onSaved={refreshStudents}
      />
      <SF10HistoryForm selectedClass={selectedClass} students={students} />
    </section>
  );
}
