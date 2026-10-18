#!/usr/bin/env node
import { runCli } from './program';
export { getCliVersion } from './version';
// This is the executable entry. Tests/library integrations import program.ts,
// whose construction is side-effect-free; the executable never exits mid-flush.
void runCli().then(code => { process.exitCode = code; }, () => { process.exitCode = 2; });
