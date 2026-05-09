import { z } from 'zod';
import { config } from '../config.js';

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

const openAiClaimResponseSchema = z.object({
  claims: z.array(extractedClaimSchema).default([])
});

export class OpenAiProvider implements AiProvider {
  async extractClaims(input: { title: string; text: string }) {
    if (!config.openAiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openAiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.openAiModel,
        input: [
          {
            role: 'system',
            content:
              'Extract only substantive, checkable claims from newsletter articles. Focus on forecasts, causal claims, company/ticker claims, factual claims that can later be verified, and investment theses. Exclude disclaimers, unsubscribe text, personal logistics, vague opinions, and generic commentary. Return JSON only.'
          },
          {
            role: 'user',
            content: `Title: ${input.title}\n\nArticle:\n${input.text.slice(0, 55000)}`
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'claim_extraction',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                claims: {
                  type: 'array',
                  maxItems: 15,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      claimText: { type: 'string' },
                      claimType: {
                        type: 'string',
                        enum: ['prediction', 'investment_prediction', 'factual_claim', 'causal_claim', 'thesis']
                      },
                      ticker: { type: ['string', 'null'] },
                      timeHorizon: { type: ['string', 'null'] },
                      dueDate: { type: ['string', 'null'] },
                      confidence: { type: ['string', 'null'] },
                      evidence: { type: ['string', 'null'] },
                      sourceSnippet: { type: ['string', 'null'] }
                    },
                    required: [
                      'claimText',
                      'claimType',
                      'ticker',
                      'timeHorizon',
                      'dueDate',
                      'confidence',
                      'evidence',
                      'sourceSnippet'
                    ]
                  }
                }
              },
              required: ['claims']
            }
          }
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI claim extraction failed: ${response.status}. ${body.slice(0, 500)}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    const outputText = extractOutputText(body);
    const parsed = openAiClaimResponseSchema.parse(JSON.parse(outputText));
    return parsed.claims;
  }
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
  if (config.openAiApiKey) {
    return new OpenAiProvider();
  }

  return new HeuristicAiProvider();
}

function extractOutputText(response: Record<string, unknown>) {
  if (typeof response.output_text === 'string') {
    return response.output_text;
  }

  const output = response.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== 'object') continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
        }
      }
    }
  }

  throw new Error('OpenAI response did not include output text');
}
