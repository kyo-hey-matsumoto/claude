import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { formatRaffleSerialNumber, getRaffleCampaign } from "@livapon/domain";
import { RaffleService } from "./raffle.service.js";
import { JoinRaffleDto } from "./dto/join-raffle.dto.js";
import { UpdateRaffleProfileDto } from "./dto/update-raffle-profile.dto.js";

type RaffleEntryRecord = {
  campaignCode: string;
  serialNumber: number;
  accessToken: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  marketingOptIn: boolean;
};

// No @UseGuards: raffle participants are anonymous festival guests, not
// LIVAPON accounts (spec §5).
@Controller("raffle")
export class RaffleController {
  constructor(private readonly raffle: RaffleService) {}

  @Post(":campaignCode/entries")
  async join(@Param("campaignCode") campaignCode: string, @Body() body: JoinRaffleDto) {
    const entry = await this.raffle.join(campaignCode, body);
    return this.toResponse(entry);
  }

  @Get(":campaignCode/entries/:token")
  async getEntry(@Param("campaignCode") campaignCode: string, @Param("token") token: string) {
    const entry = await this.raffle.getByToken(campaignCode, token);
    return this.toResponse(entry);
  }

  @Patch(":campaignCode/entries/:token")
  async updateEntry(
    @Param("campaignCode") campaignCode: string,
    @Param("token") token: string,
    @Body() body: UpdateRaffleProfileDto
  ) {
    const entry = await this.raffle.updateProfile(campaignCode, token, body);
    return this.toResponse(entry);
  }

  private toResponse(entry: RaffleEntryRecord) {
    const campaign = getRaffleCampaign(entry.campaignCode);
    return {
      campaignCode: entry.campaignCode,
      serialNumber: entry.serialNumber,
      displayNumber: formatRaffleSerialNumber(entry.campaignCode, entry.serialNumber, campaign?.serialDigits ?? 6),
      accessToken: entry.accessToken,
      email: entry.email,
      phone: entry.phone,
      firstName: entry.firstName,
      lastName: entry.lastName,
      gender: entry.gender,
      dateOfBirth: entry.dateOfBirth ? entry.dateOfBirth.toISOString().slice(0, 10) : null,
      addressLine1: entry.addressLine1,
      addressLine2: entry.addressLine2,
      city: entry.city,
      region: entry.region,
      postalCode: entry.postalCode,
      country: entry.country,
      marketingOptIn: entry.marketingOptIn
    };
  }
}
