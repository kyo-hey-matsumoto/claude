import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateRaffleProfileDto {
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) firstName?: string;
  @IsOptional() @IsString() @MaxLength(200) lastName?: string;
  @IsOptional() @IsString() @MaxLength(50) gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
}
