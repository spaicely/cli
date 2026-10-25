// Exit codes are part of the interface: scripts and CI depend on them.
export const EXIT = {
  ok: 0,
  failure: 1,
  usage: 2,
  notLoggedIn: 3,
  forbidden: 4,
  conflict: 5,
} as const;

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: number = EXIT.failure,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
