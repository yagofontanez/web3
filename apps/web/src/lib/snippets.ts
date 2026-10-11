export type Lang = "curl" | "javascript" | "python";

export const LANGS: { id: Lang; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
];

export function snippets(base: string, path: string, key = "$SYSTEMA_API_KEY"): Record<Lang, string> {
  const url = `${base}${path}`;
  const envKey = key.startsWith("$");
  return {
    curl: `curl "${url}" \\\n  -H "Authorization: Bearer ${key}"`,
    javascript: `const res = await fetch("${url}", {\n  headers: { Authorization: \`Bearer \${${envKey ? "process.env.SYSTEMA_API_KEY" : JSON.stringify(key)}}\` },\n});\nconst { data, meta } = await res.json();`,
    python: `import os, requests\n\nres = requests.get(\n    "${url}",\n    headers={"Authorization": f"Bearer {${envKey ? 'os.environ["SYSTEMA_API_KEY"]' : JSON.stringify(key)}}"},\n)\ndata = res.json()["data"]`,
  };
}
