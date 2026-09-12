import { SetMetadata } from '@nestjs/common';

export const IS_SUPERADMIN_KEY = 'isSuperAdmin';
export const SuperAdmin = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_SUPERADMIN_KEY, true);
