import { describe, expect, it } from 'vitest';

import { getHeterogeneousAgentDriver } from '../index';
import { antigravityDriver } from './antigravity';

describe('antigravityDriver', () => {
  it('registers the driver and requires native ACP execution', async () => {
    expect(getHeterogeneousAgentDriver('antigravity')).toBe(antigravityDriver);
    await expect(antigravityDriver.buildSpawnPlan({} as never)).rejects.toThrow(
      'native ACP session',
    );
  });
});
