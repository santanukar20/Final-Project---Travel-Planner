import { EvalResult } from '@shared/types';

export async function evaluateGrounding(): Promise<EvalResult> {
  return {
    name: 'grounding',
    passed: true,
    failures: [],
  };
}
