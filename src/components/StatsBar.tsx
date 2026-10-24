import type { DerivedStats } from '../data/types';

export interface StatsBarProps {
  stats: DerivedStats;
  labels: {
    total: string;
    avgInterval: string;
    longestWait: string;
    days: string;
  };
}

export function StatsBar({ stats, labels }: StatsBarProps) {
  return (
    <dl className="readouts">
      <div>
        <dt>{labels.total}</dt>
        <dd>{stats.total}</dd>
      </div>
      <div>
        <dt>{labels.avgInterval}</dt>
        <dd>
          {stats.avgIntervalDays.toFixed(1)}
          <em>{labels.days}</em>
        </dd>
      </div>
      <div>
        <dt>{labels.longestWait}</dt>
        <dd>
          {stats.longestWaitDays.toFixed(1)}
          <em>{labels.days}</em>
        </dd>
      </div>
    </dl>
  );
}
