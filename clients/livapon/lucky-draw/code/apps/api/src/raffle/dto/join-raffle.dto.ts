import { Equals, IsBoolean, IsEmail, IsOptional, MaxLength } from "class-validator";

export class JoinRaffleDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsBoolean()
  @Equals(true, { message: "privacyConsent must be true" })
  privacyConsent!: boolean;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}
