const removeInvisibleChars = (value) =>
  value.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');

const normalizeSpaces = (value) => value.replace(/\s+/g, ' ').trim();

export const normalizeName = (name) => {
  const normalized = normalizeSpaces(removeInvisibleChars(name)).toLowerCase();
  // Split name into words, sort them alphabetically, and rejoin
  // This makes "John Doe" equal to "Doe John"
  // Use locale-independent sort to match server-side behaviour exactly
  return normalized
    .split(/\s+/)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(' ');
};

export const normalizeStudentId = (studentId) =>
  normalizeSpaces(removeInvisibleChars(studentId))
    .toUpperCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\.+$/g, '');

const extractId = (line) => {
  const match = line.match(/(?:GFC|GFE|UGDE)\s*\/\s*[A-Z0-9]+(?:\s*\/\s*[A-Z0-9]+){1,6}\.?/i);
  return match ? normalizeStudentId(match[0]) : '';
};

const cleanName = (raw) =>
  normalizeSpaces(
    removeInvisibleChars(raw)
      .replace(/^\d+\s*[.)-]?\s*/g, '')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+-\s*$/g, '')
      .replace(/^[-\s]+|[-\s]+$/g, '')
  );

export const parseStudentsText = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeSpaces(removeInvisibleChars(line)))
    .filter(Boolean);

  const students = [];
  let pendingName = '';

  for (const rawLine of lines) {
    const line = rawLine.replace(/\u2060/g, '').trim();

    if (!line || /^suspended$/i.test(line)) {
      pendingName = '';
      continue;
    }

    const id = extractId(line);

    if (id) {
      const beforeId = cleanName(line.slice(0, line.toUpperCase().indexOf(id.toUpperCase())));
      const name = cleanName(beforeId || pendingName);

      if (name && id) {
        students.push({
          name,
          studentId: id,
          nameNormalized: normalizeName(name),
          studentIdNormalized: normalizeStudentId(id),
        });
      }

      pendingName = '';
      continue;
    }

    pendingName = cleanName(line);
  }

  return students;
};
