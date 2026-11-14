import { config } from '../config.js';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export class LocalTranslationEngine {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<
    number,
    {
      resolve: (value: string[]) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
      child: ChildProcessWithoutNullStreams;
    }
  >();
  private id = 0;
  private start() {
    if (this.child) return this.child;
    const path = existsSync(new URL('./engine.py', import.meta.url))
      ? new URL('./engine.py', import.meta.url)
      : new URL('../../server/translation/engine.py', import.meta.url);
    const child = spawn(config.translationPython, [fileURLToPath(path), config.translationModels], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: '1',
        OMP_NUM_THREADS: '2',
        MKL_NUM_THREADS: '2',
      },
    });
    this.child = child;
    child.stderr.on('data', (data) => process.stderr.write(data));
    const fail = (error: Error) => {
      if (this.child === child) this.child = null;
      for (const [id, pending] of this.pending) {
        if (pending.child !== child) continue;
        clearTimeout(pending.timer);
        pending.reject(error);
        this.pending.delete(id);
      }
    };
    createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        const data = JSON.parse(line),
          pending = this.pending.get(data.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(data.id);
        if (data.error) pending.reject(Error(data.error));
        else if (!Array.isArray(data.texts) || !data.texts.every((v: any) => typeof v === 'string'))
          pending.reject(Error('Resposta inválida do motor local'));
        else pending.resolve(data.texts);
      } catch {
        fail(Error('Resposta inválida do motor local'));
        child.kill('SIGKILL');
      }
    });
    child.on('error', fail);
    child.on('exit', (code, signal) => fail(Error(`Motor local terminou (${code ?? signal})`)));
    return child;
  }
  async translate(texts: string[], language: string): Promise<string[]> {
    if (!texts.length) return [];
    const child = this.start(),
      id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(Error('Tempo limite da tradução local excedido'));
        this.pending.delete(id);
      }, 60000);
      this.pending.set(id, { resolve, reject, timer, child });
      child.stdin.write(JSON.stringify({ id, texts, language }) + '\n', (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }
  close() {
    this.child?.kill('SIGTERM');
    this.child = null;
  }
}
