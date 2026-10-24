import type { LogLine } from '../data/types';

export interface TerminalLogProps {
  lines: LogLine[];
}

export function TerminalLog({ lines }: TerminalLogProps) {
  return (
    <div className="telemetry" role="log" aria-live="polite">
      {lines.map((line, index) => (
        <div key={`${line.ts}-${index}`} className={`telemetry__line telemetry__line--${line.level}`}>
          <span className="telemetry__ts">[{line.ts}]</span>
          <span className="telemetry__msg">{line.text}</span>
        </div>
      ))}
      <div className="telemetry__line">
        <span className="telemetry__cursor" />
      </div>
    </div>
  );
}
