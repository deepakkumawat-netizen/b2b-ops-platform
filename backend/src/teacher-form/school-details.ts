// The parts of a school's details page (the public link the school gets by
// email). Shared by the page's own status, the reminder email that lists
// what's still empty, and the reminder agent that decides who gets one.
export interface SchoolDetailsCounts {
  teachers: number;
  students: number;
  hasLogo: boolean;
  hasInfra: boolean;
  hasOrientationDate: boolean;
}

export const SCHOOL_DETAILS_PARTS: Array<{ key: keyof SchoolDetailsCounts; label: string; done: (c: SchoolDetailsCounts) => boolean }> = [
  { key: 'teachers', label: 'Teacher details', done: (c) => c.teachers > 0 },
  { key: 'students', label: 'Student details (name and grade)', done: (c) => c.students > 0 },
  { key: 'hasLogo', label: 'School logo', done: (c) => c.hasLogo },
  { key: 'hasInfra', label: 'Computer lab and internet', done: (c) => c.hasInfra },
  { key: 'hasOrientationDate', label: 'Preferred orientation date', done: (c) => c.hasOrientationDate },
];

export function missingSchoolDetails(c: SchoolDetailsCounts): string[] {
  return SCHOOL_DETAILS_PARTS.filter((p) => !p.done(c)).map((p) => p.label);
}

/** One query's worth of `_count`/relation selects that feed SchoolDetailsCounts. */
export const SCHOOL_DETAILS_SELECT = {
  orientationPreferredDate: true,
  infraDiagnostic: { select: { id: true } },
  assets: { where: { kind: 'LOGO' }, select: { id: true } },
  _count: { select: { teachers: true, students: true } },
} as const;

export function schoolDetailsCounts(s: {
  orientationPreferredDate: Date | null;
  infraDiagnostic: { id: string } | null;
  assets: { id: string }[];
  _count: { teachers: number; students: number };
}): SchoolDetailsCounts {
  return {
    teachers: s._count.teachers,
    students: s._count.students,
    hasLogo: s.assets.length > 0,
    hasInfra: !!s.infraDiagnostic,
    hasOrientationDate: !!s.orientationPreferredDate,
  };
}
