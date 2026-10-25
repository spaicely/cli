import { createInterface } from "node:readline/promises";
import { CliError, EXIT } from "./errors.js";
import { t } from "./i18n.js";

let json = false;

export function setJson(value: boolean): void {
  json = value;
}

export function jsonMode(): boolean {
  return json;
}

// People read stderr while a command works; stdout carries the result, so
// `--json` output can be piped as is.
export function say(text: string): void {
  if (!json) process.stderr.write(`${text}\n`);
}

export function result(text: string, data: unknown): void {
  if (json) process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  else if (text) process.stdout.write(`${text}\n`);
}

export async function confirm(question: string, assumeYes: boolean): Promise<boolean> {
  if (assumeYes) return true;
  if (!process.stdin.isTTY || json) throw new CliError(t("no_tty"), EXIT.usage);
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = (await prompt.question(`${question} ${t("yes_no")} `)).trim().toLowerCase();
    return t("yes_answers").split(",").includes(answer);
  } finally {
    prompt.close();
  }
}
