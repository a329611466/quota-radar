import type { Forecast } from '../lib/forecast';

export interface ForecastCardProps {
  forecast: Forecast | null;
  /** 各时间窗内的累计概率 */
  horizons: { horizon: number; probability: number }[];
  labels: {
    likelyOne: string;
    likelyRange: string;
    sub: string;
    chartTitle: string;
    within: string;
    window: string;
    typical: string;
    note: string;
    days: string;
  };
}

export function ForecastCard({ forecast, horizons, labels }: ForecastCardProps) {
  if (!forecast) {
    return <p className="section-sub">{labels.note}</p>;
  }

  const maxProbability = Math.max(0.01, ...horizons.map((item) => item.probability));
  const refRatio = Math.min(1, 0.8 / maxProbability);

  const headline =
    forecast.likelyFrom === forecast.likelyTo
      ? labels.likelyOne.replace('{n}', String(forecast.likelyFrom))
      : labels.likelyRange
          .replace('{from}', String(forecast.likelyFrom))
          .replace('{to}', String(forecast.likelyTo));

  const sub = labels.sub
    .replace('{t}', forecast.daysSinceLast.toFixed(1))
    .replace('{n}', String(forecast.window80 > 0 ? forecast.window80 : '—'));

  return (
    <div className="forecast">
      <div className="forecast__main">
        <p className="forecast__headline">{headline}</p>
        <p className="forecast__sub">{sub}</p>

        <div className="forecast__chart">
          <p className="forecast__chart-title">{labels.chartTitle}</p>

          <div className="daybars">
            <div className="daybars__pcts">
              {horizons.map((item) => (
                <span key={item.horizon}>
                  {Math.round(item.probability * 100)}%
                </span>
              ))}
            </div>

            <div className="daybars__plot">
              <div className="forecast__ref" style={{ bottom: `${refRatio * 86}%` }}>
                <span>80%</span>
              </div>
              {horizons.map((item) => (
                <div className="daybar" key={item.horizon}>
                  <div
                    className="daybar__fill"
                    style={{ height: `${(item.probability / maxProbability) * 86}%` }}
                  />
                </div>
              ))}
            </div>

            <div className="daybars__labels">
              {horizons.map((item) => (
                <span key={item.horizon}>
                  {labels.within.replace('{n}', String(item.horizon))}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="forecast__stats">
        <div className="stat">
          <span className="stat__value">
            {forecast.window80 > 0 ? forecast.window80 : '—'}
            {forecast.window80 > 0 ? <em> {labels.days}</em> : null}
          </span>
          <span className="stat__label">{labels.window}</span>
        </div>
        <div className="stat">
          <span className="stat__value">
            {forecast.typicalGap.toFixed(1)}
            <em> {labels.days}</em>
          </span>
          <span className="stat__label">{labels.typical}</span>
        </div>
        <p className="forecast__note">{labels.note}</p>
      </div>
    </div>
  );
}
