import type { ListProjectSkillsResult } from '@lobechat/electron-client-ipc';

import { lambdaClient } from '@/libs/trpc/client';
import { localFileService } from '@/services/electron/localFileService';

/**
 * Project skills chokepoint. Picks the transport per call from `deviceId`: a
 * remote / web target goes through the `device.listProjectSkills` RPC; the local
 * desktop talks to Electron over IPC. UI / store only see this service — the
 * electron-vs-lambda decision never leaks up. (Parallels `projectFileService`.)
 */
class ProjectSkillService {
  /** List project and execution-device `.agents/skills` / `.claude/skills`. */
  async listProjectSkills({
    agentType,
    deviceId,
    scope,
  }: {
    /** Heterogeneous CLI whose native `/name` skills should be merged in. */
    agentType?: string;
    deviceId?: string;
    scope: string;
  }): Promise<ListProjectSkillsResult | undefined> {
    return deviceId
      ? ((await lambdaClient.device.listProjectSkills.query({ agentType, deviceId, scope })) ??
          undefined)
      : localFileService.listProjectSkills({ agentType, scope });
  }
}

export const projectSkillService = new ProjectSkillService();
