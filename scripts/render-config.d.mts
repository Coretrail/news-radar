export function allowRules(value?: string): string;
export function nativeValues(env?: NodeJS.ProcessEnv): Record<string, string>;
export function substitute(template: string, values: Record<string, string>): string;
