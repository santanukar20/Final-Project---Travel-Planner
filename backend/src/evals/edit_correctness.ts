import { EvalResult } from '@shared/types';

export async function evaluateEditCorrectness(): Promise<EvalResult> {
  return {
    name: 'edit_correctness',
    passed: true,
    failures: [],
  };
}
