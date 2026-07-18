import { resolve } from "node:path";

export interface CliArgs {
  positionals: string[];
  flags: Map<string, string | true>;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }

    const equalsIndex = argument.indexOf("=");
    if (equalsIndex >= 0) {
      flags.set(argument.slice(2, equalsIndex), argument.slice(equalsIndex + 1));
      continue;
    }

    const name = argument.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(name, next);
      index += 1;
    } else {
      flags.set(name, true);
    }
  }

  return { positionals, flags };
}

export function flagString(args: CliArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  if (value === undefined || value === true) return undefined;
  return value;
}

export function flagPath(args: CliArgs, name: string): string | undefined {
  const value = flagString(args, name);
  return value ? resolve(value) : undefined;
}

export function hasFlag(args: CliArgs, name: string): boolean {
  return args.flags.has(name);
}
