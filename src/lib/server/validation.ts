import { z } from "zod";
import { SYMBOLS } from "../trading/types";
// Bounds live with the Firestore read boundary so the values the server
// accepts and the values it considers readable can never drift apart.
import { SETTINGS_BOUNDS } from "../trading/documents";

export const settingsSchema = z
  .object({
    strategy: z.enum(["MOMENTUM", "MEAN_REVERSION"]),
    markets: z
      .array(z.enum(SYMBOLS))
      .min(1)
      .max(SYMBOLS.length)
      .refine((v) => new Set(v).size === v.length),
    tradeAmountCents: z
      .number()
      .int()
      .min(SETTINGS_BOUNDS.tradeAmountCents.min)
      .max(SETTINGS_BOUNDS.tradeAmountCents.max),
    maxPositions: z
      .number()
      .int()
      .min(SETTINGS_BOUNDS.maxPositions.min)
      .max(SETTINGS_BOUNDS.maxPositions.max),
    stopLossPct: z
      .number()
      .min(SETTINGS_BOUNDS.stopLossPct.min)
      .max(SETTINGS_BOUNDS.stopLossPct.max),
    takeProfitPct: z
      .number()
      .min(SETTINGS_BOUNDS.takeProfitPct.min)
      .max(SETTINGS_BOUNDS.takeProfitPct.max),
    maxHoldSeconds: z
      .number()
      .int()
      .min(SETTINGS_BOUNDS.maxHoldSeconds.min)
      .max(SETTINGS_BOUNDS.maxHoldSeconds.max),
    maxSessionLossPct: z
      .number()
      .min(SETTINGS_BOUNDS.maxSessionLossPct.min)
      .max(SETTINGS_BOUNDS.maxSessionLossPct.max),
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
