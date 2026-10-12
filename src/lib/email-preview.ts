// Browser-safe projection: explicit allowlist, never internal notes.
export function emailContent(
  s: {
    leader_name: string;
    team_name: string;
    project_title: string;
    reference_code: string;
  },
  f: Record<string, unknown>,
) {
  return `VISHWAKARMA: FARLANDS\nHello ${s.leader_name},\n${s.team_name} · ${s.project_title}\nReference: ${s.reference_code}\n\n${[
    ["Overall feedback", "overall_feedback"],
    ["Strengths", "strengths"],
    ["Areas for improvement", "improvements"],
    ["Technical suggestions", "technical_suggestions"],
    ["Practical next steps", "next_steps"],
    ["Additional recommendations", "recommendations"],
  ]
    .filter(([, k]) => f[k])
    .map(([label, k]) => `${label}\n${f[k]}`)
    .join("\n\n")}\n\n${Object.entries(
    (f.scores || {}) as Record<string, number>,
  )
    .map(([k, v]) => `Score: ${k}: ${v}`)
    .join("\n")}\n\nThe FARLANDS judging team`;
}
