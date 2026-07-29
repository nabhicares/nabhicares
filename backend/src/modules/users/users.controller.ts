import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UserBootstrapDto } from './dto/user-bootstrap.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post('register')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register profile document' })
  register(@CurrentUser() user: any, @Body() dto: CreateUserProfileDto) {
    return this.usersService.createUserProfile(user.uid, dto);
  }

  @Post('assign-role')
  @Roles('super_admin', 'hospital_admin')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign user custom claims role (Admin/Super-Admin only)' })
  assignRole(@CurrentUser() user: any, @Body() dto: AssignRoleDto) {
    return this.usersService.assignRole(dto, user);
  }

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile data' })
  me(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.uid);
  }

  @Delete('me')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete / anonymize the current user account and linked personal data' })
  deleteMe(@CurrentUser() user: any) {
    return this.usersService.deleteMyAccount(user.uid);
  }

  @Post('logout')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke Firebase refresh tokens for the current user' })
  logout(@CurrentUser() user: any) {
    return this.usersService.logout(user.uid);
  }

  @Post('bootstrap')
  @ApiOperation({ summary: 'Bootstrap a new staff user credentials and roles' })
  bootstrap(
    @Body() dto: UserBootstrapDto,
    @Headers('x-bootstrap-secret') secretHeader?: string,
  ) {
    return this.usersService.bootstrapUser(dto, secretHeader);
  }
}
