import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { RegionsService } from './regions.service'
import { AllowViewer } from '../../common/decorators/allow-viewer.decorator'

@ApiTags('regions')
@ApiBearerAuth()
@Controller({ path: 'regions', version: '1' })
export class RegionsController {
  constructor(private readonly service: RegionsService) {}

  /** Открыт любому вошедшему: справочник общий, личных данных в нём нет. */
  @Get()
  @AllowViewer()
  @ApiOperation({ summary: 'Области Таджикистана с районами и городами (ru/tg/en)' })
  tree() {
    return this.service.tree()
  }
}
