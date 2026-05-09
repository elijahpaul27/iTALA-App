import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import debounce from 'lodash.debounce';
import { api } from '../../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';
import { getGradeColorClass, learnerMatchesSearch, sortAssessments } from './gradebookUtils';

const navigationKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab']);
const rowHeight = 52;

export function RawScoreGrid({
  quarter,
  searchQuery,
  selectedClass,
  selectedSubject,
  refreshTrigger,
  onDataChanged
}) {
  const [assessments, setAssessments] = useState([]);
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState({});
  const [summary, setSummary] = useState([]);
  const [scoreErrors, setScoreErrors] = useState({});
  const [saveState, setSaveState] = useState('saved');
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [message, setMessage] = useState('');
  const scrollRef = useRef(null);
  const pendingUpdatesRef = useRef(new Map());
  const queryClient = useQueryClient();
  const queryKey = ['grades', selectedClass?.id, selectedSubject?.id, quarter];

  const gridQuery = useQuery({
    queryKey,
    enabled: Boolean(selectedClass?.id && selectedSubject?.id),
    queryFn: async () => {
      const [assessmentRows, studentRows, gradeRows, summaryRows] = await Promise.all([
        api.assessments.list(selectedSubject.id, quarter),
        api.students.list(selectedClass.id),
        api.grades.list({ classId: selectedClass.id, subjectId: selectedSubject.id, quarter }),
        api.grades.summary({ classId: selectedClass.id, subjectId: selectedSubject.id, quarter })
      ]);
      return { assessmentRows, studentRows, gradeRows, summaryRows };
    }
  });

  const batchMutation = useMutation({
    mutationFn: (updates) =>
      api.grades.mutateBatch({
        classId: selectedClass.id,
        quarter,
        updates
      }),
    onSuccess: async (result) => {
      if (!result.ok) return;
      await queryClient.invalidateQueries({ queryKey });
    }
  });

  const visibleStudents = useMemo(
    () => students.filter((student) => learnerMatchesSearch(student, searchQuery)),
    [students, searchQuery]
  );

  const rowVirtualizer = useVirtualizer({
    count: visibleStudents.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8
  });

  const summaryByStudent = useMemo(() => {
    const rows = new Map();
    for (const row of summary) rows.set(row.student_id, row);
    return rows;
  }, [summary]);

  const simulatedGradesByStudent = useMemo(() => {
    if (!whatIfMode) return new Map();
    const weights = {
      WW: Number(selectedSubject?.written_work_weight ?? 0),
      PT: Number(selectedSubject?.perf_task_weight ?? 0),
      QA: Number(selectedSubject?.quarterly_weight ?? 0)
    };
    const byStudent = new Map();
    for (const student of visibleStudents) {
      const totals = {
        WW: { raw: 0, max: 0 },
        PT: { raw: 0, max: 0 },
        QA: { raw: 0, max: 0 }
      };
      for (const assessment of assessments) {
        const type = assessment.type;
        totals[type].raw += Number(scores[`${student.id}:${assessment.id}`] || 0);
        totals[type].max += Number(assessment.max_score || 0);
      }
      const initial = Object.entries(totals).reduce((sum, [type, total]) => (
        sum + (total.max > 0 ? (total.raw / total.max) * 100 * weights[type] : 0)
      ), 0);
      const transmuted = initial >= 60
        ? Math.min(100, ((initial - 60) / 1.6) + 75)
        : Math.max(60, (initial / 4) + 60);
      byStudent.set(student.id, {
        initial: Number(initial.toFixed(2)),
        transmuted: Number(transmuted.toFixed(2))
      });
    }
    return byStudent;
  }, [assessments, scores, selectedSubject, visibleStudents, whatIfMode]);

  useEffect(() => {
    if (gridQuery.data) {
      applyGridData(gridQuery.data);
    }
  }, [gridQuery.data]);

  useEffect(() => {
    gridQuery.refetch();
    setScoreErrors({});
    setSaveState('saved');
  }, [selectedClass?.id, selectedSubject?.id, quarter, refreshTrigger]);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [visibleStudents.length, assessments.length]);

  function applyGridData({ assessmentRows, studentRows, gradeRows, summaryRows }) {
    setAssessments(assessmentRows.sort(sortAssessments));
    setStudents(studentRows);
    setScores(Object.fromEntries(gradeRows.map((grade) => [`${grade.student_id}:${grade.assessment_id}`, String(grade.raw_score)])));
    setSummary(summaryRows);
  }

  async function refreshGrid() {
    setMessage('');
    try {
      const { data } = await gridQuery.refetch();
      if (data) applyGridData(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  const flushPendingScores = useCallback(async () => {
    const updates = Array.from(pendingUpdatesRef.current.values());
    if (updates.length === 0) {
      setSaveState('saved');
      return;
    }

    setSaveState('saving');
    try {
      const result = await batchMutation.mutateAsync(updates);
      if (!result.ok) {
        const failedErrors = {};
        for (const failure of result.failed ?? []) {
          if (failure.studentId && failure.assessmentId) {
            failedErrors[`${failure.studentId}:${failure.assessmentId}`] = failure.reason;
          }
        }
        setScoreErrors((current) => ({ ...current, ...failedErrors }));
        setSaveState('error');
        return;
      }

      pendingUpdatesRef.current.clear();
      setScoreErrors({});
      await refreshGrid();
      onDataChanged?.();
      setSaveState('saved');
    } catch (error) {
      setMessage(error.message);
      setSaveState('error');
    }
  }, [selectedClass?.id, selectedSubject?.id, quarter]);

  const debouncedFlushScores = useMemo(
    () => debounce(() => flushPendingScores(), 2000),
    [flushPendingScores]
  );

  useEffect(() => () => {
    debouncedFlushScores.cancel();
  }, [debouncedFlushScores]);

  const updateScore = useCallback((studentId, assessment, value) => {
    const key = `${studentId}:${assessment.id}`;
    const maximum = Number(assessment.max_score);
    const numericValue = Number(value);
    const nextValue = value !== '' && Number.isFinite(numericValue) && numericValue > maximum ? String(maximum) : value;

    setScores((current) => ({ ...current, [key]: nextValue }));
    setScoreErrors((current) => {
      const next = { ...current };
      if (nextValue === value) delete next[key];
      else next[key] = `0-${maximum}`;
      return next;
    });
    setSaveState(whatIfMode ? 'simulating' : 'saving');
    if (whatIfMode) return;
    if (nextValue !== '') {
      pendingUpdatesRef.current.set(key, {
        studentId,
        assessmentId: assessment.id,
        value: Number(nextValue)
      });
      debouncedFlushScores();
    }
  }, [debouncedFlushScores, whatIfMode]);

  const handleScoreKeyDown = useCallback((event) => {
    if (!navigationKeys.has(event.key)) return;

    const rowIndex = Number(event.currentTarget.dataset.rowIndex);
    const columnIndex = Number(event.currentTarget.dataset.columnIndex);
    let nextRowIndex = rowIndex;
    let nextColumnIndex = columnIndex;

    switch (event.key) {
      case 'ArrowUp':
        nextRowIndex -= 1;
        break;
      case 'ArrowDown':
      case 'Enter':
        nextRowIndex += event.shiftKey ? -1 : 1;
        break;
      case 'ArrowLeft':
        nextColumnIndex -= 1;
        break;
      case 'ArrowRight':
      case 'Tab':
        nextColumnIndex += event.shiftKey ? -1 : 1;
        break;
      default:
        return;
    }

    if (nextColumnIndex < 0) {
      nextColumnIndex = assessments.length - 1;
      nextRowIndex -= 1;
    } else if (nextColumnIndex >= assessments.length) {
      nextColumnIndex = 0;
      nextRowIndex += 1;
    }

    if (nextRowIndex < 0 || nextRowIndex >= visibleStudents.length || nextColumnIndex < 0 || nextColumnIndex >= assessments.length) return;

    event.preventDefault();
    rowVirtualizer.scrollToIndex(nextRowIndex, { align: 'auto' });
    window.setTimeout(() => {
      const selector = `[data-score-cell="true"][data-row-index="${nextRowIndex}"][data-column-index="${nextColumnIndex}"]`;
      const nextInput = scrollRef.current?.querySelector(selector);
      nextInput?.focus();
      nextInput?.select();
    }, 0);
  }, [assessments.length, rowVirtualizer, visibleStudents.length]);

  const gridTemplateColumns = `minmax(180px, 1.5fr) repeat(${Math.max(assessments.length, 1)}, minmax(64px, 82px)) minmax(82px, 0.7fr)`;

  return (
    <Card className="w-full min-w-0 overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Q{quarter} raw score grid</CardTitle>
            <CardDescription>{whatIfMode ? 'What-if mode is local only. Changes here will not be saved.' : 'Columns are limited to this quarter and sorted WW, PT, then QA.'}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide shadow-inset">
              <input checked={whatIfMode} type="checkbox" onChange={(event) => {
                setWhatIfMode(event.target.checked);
                pendingUpdatesRef.current.clear();
                setSaveState(event.target.checked ? 'simulating' : 'saved');
                refreshGrid();
              }} />
              What-if
            </label>
            <SaveIndicator state={saveState} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="w-full overflow-hidden rounded-2xl border border-border shadow-inset">
          <div ref={scrollRef} className="max-h-[62vh] w-full overflow-auto">
            <div className="min-w-[640px]">
              <div
                className="sticky top-0 z-30 grid bg-muted text-xs text-muted-foreground shadow-[0_1px_0_0_rgba(0,0,0,0.08)]"
                style={{ gridTemplateColumns }}
              >
                <div className="sticky left-0 z-40 bg-muted px-3 py-2 font-semibold uppercase tracking-wide">Learner</div>
                {assessments.map((assessment) => (
                  <div className="px-2 py-2 text-center" key={assessment.id} title={`${assessment.name} / ${assessment.max_score}`}>
                    <span className="block truncate font-semibold">{assessment.name}</span>
                    <span>{assessment.type} / {assessment.max_score}</span>
                  </div>
                ))}
                <div className="px-2 py-2 text-center font-semibold uppercase tracking-wide">Grade</div>
              </div>

              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const student = visibleStudents[virtualRow.index];
                  const summaryRow = summaryByStudent.get(student.id);
                  return (
                    <MemoizedScoreRow
                      assessments={assessments}
                      errors={scoreErrors}
                      key={student.id}
                      onKeyDown={handleScoreKeyDown}
                      onScoreChange={updateScore}
                      scores={scores}
                      student={student}
                      summaryRow={summaryRow}
                      simulatedGrade={simulatedGradesByStudent.get(student.id)}
                      virtualIndex={virtualRow.index}
                      virtualRow={virtualRow}
                      gridTemplateColumns={gridTemplateColumns}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {message ? <p className="mt-3 rounded-xl border border-border bg-background p-3 text-sm text-destructive shadow-inset">{message}</p> : null}
        {assessments.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No Q{quarter} assessments yet. Add columns in Setup Assessments.</p> : null}
        {visibleStudents.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No learners match the current search.</p> : null}
      </CardContent>
    </Card>
  );
}

const MemoizedScoreRow = memo(function ScoreRow({
  assessments,
  errors,
  gridTemplateColumns,
  onKeyDown,
  onScoreChange,
  scores,
  student,
  summaryRow,
  simulatedGrade,
  virtualIndex,
  virtualRow
}) {
  return (
    <div
      className="absolute left-0 grid w-full border-t border-border bg-card text-sm"
      style={{
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
        gridTemplateColumns
      }}
    >
      <div className="sticky left-0 z-20 flex min-w-0 items-center bg-card px-3 font-medium shadow-[1px_0_0_0_rgba(0,0,0,0.08)]">
        <span className="truncate">{student.last_name}, {student.first_name}</span>
      </div>
      {assessments.map((assessment, columnIndex) => {
        const key = `${student.id}:${assessment.id}`;
        return (
          <MemoizedScoreCell
            assessment={assessment}
            columnIndex={columnIndex}
            error={errors[key]}
            key={assessment.id}
            rowIndex={virtualIndex}
            studentId={student.id}
            value={scores[key] ?? ''}
            onChange={onScoreChange}
            onKeyDown={onKeyDown}
          />
        );
      })}
      <div className={`flex flex-col items-center justify-center px-2 font-semibold ${getGradeColorClass(simulatedGrade?.transmuted ?? summaryRow?.transmuted_grade)}`}>
        <span>{simulatedGrade?.transmuted ?? summaryRow?.transmuted_grade ?? ''}</span>
        {simulatedGrade ? <span className="text-[10px] font-medium text-slate-500">sim</span> : null}
      </div>
    </div>
  );
}, areScoreRowsEqual);

function areScoreRowsEqual(previous, next) {
  if (
    previous.assessments !== next.assessments ||
    previous.student !== next.student ||
    previous.summaryRow !== next.summaryRow ||
    previous.simulatedGrade !== next.simulatedGrade ||
    previous.virtualIndex !== next.virtualIndex ||
    previous.virtualRow.start !== next.virtualRow.start ||
    previous.virtualRow.size !== next.virtualRow.size ||
    previous.gridTemplateColumns !== next.gridTemplateColumns
  ) {
    return false;
  }

  for (const assessment of next.assessments) {
    const key = `${next.student.id}:${assessment.id}`;
    if (previous.scores[key] !== next.scores[key]) return false;
    if (previous.errors[key] !== next.errors[key]) return false;
  }
  return true;
}

const MemoizedScoreCell = memo(function ScoreCell({
  assessment,
  columnIndex,
  error,
  rowIndex,
  studentId,
  value,
  onChange,
  onKeyDown
}) {
  return (
    <div className="flex items-center justify-center px-1">
      <input
        aria-invalid={Boolean(error)}
        className={`h-8 w-12 rounded-md border border-border bg-input-background px-1 text-center text-sm shadow-inset outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 ${error ? 'border-red-500 text-red-600' : ''}`}
        data-column-index={columnIndex}
        data-row-index={rowIndex}
        data-score-cell="true"
        max={assessment.max_score}
        min="0"
        step="0.01"
        title={error ? `Score must be ${error}` : `${assessment.name} score`}
        type="number"
        value={value}
        onKeyDown={onKeyDown}
        onChange={(event) => onChange(studentId, assessment, event.target.value)}
      />
    </div>
  );
});

function SaveIndicator({ state }) {
  const label = state === 'simulating' ? 'What-if only' : state === 'saving' ? 'Saving...' : state === 'error' ? 'Save failed' : 'All changes saved';
  const className = state === 'simulating' ? 'text-blue-700' : state === 'saving' ? 'text-amber-700' : state === 'error' ? 'text-red-700' : 'text-green-700';
  return (
    <span className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide shadow-inset ${className}`}>
      {label}
    </span>
  );
}
