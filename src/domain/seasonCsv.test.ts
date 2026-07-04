import { describe, expect, it } from 'vitest';

import { buildSeasonCSV, type SeasonCsvRow } from './seasonCsv';

const row = (seq: number, outcome: string, opponent: string | null = 'Tigers'): SeasonCsvRow => ({
  playedOn: '2026-06-01',
  opponent,
  seq,
  outcome,
});

describe('buildSeasonCSV', () => {
  it('carries the running season line on every PA row', () => {
    const csv = buildSeasonCSV('Spring 2026', [row(1, '1B'), row(2, 'K'), row(3, 'BB')]);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('date,opponent,at_bat,outcome,outcome_name,pa,ab,h,avg,obp,slg,ops');
    expect(lines[1]).toBe('2026-06-01,Tigers,1,1B,Single,1,1,1,1.000,1.000,1.000,2.000');
    expect(lines[2]).toBe('2026-06-01,Tigers,2,K,Strikeout,2,2,1,.500,.500,.500,1.000');
    expect(lines[3]).toBe('2026-06-01,Tigers,3,BB,Walk,3,2,1,.500,.667,.500,1.167');
  });

  it('appends season totals and a tally of outcomes that occurred', () => {
    const csv = buildSeasonCSV('Spring 2026', [
      row(1, '1B'),
      row(2, 'HR'),
      row(3, 'K'),
      row(4, 'K'),
    ]);
    const lines = csv.split('\n');

    const totalsHeader = lines.indexOf('season,pa,ab,h,tb,avg,obp,slg,ops');
    expect(totalsHeader).toBeGreaterThan(0);
    expect(lines[totalsHeader + 1]).toBe('Spring 2026,4,4,2,5,.500,.500,1.250,1.750');

    const tallyHeader = lines.indexOf('outcome,outcome_name,count');
    expect(tallyHeader).toBeGreaterThan(totalsHeader);
    // Only outcomes that occurred, in taxonomy order.
    expect(lines.slice(tallyHeader + 1)).toEqual(['1B,Single,1', 'HR,Home Run,1', 'K,Strikeout,2']);
  });

  it('escapes commas and quotes in names', () => {
    const csv = buildSeasonCSV('Fall "B" Squad', [row(1, '2B', 'Red, White & Blue')]);
    expect(csv).toContain('"Red, White & Blue"');
    expect(csv).toContain('"Fall ""B"" Squad"');
  });

  it('produces headers plus empty totals for a season with no PAs', () => {
    const lines = buildSeasonCSV('Empty', []).split('\n');
    expect(lines[0]).toBe('date,opponent,at_bat,outcome,outcome_name,pa,ab,h,avg,obp,slg,ops');
    expect(lines).toContain('Empty,0,0,0,0,,,,');
    // Tally section exists but has no rows.
    expect(lines[lines.length - 1]).toBe('outcome,outcome_name,count');
  });
});
