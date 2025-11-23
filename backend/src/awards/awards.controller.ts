import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { AwardsService } from "./awards.service";

@ApiTags("awards")
@Controller()
export class AwardsController {
  constructor(private readonly awardsService: AwardsService) {}

  @Post("awardevent")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Award ENcoins for an event" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        uid: { type: "string", example: "user123" },
        eventId: { type: "string", example: "first_login" },
        Labels: { type: "string", example: "[]" },
        sessionId: { type: "string", example: "from nexus" },
        timestamp: { type: "string", example: "2025-11-10T18:47:00+01:00" },
        source: { type: "string", example: "ENPlay" },
      },
      required: ["uid", "eventId"],
    },
  })
  @ApiResponse({ status: 201, description: "Award granted successfully" })
  @ApiResponse({ status: 404, description: "Unknown action" })
  async awardEvent(
    @Body()
    body: {
      uid: string;
      eventId: string;
      Labels?: string;
      sessionId?: string;
      timestamp?: string;
      source?: string;
    }
  ) {
    return this.awardsService.awardEvent(body.uid, body.eventId);
  }

  @Post("spend")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Spend ENcoins (debit)" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        uid: { type: "string", example: "user123" },
        amount: { type: "number", example: 10 },
        label: { type: "string", example: "marketplace_item" },
      },
      required: ["uid", "amount"],
    },
  })
  @ApiResponse({ status: 201, description: "Spend successful" })
  @ApiResponse({ status: 409, description: "Insufficient balance" })
  async spend(@Body() body: { uid: string; amount: number; label?: string }) {
    return this.awardsService.spend(body.uid, body.amount, body.label);
  }

  @Get("awards")
  @ApiOperation({ summary: "Get rewardable events" })
  @ApiResponse({ status: 200, description: "Awards retrieved successfully" })
  async getAwards() {
    return this.awardsService.getAwards();
  }

  @Get("wallet/:uid")
  @ApiOperation({ summary: "Get wallet snapshot" })
  @ApiParam({ name: "uid", description: "User ID", example: "user123" })
  @ApiResponse({ status: 200, description: "Wallet retrieved successfully" })
  @ApiResponse({ status: 409, description: "UID does not exist" })
  async getWallet(@Param("uid") uid: string) {
    return this.awardsService.getUserAwards(uid);
  }

  @Get("awards/:uid")
  @ApiOperation({ summary: "Get awards snapshot" })
  @ApiParam({ name: "uid", description: "User ID", example: "user123" })
  @ApiResponse({ status: 200, description: "Awards retrieved successfully" })
  @ApiResponse({ status: 409, description: "UID does not exist" })
  async getUserAwards(@Param("uid") uid: string) {
    return this.awardsService.getUserAwards(uid);
  }
}

