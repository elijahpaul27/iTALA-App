export const assessmentTypeOrder = {
  WW: 0,
  PT: 1,
  QA: 2
};

export function sortAssessments(left, right) {
  return (
    left.quarter - right.quarter ||
    (assessmentTypeOrder[left.type] ?? 99) - (assessmentTypeOrder[right.type] ?? 99) ||
    String(left.name).localeCompare(String(right.name), undefined, { numeric: true }) ||
    left.id - right.id
  );
}

export function getGradeColorClass(grade) {
  const numericGrade = Number(grade);
  if (!Number.isFinite(numericGrade)) return '';
  if (numericGrade < 75) return 'text-red-600';
  if (numericGrade >= 90) return 'text-green-600';
  return '';
}

export function learnerMatchesSearch(learner, searchQuery) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;
  return [learner.lrn, learner.last_name, learner.first_name, learner.middle_name, learner.name_extn]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query);
}
