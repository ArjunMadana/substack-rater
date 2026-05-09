import { describe, expect, it } from 'vitest';
import { extractedClaimSchema, isVerifiableClaim } from './ai.js';

describe('claim verifiability gate', () => {
  it('rejects portfolio logistics and non-falsifiable meta statements', () => {
    const claim = extractedClaimSchema.parse({
      claimText: 'Positions will change with time as I update my portfolio based on new information.',
      claimType: 'prediction',
      ticker: null,
      sourceSnippet: 'Positions will change with time as I update my portfolio based on new information.'
    });

    expect(isVerifiableClaim(claim)).toBe(false);
  });

  it('keeps concrete investment claims with measurable outcomes', () => {
    const claim = extractedClaimSchema.parse({
      claimText: '$PGY revenue should grow more than 20% in 2026 as customer demand increases.',
      claimType: 'investment_prediction',
      ticker: '$PGY',
      timeHorizon: '2026',
      verificationQuery: 'PGY 2026 revenue growth customer demand',
      sourceSnippet: '$PGY revenue should grow more than 20% in 2026 as customer demand increases.'
    });

    expect(isVerifiableClaim(claim)).toBe(true);
  });
});
