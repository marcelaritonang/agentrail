export type FindingSeverity = "advisory" | "blocking";

export type DesignFinding = {
  filePath: string;
  line: number;
  ruleId: string;
  severity: FindingSeverity;
  message: string;
};

type PatternRule = {
  ruleId: string;
  severity: FindingSeverity;
  message: string;
  pattern: RegExp;
};

const PATTERN_RULES: readonly PatternRule[] = [
  {
    ruleId: "transition-all",
    severity: "blocking",
    message:
      "Animate named properties; transition-all hides unintended motion.",
    pattern: /\btransition-all\b/g,
  },
  {
    ruleId: "gradient",
    severity: "blocking",
    message:
      "AgentRail dashboard does not use gradient or gradient text effects.",
    pattern:
      /\b(?:bg-gradient(?:-to-[a-z]+)?|bg-clip-text|text-transparent|linear-gradient|radial-gradient)\b/g,
  },
  {
    ruleId: "glassmorphism",
    severity: "blocking",
    message: "Backdrop blur is outside the forensic dashboard identity.",
    pattern: /\bbackdrop-blur(?:-[a-z0-9]+)?\b/g,
  },
  {
    ruleId: "second-icon-family",
    severity: "blocking",
    message: "Use @phosphor-icons/react as the only icon family.",
    pattern:
      /from\s+["'](?:lucide-react|react-icons(?:\/[^"']+)?|@heroicons\/[^"']+|@mui\/icons-material)["']/g,
  },
  {
    ruleId: "large-radius",
    severity: "advisory",
    message: "Large radii usually conflict with AgentRail's recorder geometry.",
    pattern: /\brounded-(?:xl|2xl|3xl|full)\b/g,
  },
  {
    ruleId: "decorative-animation",
    severity: "advisory",
    message: "Review animation and keep only state-communicating motion.",
    pattern: /\banimate-[a-z0-9-]+\b/g,
  },
  {
    ruleId: "hover-scale",
    severity: "advisory",
    message: "Repeated hover scaling reads as decorative rather than forensic.",
    pattern: /\bhover:scale-[a-z0-9-]+\b/g,
  },
  {
    ruleId: "running-status",
    severity: "blocking",
    message:
      "M1 has no running status; null completion state renders no badge.",
    pattern: /[>"']\s*running\s*[<"']/gi,
  },
];

const RAW_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\(/gi;
const AMBER_ON_AMBER =
  /(?:color\s*:\s*var\(--signal-action\)[^{}]*background(?:-color)?\s*:\s*var\(--signal-action-muted\)|background(?:-color)?\s*:\s*var\(--signal-action-muted\)[^{}]*color\s*:\s*var\(--signal-action\))/gi;

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function findingsForPattern(
  filePath: string,
  source: string,
  rule: PatternRule,
): DesignFinding[] {
  const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
  return Array.from(source.matchAll(pattern), (match) => ({
    filePath,
    line: lineAt(source, match.index),
    ruleId: rule.ruleId,
    severity: rule.severity,
    message: rule.message,
  }));
}

export function scanSource(filePath: string, source: string): DesignFinding[] {
  const findings = PATTERN_RULES.flatMap((rule) =>
    findingsForPattern(filePath, source, rule),
  );

  if (
    !filePath.replaceAll("\\", "/").endsWith("/globals.css") &&
    filePath !== "globals.css"
  ) {
    findings.push(
      ...findingsForPattern(filePath, source, {
        ruleId: "raw-component-color",
        severity: "blocking",
        message: "Define colors once as semantic tokens in globals.css.",
        pattern: RAW_COLOR,
      }),
    );
  }

  findings.push(
    ...findingsForPattern(filePath, source, {
      ruleId: "amber-on-amber",
      severity: "blocking",
      message:
        "Amber foreground on muted amber does not meet the dashboard contrast contract.",
      pattern: AMBER_ON_AMBER,
    }),
  );

  return findings.sort(
    (left, right) =>
      left.line - right.line || left.ruleId.localeCompare(right.ruleId),
  );
}
