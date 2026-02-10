import { EvalResult } from '@shared/types';

export async function evaluateFeasibility(): Promise<EvalResult> {
  return {
    name: 'feasibility',
    passed: true,
    failures: [],
  };
}
