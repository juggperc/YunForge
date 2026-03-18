import { CommandExitError, Sandbox } from 'e2b'

import type { Harness, Settings, SkillSpec } from '../shared/schema.ts'

type ExecuteSkillInput = {
  skill: SkillSpec
  input: unknown
  harness: Harness
  settings: Settings
}

const sandboxWorkingDir = '/tmp/yunforge'

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    }
  }

  return {
    message: String(error),
  }
}

function buildRunnerSource() {
  return `
import fs from 'node:fs/promises';

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

const payload = JSON.parse(await fs.readFile('${sandboxWorkingDir}/payload.json', 'utf8'));
const source = String(payload.code ?? '')
  .trim()
  .replace(/^\\\`\\\`\\\`(?:js|javascript)?\\s*/i, '')
  .replace(/\\s*\\\`\\\`\\\`$/, '')
  .replace(/^export\\s+default\\s+/i, '');

let toolFn;

try {
  toolFn = (0, eval)('(' + source + ')');
} catch (error) {
  const result = { ok: false, error: serializeError(error) };
  await fs.writeFile('${sandboxWorkingDir}/result.json', JSON.stringify(result, null, 2));
  console.error(JSON.stringify(result));
  process.exit(1);
}

if (typeof toolFn !== 'function') {
  const result = {
    ok: false,
    error: {
      message: 'Generated skill code did not evaluate to a callable function.',
    },
  };
  await fs.writeFile('${sandboxWorkingDir}/result.json', JSON.stringify(result, null, 2));
  console.error(JSON.stringify(result));
  process.exit(1);
}

try {
  const value = await toolFn(payload.input ?? {}, payload.context ?? {});
  const result = { ok: true, result: value };
  await fs.writeFile('${sandboxWorkingDir}/result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  const result = { ok: false, error: serializeError(error) };
  await fs.writeFile('${sandboxWorkingDir}/result.json', JSON.stringify(result, null, 2));
  console.error(JSON.stringify(result));
  process.exit(1);
}
`.trim()
}

async function readSandboxResult(sandbox: Sandbox) {
  const payload = await sandbox.files.read(`${sandboxWorkingDir}/result.json`)
  return JSON.parse(payload as string) as
    | { ok: true; result: unknown }
    | { ok: false; error: { message: string } }
}

export async function executeSkillInSandbox({
  skill,
  input,
  harness,
  settings,
}: ExecuteSkillInput) {
  if (!settings.e2bKey.trim()) {
    throw new Error('E2B API key is not configured.')
  }

  const sandbox = await Sandbox.create({
    apiKey: settings.e2bKey,
    timeoutMs: 120_000,
  })

  try {
    await sandbox.files.write([
      {
        path: `${sandboxWorkingDir}/payload.json`,
        data: JSON.stringify({
          code: skill.code,
          input,
          context: {
            now: new Date().toISOString(),
            harness: {
              id: harness.id,
              name: harness.name,
              goal: harness.spec.goal,
              audience: harness.spec.audience,
              model: harness.spec.model,
              memoryPolicy: harness.spec.memoryPolicy,
            },
            settings: {
              defaultModel: settings.defaultModel,
            },
          },
        }),
      },
      {
        path: `${sandboxWorkingDir}/runner.mjs`,
        data: buildRunnerSource(),
      },
    ])

    await sandbox.commands.run(`node ${sandboxWorkingDir}/runner.mjs`, {
      cwd: sandboxWorkingDir,
      timeoutMs: 60_000,
    })

    const result = await readSandboxResult(sandbox)

    if (!result.ok) {
      throw new Error(result.error.message)
    }

    return result.result
  } catch (error) {
    if (error instanceof CommandExitError) {
      try {
        const result = await readSandboxResult(sandbox)

        if (!result.ok) {
          throw new Error(result.error.message)
        }

        return result.result
      } catch {
        throw new Error(error.stderr || error.stdout || error.message)
      }
    }

    throw new Error(serializeError(error).message)
  } finally {
    await sandbox.kill().catch(() => undefined)
  }
}
