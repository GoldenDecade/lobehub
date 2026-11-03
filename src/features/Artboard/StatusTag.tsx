import { Icon, Tag } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import { CheckIcon, CircleDashedIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CheckStatus } from './types';

export const STATUS_META = {
  failed: { color: 'error', icon: XIcon, tone: cssVar.colorError },
  passed: { color: 'success', icon: CheckIcon, tone: cssVar.colorSuccess },
  pending: { color: undefined, icon: CircleDashedIcon, tone: cssVar.colorTextTertiary },
} as const;

const StatusTag = ({ status }: { status: CheckStatus }) => {
  const { t } = useTranslation('project');
  const meta = STATUS_META[status];
  return (
    <Tag color={meta.color} icon={<Icon icon={meta.icon} />} size={'small'}>
      {t(`artboard.status.${status}`)}
    </Tag>
  );
};

export default StatusTag;
