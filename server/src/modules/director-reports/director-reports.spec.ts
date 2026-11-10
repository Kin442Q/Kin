import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { DirectorReportsService, EducationReportQuery, validateReportPeriod } from './director-reports.module'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'

describe('director report access and period boundaries',()=>{
  const user={sub:'director',email:'qa@example.com',role:'ADMIN',kindergartenId:'school-a'} as AuthUser
  const query=()=>Object.assign(new EducationReportQuery(),{from:'2026-11-01',to:'2026-11-10'})
  const prisma=()=>Object.fromEntries(['group','subject','grade','attendance','scheduleItem','user','homework','student'].map(name=>[name,{findMany:jest.fn().mockResolvedValue([]),findFirst:jest.fn().mockResolvedValue(null)}]))
  it('rejects malformed, impossible, reversed and oversized date periods',()=>{
    for(const [from,to] of [['2026-02-30','2026-03-01'],['2026-11-10','2026-11-01'],['2024-01-01','2026-01-01'],['bad','2026-11-01']])expect(()=>validateReportPeriod(from,to)).toThrow(BadRequestException)
    expect(()=>validateReportPeriod('2024-01-01','2024-12-31')).not.toThrow()
  })
  it('requires a director role and a tenant before reading records',async()=>{
    const db=prisma(),service=new DirectorReportsService(db as unknown as PrismaService)
    await expect(service.overview({...user,role:'TEACHER'},query())).rejects.toThrow(ForbiddenException)
    await expect(service.overview({...user,kindergartenId:null},query())).rejects.toThrow(ForbiddenException)
    expect(db.group.findMany).not.toHaveBeenCalled()
  })
  it('rejects a class outside the authenticated school',async()=>{
    const db=prisma(),service=new DirectorReportsService(db as unknown as PrismaService)
    await expect(service.overview(user,{...query(),groupId:'foreign'})).rejects.toThrow(ForbiddenException)
    expect(db.grade.findMany).not.toHaveBeenCalled()
  })
  it('applies school boundaries to every relation that can carry pupil data',async()=>{
    const db=prisma(),service=new DirectorReportsService(db as unknown as PrismaService)
    await service.overview(user,query())
    expect(db.group.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({kindergartenId:'school-a'})}))
    expect(db.grade.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({student:expect.objectContaining({kindergartenId:'school-a'}),subject:{kindergartenId:'school-a'}})}))
    expect(db.attendance.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({group:{kindergartenId:'school-a'},student:expect.objectContaining({kindergartenId:'school-a'})})}))
  })
  it('records export format, actor and methodology without putting pupil names in the audit event',async()=>{
    const db={...prisma(),auditLog:{create:jest.fn().mockResolvedValue({})}}
    const service=new DirectorReportsService(db as unknown as PrismaService)
    await service.prepareExport(user,{...query(),format:'XLSX'})
    expect(db.auditLog.create).toHaveBeenCalledWith({data:expect.objectContaining({actorId:'director',entity:'DirectorReportExport',entityId:'school-a',diff:expect.objectContaining({schoolId:'school-a',format:'XLSX',version:1})})})
    expect(JSON.stringify(db.auditLog.create.mock.calls[0])).not.toContain('students')
  })
})
