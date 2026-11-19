import { OFFICIAL_DEVICE_GATEWAY_URL, OFFICIAL_URL } from '@lobechat/const';

export { OFFICIAL_AGENT_GATEWAY_URL } from '@lobechat/const';

export const OFFICIAL_SERVER_URL = OFFICIAL_URL;
export const OFFICIAL_GATEWAY_URL = OFFICIAL_DEVICE_GATEWAY_URL;

/**
 * Default server and agent gateway URLs for this private (`wq`) distribution.
 * Overridable at runtime via `LOBEHUB_SERVER` / `AGENT_GATEWAY_URL` or `~/.lobehub/settings.json`.
 */
export const DEFAULT_SERVER_URL = 'https://lobe.85718571.xyz';
export const DEFAULT_AGENT_GATEWAY_URL = 'https://lobe.85718571.xyz/agent-gw';
