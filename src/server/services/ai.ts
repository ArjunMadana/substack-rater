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
  sourceSnippet: z.string().nullable().default(null),
  verificationQuery: z.string().nullable().default(null),
  verifiabilityReason: z.string().nullable().default(null)
});

export type ExtractedClaim = z.infer<typeof extractedClaimSchema>;
export type ClaimVerificationOutcome = 'supported' | 'contradicted' | 'mixed' | 'unresolved';

export const claimVerificationSchema = z.object({
  outcome: z.enum(['supported', 'contradicted', 'mixed', 'unresolved']),
  confidence: z.string().nullable().default(null),
  summary: z.string().min(1),
  sources: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().min(1),
        note: z.string().nullable().default(null)
      })
    )
    .default([])
});

export type ClaimVerification = z.infer<typeof claimVerificationSchema>;

export interface AiProvider {
  extractClaims(input: { title: string; text: string }): Promise<ExtractedClaim[]>;
  verifyClaim(input: {
    claimText: string;
    claimType: string;
    ticker: string | null;
    dueDate: string | null;
    verificationQuery: string | null;
    sourceSnippet: string | null;
  }): Promise<ClaimVerification>;
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
              'Extract only substantive, falsifiable claims from newsletter articles. Keep claims only when a reasonable analyst could later verify them with public filings, market data, company releases, reliable news, or dated outcomes. Focus on forecasts, price/valuation targets, company/ticker claims, causal claims, and concrete investment theses. Exclude disclaimers, unsubscribe text, portfolio logistics, author process notes, vague opinions, generic commentary, and meta claims like "positions will change with time". For each claim, write a concise verificationQuery and explain why it is verifiable. Return JSON only.'
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
                      sourceSnippet: { type: ['string', 'null'] },
                      verificationQuery: { type: ['string', 'null'] },
                      verifiabilityReason: { type: ['string', 'null'] }
                    },
                    required: [
                      'claimText',
                      'claimType',
                      'ticker',
                      'timeHorizon',
                      'dueDate',
                      'confidence',
                      'evidence',
                      'sourceSnippet',
                      'verificationQuery',
                      'verifiabilityReason'
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
    return parsed.claims.filter(isVerifiableClaim);
  }

  async verifyClaim(input: {
    claimText: string;
    claimType: string;
    ticker: string | null;
    dueDate: string | null;
    verificationQuery: string | null;
    sourceSnippet: string | null;
  }) {
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
        tools: [{ type: 'web_search' }],
        input: [
          {
            role: 'system',
            content:
              'Verify the claim using current web evidence. Use public, reliable sources such as company filings, press releases, reputable financial data/news, or primary sources. Return supported only when evidence directly confirms the claim, contradicted only when evidence directly refutes it, mixed when material parts differ, and unresolved when the claim is future-dated, too vague, or evidence is insufficient. Do not guess.'
          },
          {
            role: 'user',
            content: [
              `Claim: ${input.claimText}`,
              `Type: ${input.claimType}`,
              `Ticker: ${input.ticker ?? 'none'}`,
              `Due date: ${input.dueDate ?? 'none'}`,
              `Suggested search: ${input.verificationQuery ?? 'none'}`,
              `Article snippet: ${input.sourceSnippet ?? 'none'}`
            ].join('\n')
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'claim_verification',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                outcome: { type: 'string', enum: ['supported', 'contradicted', 'mixed', 'unresolved'] },
                confidence: { type: ['string', 'null'] },
                summary: { type: 'string' },
                sources: {
                  type: 'array',
                  maxItems: 5,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      title: { type: 'string' },
                      url: { type: 'string' },
                      note: { type: ['string', 'null'] }
                    },
                    required: ['title', 'url', 'note']
                  }
                }
              },
              required: ['outcome', 'confidence', 'summary', 'sources']
            }
          }
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI claim verification failed: ${response.status}. ${body.slice(0, 500)}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    const outputText = extractOutputText(body);
    return claimVerificationSchema.parse(JSON.parse(outputText));
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

    return candidates.slice(0, 8).map((sentence) => {
      const ticker = sentence.match(/\$[A-Z]{1,5}\b/)?.[0] ?? null;
      return extractedClaimSchema.parse({
        claimText: sentence,
        claimType: /\btarget|upside|downside|\$[A-Z]{1,5}\b/.test(sentence) ? 'investment_prediction' : 'prediction',
        ticker,
        sourceSnippet: sentence,
        verificationQuery: [ticker, sentence.slice(0, 120)].filter(Boolean).join(' '),
        verifiabilityReason: 'Contains a concrete market, company, ticker, metric, or dated forecast signal.'
      });
    }).filter(isVerifiableClaim);
  }

  async verifyClaim(input: { claimText: string }) {
    return claimVerificationSchema.parse({
      outcome: 'unresolved',
      confidence: 'low',
      summary: `OpenAI web verification is not configured. Manually verify this claim: ${input.claimText}`,
      sources: []
    });
  }
}

export function getAiProvider(): AiProvider {
  if (config.openAiApiKey) {
    return new OpenAiProvider();
  }

  return new HeuristicAiProvider();
}

export function isVerifiableClaim(claim: ExtractedClaim) {
  const text = claim.claimText.trim();
  const lower = text.toLowerCase();
  if (text.length < 35) return false;

  const rejectPattern =
    /\b(not financial advice|do your own research|unsubscribe|view this post|positions? (will|may|can|could) change|subject to change|i own|i may buy|i may sell|contact me|subscribe|share this|thanks for reading)\b/i;
  if (rejectPattern.test(text)) return false;

  const hasEntity =
    Boolean(claim.ticker) ||
    /\$[A-Z]{1,5}\b/.test(text) ||
    /\b[A-Z]{2,5}\b/.test(text) ||
    /\b(company|management|customer|customers|stock|market|segment|business|product|platform|technology|drug|trial)\b/i.test(text);
  const hasMeasurableSignal =
    /\b(20\d{2}|Q[1-4]|next quarter|this quarter|this year|next year|within|by|after|before|\d+%|\$[\d,.]+|revenue|earnings|eps|margin|gross margin|cash flow|valuation|multiple|guidance|price target|upside|downside|profit|loss|growth|decline|approval|launch|capacity|supply|demand|market share|users?|customers?)\b/i.test(
      text
    );
  const hasFalsifiableVerb =
    /\b(will|should|expect|expects|forecast|target|project|likely|unlikely|increase|decrease|grow|decline|beat|miss|outperform|underperform|cause|because|driven by|lead to|result in)\b/i.test(
      lower
    );

  return hasEntity && hasMeasurableSignal && hasFalsifiableVerb;
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
