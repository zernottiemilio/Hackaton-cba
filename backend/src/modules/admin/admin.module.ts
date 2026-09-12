import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { CuentasAdminService } from './cuentas-admin.service';
import { UsuariosAdminService } from './usuarios-admin.service';
import { InvitacionesAdminService } from './invitaciones-admin.service';
import { AnalyticsAdminService } from './analytics-admin.service';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [EmailModule, AuthModule],
  controllers: [AdminController],
  providers: [CuentasAdminService, UsuariosAdminService, InvitacionesAdminService, AnalyticsAdminService],
  exports: [AnalyticsAdminService],
})
export class AdminModule {}
