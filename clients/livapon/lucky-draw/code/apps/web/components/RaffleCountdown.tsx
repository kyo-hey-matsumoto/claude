"use client";

import { useEffect, useState } from "react";
import { formatCountdownDuration, millisecondsUntil } from "../lib/raffle-countdown";

export function RaffleCountdown({ target }: { target: string }) {
  const [msRemaining, setMsRemaining] = useState(() => millisecondsUntil(target));

  useEffect(() => {
    const interval = setInterval(() => setMsRemaining(millisecondsUntil(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  return <p className="raffle-countdown">{formatCountdownDuration(msRemaining)}</p>;
}
