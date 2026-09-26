import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { StaffRole } from '@b2b-ops/shared';
import { SignupDto } from './signup.dto';

const base = { name: 'Asha', email: 'asha@codevidhya.com', password: 'longenough1' };

describe('SignupDto', () => {
  it('rejects SUPER_ADMIN as a self-chosen role', () => {
    const errors = validateSync(plainToInstance(SignupDto, { ...base, role: StaffRole.SUPER_ADMIN }));
    expect(errors.map((e) => e.property)).toContain('role');
  });

  it.each([StaffRole.SALES, StaffRole.ACCOUNT_MANAGER, StaffRole.OPERATIONS, StaffRole.TRAINING])('accepts %s', (role) => {
    expect(validateSync(plainToInstance(SignupDto, { ...base, role }))).toHaveLength(0);
  });
});
