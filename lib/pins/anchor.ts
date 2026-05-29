import { z } from "zod";

export type Anchor = {
  xPct: number;
  yPct: number;
  selector: string | null;
  selectorOffset: { dx: number; dy: number } | null;
  scrollHeight: number;
};

export const anchorSchema = z.object({
  xPct: z.number().min(0).max(1),
  yPct: z.number().min(0).max(1),
  selector: z.string().max(2000).nullable(),
  selectorOffset: z
    .object({ dx: z.number().min(0).max(1), dy: z.number().min(0).max(1) })
    .nullable(),
  scrollHeight: z.number().min(0).max(200000),
});
