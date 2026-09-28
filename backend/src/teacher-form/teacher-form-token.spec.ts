import { isValidTeacherFormToken, teacherFormToken, teacherFormUrl } from './teacher-form-token';

describe('teacher form token', () => {
  it('accepts the token for its own school', () => {
    expect(isValidTeacherFormToken('school-a', teacherFormToken('school-a', 's3cret'), 's3cret')).toBe(true);
  });

  it("rejects another school's token, a tampered token, and a different secret", () => {
    const token = teacherFormToken('school-a', 's3cret');
    expect(isValidTeacherFormToken('school-b', token, 's3cret')).toBe(false);
    expect(isValidTeacherFormToken('school-a', token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'), 's3cret')).toBe(false);
    expect(isValidTeacherFormToken('school-a', 'short', 's3cret')).toBe(false);
    expect(isValidTeacherFormToken('school-a', token, 'other-secret')).toBe(false);
  });

  it('builds the link without doubling slashes', () => {
    expect(teacherFormUrl('https://app.example.com/', 'sch1', 'k')).toBe(`https://app.example.com/teacher-form/sch1/${teacherFormToken('sch1', 'k')}`);
  });
});
