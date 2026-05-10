import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { MembersService } from './members.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.membersService.findAll(user.id);
  }

  @Get('search')
  search(@CurrentUser() user: any, @Query('q') q: string) {
    return this.membersService.search(user.id, q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() body: CreateMemberDto) {
    return this.membersService.create(user.id, user.plan, body);
  }

  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateMemberDto) {
    return this.membersService.update(user.id, id, body);
  }
}
