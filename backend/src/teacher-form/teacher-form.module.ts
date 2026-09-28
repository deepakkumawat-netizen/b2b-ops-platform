import { Module } from '@nestjs/common';
import { TeacherFormController } from './teacher-form.controller';

@Module({
  controllers: [TeacherFormController],
})
export class TeacherFormModule {}
