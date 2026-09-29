import { Module } from '@nestjs/common';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { TeacherFormController } from './teacher-form.controller';

@Module({
  imports: [OnboardingModule],
  controllers: [TeacherFormController],
})
export class TeacherFormModule {}
