import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'
import { buildEducationReport } from './report'

export class EducationReportQuery {
  @IsString() from!: string
  @IsString() to!: string
  @IsOptional() @IsString() groupId?: string
  @IsIn(['unset','five','ten']) scale: 'unset'|'five'|'ten' = 'unset'
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(10) pass?: number
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(10) quality?: number
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(10) excellent?: number
}
export class ExportEducationReportQuery extends EducationReportQuery {
  @IsIn(['XLSX','PDF']) format: 'XLSX'|'PDF' = 'XLSX'
}

export function validateReportPeriod(from: string, to: string) {
  for(const date of [from,to]) {
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)
      throw new BadRequestException('Укажите корректный период отчёта')
  }
  const days=(Date.parse(to)-Date.parse(from))/86400000+1
  if(days<1||days>366)throw new BadRequestException('Период отчёта должен составлять от 1 до 366 дней')
}
const dateOnly=(date: Date)=>date.toISOString().slice(0,10)
const schoolDay=(date: Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dushanbe',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)

@Injectable()
export class DirectorReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async prepareExport(user: AuthUser, query: ExportEducationReportQuery) {
    const report=await this.overview(user,query)
    await this.prisma.auditLog.create({data:{actorId:user.sub,action:'CREATE',entity:'DirectorReportExport',entityId:user.kindergartenId!,diff:{
      schoolId:user.kindergartenId!,from:query.from,to:query.to,groupId:query.groupId??null,format:query.format,
      generatedAt:report.generatedAt,version:report.version,methodology:report.methodology,
    }}})
    return report
  }

  async overview(user: AuthUser, query: EducationReportQuery) {
    if(!['ADMIN','SUPER_ADMIN'].includes(user.role)||!user.kindergartenId)throw new ForbiddenException('Отчёт доступен директору выбранной школы')
    validateReportPeriod(query.from,query.to)
    const max=query.scale==='ten'?10:5
    const thresholds={pass:query.pass??(max===10?5:3),quality:query.quality??(max===10?7:4),excellent:query.excellent??(max===10?9:5)}
    if(!(thresholds.pass>=1&&thresholds.pass<=thresholds.quality&&thresholds.quality<=thresholds.excellent&&thresholds.excellent<=max))
      throw new BadRequestException('Проверьте пороги выбранной шкалы')
    const kg=user.kindergartenId
    if(query.groupId&&!await this.prisma.group.findFirst({where:{id:query.groupId,kindergartenId:kg,isActive:true},select:{id:true}}))
      throw new ForbiddenException('Класс недоступен в выбранной школе')
    const generatedAt=new Date()
    const effectiveTo=[query.to,schoolDay(generatedAt)].sort()[0]
    const groupWhere={kindergartenId:kg,isActive:true,...(query.groupId?{id:query.groupId}:{})}
    const groups=await this.prisma.group.findMany({where:groupWhere,orderBy:[{gradeNumber:'asc'},{name:'asc'}],
      select:{id:true,name:true,gradeLabel:true,homeroomTeacher:{select:{fullName:true}},students:{where:{status:'ACTIVE'},select:{id:true,firstName:true,lastName:true}}}})
    const groupIds=groups.map(group=>group.id)
    const date={gte:new Date(query.from),lte:new Date(effectiveTo)}
    // Every query is restricted to the authenticated school; no client tenant ID is accepted.
    const [subjects,grades,attendance,schedule,teachers,homework,movements]=await Promise.all([
      this.prisma.subject.findMany({where:{kindergartenId:kg},select:{id:true,name:true}}),
      this.prisma.grade.findMany({where:{date,student:{kindergartenId:kg,groupId:{in:groupIds},status:'ACTIVE'},subject:{kindergartenId:kg}},select:{studentId:true,subjectId:true,authorId:true,value:true,date:true,type:true}}),
      this.prisma.attendance.findMany({where:{date,groupId:{in:groupIds},group:{kindergartenId:kg},student:{kindergartenId:kg,status:'ACTIVE'}},select:{studentId:true,groupId:true,date:true,status:true}}),
      this.prisma.scheduleItem.findMany({where:{groupId:{in:groupIds},group:{kindergartenId:kg}},select:{groupId:true,subjectId:true,teacherId:true,dayOfWeek:true,startTime:true,endTime:true}}),
      this.prisma.user.findMany({where:{kindergartenId:kg,role:'TEACHER'},select:{id:true,fullName:true,isActive:true}}),
      this.prisma.homework.findMany({where:{groupId:{in:groupIds},group:{kindergartenId:kg},dueDate:date},select:{groupId:true,authorId:true,dueDate:true,submissions:{select:{studentId:true,status:true}}}}),
      this.prisma.student.findMany({where:{kindergartenId:kg,...(query.groupId?{groupId:query.groupId}:{})},select:{enrolledAt:true,archivedAt:true}}),
    ])
    return buildEducationReport({from:query.from,to:query.to,effectiveTo,generatedAt:generatedAt.toISOString(),scale:query.scale,thresholds,
      groups:groups.map(group=>({id:group.id,name:group.gradeLabel?.trim()||group.name,homeroomTeacher:group.homeroomTeacher?.fullName??null,students:group.students.map(student=>({id:student.id,name:`${student.lastName} ${student.firstName}`.trim()}))})),
      subjects,grades:grades.map(row=>({...row,date:dateOnly(row.date)})),attendance:attendance.map(row=>({...row,date:dateOnly(row.date)})),schedule,
      teachers:teachers.filter(row=>!query.groupId||schedule.some(lesson=>lesson.teacherId===row.id)).map(row=>({id:row.id,name:row.fullName,active:row.isActive})),homework:homework.map(row=>({...row,dueDate:dateOnly(row.dueDate)})),
      movements:movements.map(row=>({enrolledAt:schoolDay(row.enrolledAt),archivedAt:row.archivedAt?schoolDay(row.archivedAt):null})),
    })
  }
}

@ApiTags('director-reports')
@ApiBearerAuth()
@Controller('director-reports')
@UseGuards(RolesGuard)
@Roles('ADMIN','SUPER_ADMIN')
@Feature('grades')
export class DirectorReportsController {
  constructor(private readonly service: DirectorReportsService) {}
  @Get('overview')
  overview(@CurrentUser() user: AuthUser,@Query() query: EducationReportQuery) { return this.service.overview(user,query) }
  @Post('export')
  export(@CurrentUser() user: AuthUser,@Body() query: ExportEducationReportQuery) { return this.service.prepareExport(user,query) }
}

@Module({controllers:[DirectorReportsController],providers:[DirectorReportsService]})
export class DirectorReportsModule {}
