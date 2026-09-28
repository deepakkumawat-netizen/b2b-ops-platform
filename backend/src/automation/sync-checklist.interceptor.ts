import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { SchoolAutomationService } from './school-automation.service';

// Put on any controller whose writes can complete a checklist task. After a
// successful POST/PATCH/PUT/DELETE it syncs that school's checklist before
// responding, so the UI's next reload already shows the agent's ticks.
// Reads the school from the :schoolId route param (sub-resource routes) or
// :id (PATCH /schools/:id). GETs pass straight through.
@Injectable()
export class SyncChecklistInterceptor implements NestInterceptor {
  constructor(private automation: SchoolAutomationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; params: Record<string, string> }>();
    const schoolId = req.params.schoolId ?? req.params.id;
    if (req.method === 'GET' || !schoolId) return next.handle();
    return next.handle().pipe(
      mergeMap(async (body) => {
        await this.automation.sync(schoolId);
        return body;
      }),
    );
  }
}
