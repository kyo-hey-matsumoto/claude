import { Injectable, Logger } from "@nestjs/common";

export type RaffleConfirmationEmail = {
  email: string;
  displayNumber: string;
  entryUrl: string;
};

/**
 * Abstract class (not an interface) so it doubles as a NestJS DI token —
 * swap the real provider later with `{ provide: RaffleMailer, useClass: SomeRealMailer }`
 * in app.module.ts without touching RaffleService.
 */
export abstract class RaffleMailer {
  abstract sendConfirmation(input: RaffleConfirmationEmail): Promise<void>;
}

// No email provider is wired up yet (spec: docs/superpowers/specs/2026-07-21-japan-festival-raffle-design.md §5).
// Logs what a real provider would send so the flow is verifiable end-to-end locally.
@Injectable()
export class ConsoleRaffleMailer extends RaffleMailer {
  private readonly logger = new Logger(ConsoleRaffleMailer.name);

  async sendConfirmation(input: RaffleConfirmationEmail): Promise<void> {
    this.logger.log(
      [
        `To: ${input.email}`,
        "Subject: You're in! Your LIVAPON Japan Festival raffle number",
        "",
        `Your raffle number is ${input.displayNumber}.`,
        "Take a screenshot of this number to keep it handy.",
        "",
        `View or update your entry any time: ${input.entryUrl}`
      ].join("\n")
    );
  }
}
