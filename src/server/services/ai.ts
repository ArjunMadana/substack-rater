import { z } from 'zod';

export const extractedClaimSchema = z.object({
  claimText: z.string().min(1),
  claimType: z.string().default('prediction'),
  ticker: z.string().nullable().default(null),
  timeHorizon: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
  confidence: z.string().nullable().default(null),
  evidence: z.string().nullable().default(null),
  sourceSnippet: z.string().nullable().default(null)
});

export type ExtractedClaim = z.infer<typeof extractedClaimSchema>;

export interface AiProvider {
  extractClaims(input: { title: string; text: string }): Promise<ExtractedClaim[]>;
}

export class HeuristicAiProvider implements AiProvider {
  async extractClaims(input: { title: string; text: string }) {
    const rejectPattern =
      /\b(not financial advice|do your own research|unsubscribe|view this post|positions will change|contact me|subscribe|share\?)\b/i;
    const claimPattern =
      /\b(will|should|expect|expects|forecast|target|upside|downside|likely|positioned|shortage|superior|inferior|higher|lower|margin|yield|capacity|supply|demand|gross margins?|revenue|earnings|valuation|risk)\b/i;
    const sentences = input.text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 80 && sentence.length <= 700)
      .filter((sentence) => !rejectPattern.test(sentence));

    const candidates = sentences.filter((sentence) => {
      const hasTicker = /\$[A-Z]{1,5}\b/.test(sentence);
      const hasDate = /\b(20\d{2}|Q[1-4]|next quarter|this year|next year)\b/i.test(sentence);
      return claimPattern.test(sentence) && (hasTicker || hasDate || /\b(company|stock|market|customer|management|platform|technology|supply)\b/i.test(sentence));
    });

    return candidates.slice(0, 8).map((sentence) =>
      extractedClaimSchema.parse({
        claimText: sentence,
        claimType: /\btarget|upside|downside|\$[A-Z]{1,5}\b/.test(sentence) ? 'investment_prediction' : 'prediction',
        ticker: sentence.match(/\$[A-Z]{1,5}\b/)?.[0] ?? null,
        sourceSnippet: sentence
      })
    );
  }
}

export function getAiProvider(): AiProvider {
  return new HeuristicAiProvider();
}
