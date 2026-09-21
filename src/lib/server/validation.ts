import { z } from "zod";
import { SYMBOLS } from "../trading/types";
export const settingsSchema = z
  .object({
    strategy: z.enum(["MOMENTUM", "MEAN_REVERSION"]),
    markets: z
      .array(z.enum(SYMBOLS))
      .min(1)
      .max(4)
      .refine((v) => new Set(v).size === v.length),
    tradeAmountCents: z.number().int().min(100).max(2500000),
    maxPositions: z.number().int().min(1).max(4),
    stopLossPct: z.number().min(0.05).max(5),
    takeProfitPct: z.number().min(0.05).max(10),
    maxHoldSeconds: z.number().int().min(20).max(3600),
    maxSessionLossPct: z.number().min(1).max(25),
  })
  .strict();
export const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("initialize") }),
  z.object({
    action: z.literal("start"),
    durationSeconds: z
      .number()
      .int()
      .min(60)
      .max(86400 * 7)
      .nullable(),
  }),
  z.object({ action: z.enum(["pause", "resume", "stop"]) }),
  z.object({
    action: z.literal("settings"),
    settings: settingsSchema,
    name: z.string().trim().min(1).max(80),
  }),
  z.object({
    action: z.literal("balance"),
    balanceCents: z.number().int().min(1000).max(10000000),
  }),
  z.object({
    action: z.literal("withdraw"),
    amountCents: z.number().int().positive().max(10000000),
    name: z.string().trim().min(2).max(80),
    method: z.enum(["Bank transfer", "PayPal", "USDT (TRC20)"]),
    details: z.string().trim().min(4).max(200),
  }),
  z.object({ action: z.literal("cancelWithdrawal"), id: z.string().uuid() }),
]);
export type Command = z.infer<typeof commandSchema>;
