const { getMoodBucket, pickQuestion, utcDayKey } = require('./dailyQuestionPicker') as {
  getMoodBucket: (emotion?: string) => 'light' | 'heavy' | 'neutral';
  pickQuestion: (dayKey: string, bucket: 'light' | 'heavy' | 'neutral', lang: 'ru' | 'en') => string;
  utcDayKey: (date?: Date) => string;
};

export {};

describe('dailyQuestionPicker', () => {
  it('formats UTC day keys consistently', () => {
    expect(utcDayKey(new Date('2026-04-25T22:30:00.000Z'))).toBe('2026-04-25');
  });

  it('maps emotions into stable mood buckets', () => {
    expect(getMoodBucket('happy')).toBe('light');
    expect(getMoodBucket('sad')).toBe('heavy');
    expect(getMoodBucket('unknown')).toBe('neutral');
  });

  it('picks deterministic localized questions', () => {
    const first = pickQuestion('2026-04-25', 'neutral', 'ru');
    const second = pickQuestion('2026-04-25', 'neutral', 'ru');
    const english = pickQuestion('2026-04-25', 'neutral', 'en');

    expect(first).toBe(second);
    expect(english).not.toBe(first);
  });
});
