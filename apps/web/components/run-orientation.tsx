const steps = [
  ["1", "Choose a run"],
  ["2", "Open it"],
  ["3", "Inspect steps and recorded data"],
] as const;

export function RunOrientation() {
  return (
    <ol className="run-orientation" aria-label="How to inspect an agent run">
      {steps.map(([number, label]) => (
        <li key={number}>
          <span aria-hidden="true">{number}</span>
          <strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}
