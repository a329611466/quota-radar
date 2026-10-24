import type { RhythmStats } from '../lib/rhythm';

export interface RhythmChartProps {
  rhythm: RhythmStats;
  labels: {
    intervals: string;
    weekdays: string;
    days: string;
    recent: string;
    full: string;
  };
}

export function RhythmChart({ rhythm, labels }: RhythmChartProps) {
  const maxBucket = Math.max(1, ...rhythm.buckets.map((bucket) => bucket.count));
  const maxWeekday = Math.max(1, ...rhythm.weekdays.map((day) => day.count));

  return (
    <div className="rhythm">
      <div className="chart">
        <p className="chart__title">{labels.intervals}</p>
        <div className="bars">
          {rhythm.buckets.map((bucket) => (
            <div className="bar" key={bucket.label}>
              <span>{`${bucket.label} ${labels.days}`}</span>
              <div className="bar__track">
                <div
                  className="bar__fill"
                  style={{ width: `${(bucket.count / maxBucket) * 100}%` }}
                />
              </div>
              <span className="bar__count">{bucket.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chart">
        <p className="chart__title">{labels.weekdays}</p>
        <div className="weekdays">
          {rhythm.weekdays.map((day) => {
            const height = 18 + (day.count / maxWeekday) * 66;
            return (
              <div className="weekday" key={day.index}>
                <span className="weekday__count">{day.count}</span>
                <div
                  className={`weekday__bar${
                    day.count === maxWeekday ? ' weekday__bar--peak' : ''
                  }`}
                  style={{ height: `${height}px` }}
                />
                <span className="weekday__label">{day.short}</span>
              </div>
            );
          })}
        </div>
        <p className="section-sub" style={{ marginTop: 'var(--space-4)' }}>
          {`${labels.recent} ${rhythm.recentMedianGap.toFixed(1)} ${labels.days} · ${labels.full} ${rhythm.fullAvgGap.toFixed(1)} ${labels.days}`}
        </p>
      </div>
    </div>
  );
}
