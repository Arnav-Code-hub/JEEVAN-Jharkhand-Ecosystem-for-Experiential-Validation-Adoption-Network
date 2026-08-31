import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../shared/audit/audit.interceptor';
import { RolesGuard } from '../../shared/rbac/guards';
import { AuthenticatedUser, CurrentUser } from '../../shared/rbac/rbac.decorators';
import { MediaService } from './media.service';
import { RequestUploadDto } from './media.dto';

/**
 * Three-step upload (ADR-0005): request a presigned URL, PUT the bytes straight
 * to storage, then confirm. The API never sees the file itself.
 */
@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
@UseGuards(RolesGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Request a presigned upload URL' })
  @Audit({
    action: 'media.upload.request',
    resourceType: 'media',
    fromResult: (r) => ({ resourceId: (r as { mediaId: string }).mediaId }),
  })
  requestUpload(@Body() dto: RequestUploadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.media.requestUpload(dto, user.userId);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm the bytes landed and validate the stored object' })
  @Audit({ action: 'media.upload.confirm', resourceType: 'media', resourceIdParam: 'id' })
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.media.confirmUpload(id, user.userId);
  }

  @Get(':id/download-url')
  @ApiOperation({ summary: 'Short-lived signed read URL; objects are never public' })
  download(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.createDownloadUrl(id);
  }
}
