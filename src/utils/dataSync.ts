import { ClassRoom, Student, Teacher } from '../types';

export function normalizeClassName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^kelas\s+/i, '')
    .replace(/^kls\s+/i, '')
    .replace(/\b10\b/g, 'x')
    .replace(/\b11\b/g, 'xi')
    .replace(/\b12\b/g, 'xii')
    .replace(/[^a-z0-9]/g, '');
}

export function findMatchingClass(
  className?: string,
  classId?: string,
  classes: ClassRoom[] = []
): ClassRoom | undefined {
  if (!classes || classes.length === 0) return undefined;

  // 1. Match by classId
  if (classId) {
    const foundById = classes.find(c => c.id === classId);
    if (foundById) return foundById;
  }

  if (!className || !className.trim()) return undefined;

  const raw = className.trim();
  const rawLower = raw.toLowerCase();
  const norm = normalizeClassName(raw);

  // 2. Exact match (case-insensitive & trimmed)
  const exact = classes.find(c => c.name.trim().toLowerCase() === rawLower);
  if (exact) return exact;

  // 3. Normalized match (ignoring 'Kelas' prefix, spaces, 10 vs X, etc.)
  if (norm) {
    const normMatch = classes.find(c => normalizeClassName(c.name) === norm);
    if (normMatch) return normMatch;
  }

  // 4. Substring match
  if (norm.length >= 3) {
    const containsMatch = classes.find(c => {
      const cNorm = normalizeClassName(c.name);
      return (cNorm && (cNorm.includes(norm) || norm.includes(cNorm)));
    });
    if (containsMatch) return containsMatch;
  }

  return undefined;
}

export function inferGradeLevel(className: string): 'X' | 'XI' | 'XII' {
  const norm = normalizeClassName(className);
  if (norm.startsWith('xii') || norm.includes('12')) return 'XII';
  if (norm.startsWith('xi') || norm.includes('11')) return 'XI';
  return 'X';
}

/**
 * Automatically connects & synchronizes student data with class data bidirectionally.
 * - Ensures every student's classId and className are matched to a valid ClassRoom.
 * - Auto-creates class if a student has a specific className that does not exist yet.
 * - Recalculates studentCount for each class based on actual connected students.
 * - Syncs teachers' assignedClassId and assignedClassName.
 */
export function syncClassesAndStudentsData(
  classes: ClassRoom[],
  students: Student[],
  teachers: Teacher[] = []
): { classes: ClassRoom[]; students: Student[]; teachers: Teacher[] } {
  let currentClasses = classes ? [...classes] : [];
  if (!students || students.length === 0) {
    return { classes: currentClasses, students: [], teachers: teachers || [] };
  }

  const teacherById = new Map<string, Teacher>();
  (teachers || []).forEach(t => {
    if (t.id) teacherById.set(t.id, t);
  });

  // 1. Sync Students with Classes
  const syncedStudents: Student[] = students.map(student => {
    let matchedClass = findMatchingClass(student.className, student.classId, currentClasses);

    // If student has a specific non-empty className that does not exist in currentClasses, auto-create it!
    if (!matchedClass && student.className && student.className.trim()) {
      const cleanClassName = student.className.trim();
      const gradeLevel = inferGradeLevel(cleanClassName);
      const newClass: ClassRoom = {
        id: `cls-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: cleanClassName,
        gradeLevel: gradeLevel,
        studentCount: 0
      };
      currentClasses.push(newClass);
      matchedClass = newClass;
    }

    // Fallback: assign to the first available class if unassigned and no className specified
    if (!matchedClass && currentClasses.length > 0) {
      matchedClass = currentClasses[0];
    }

    if (matchedClass) {
      return {
        ...student,
        classId: matchedClass.id,
        className: matchedClass.name
      };
    }

    return student;
  });

  // 2. Sync Classes with Student Count & Teacher Info
  const syncedClasses: ClassRoom[] = currentClasses.map(cls => {
    // Count exact students belonging to this class
    const connectedCount = syncedStudents.filter(
      s => s.classId === cls.id || (cls.name && s.className && s.className.trim().toLowerCase() === cls.name.trim().toLowerCase())
    ).length;

    let updatedTeacherName = cls.teacherName;
    let updatedTeacherId = cls.teacherId;

    if (cls.teacherId && teacherById.has(cls.teacherId)) {
      updatedTeacherName = teacherById.get(cls.teacherId)!.name;
    } else if (!cls.teacherId && cls.teacherName) {
      const foundTeacher = teachers.find(
        t => t.name.trim().toLowerCase() === cls.teacherName?.trim().toLowerCase()
      );
      if (foundTeacher) {
        updatedTeacherId = foundTeacher.id;
        updatedTeacherName = foundTeacher.name;
      }
    }

    return {
      ...cls,
      studentCount: connectedCount,
      teacherId: updatedTeacherId,
      teacherName: updatedTeacherName
    };
  });

  // Re-build class map after class update
  const updatedClassById = new Map<string, ClassRoom>();
  syncedClasses.forEach(c => updatedClassById.set(c.id, c));

  // 3. Sync Teachers with Assigned Class Info
  const syncedTeachers: Teacher[] = (teachers || []).map(teacher => {
    let assignedClass = findMatchingClass(teacher.assignedClassName, teacher.assignedClassId, syncedClasses);

    if (assignedClass) {
      return {
        ...teacher,
        assignedClassId: assignedClass.id,
        assignedClassName: assignedClass.name
      };
    }

    return teacher;
  });

  // 4. Ensure strictly unique IDs across all students to fix React duplicate key errors
  const seenStudentIds = new Set<string>();
  const uniqueStudents = syncedStudents.map((st, i) => {
    if (!st.id || seenStudentIds.has(st.id)) {
      const freshId = `std-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;
      seenStudentIds.add(freshId);
      return { ...st, id: freshId };
    }
    seenStudentIds.add(st.id);
    return st;
  });

  return {
    classes: syncedClasses,
    students: uniqueStudents,
    teachers: syncedTeachers
  };
}

