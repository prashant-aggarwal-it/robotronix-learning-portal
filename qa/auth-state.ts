import path from 'node:path';
import type { QaRole } from './env';

export function authStatePath(role: QaRole) {
  return path.resolve('.qa-auth', `${role}.json`);
}
