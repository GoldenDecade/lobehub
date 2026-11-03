import { Button, Center, Empty } from '@lobehub/ui';
import { LayoutDashboardIcon, RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { artboardActions } from '../store';

export const BoardEmpty = () => {
  const { t } = useTranslation('project');
  return (
    <Center height={'100%'} padding={24}>
      <Empty
        description={t('artboard.empty.desc')}
        icon={LayoutDashboardIcon}
        title={t('artboard.empty.title')}
        action={
          <Button
            icon={RotateCcwIcon}
            type={'primary'}
            onClick={() => {
              artboardActions.setPreviewState('normal');
              artboardActions.replay();
            }}
          >
            {t('artboard.empty.action')}
          </Button>
        }
      />
    </Center>
  );
};

export const BoardError = () => {
  const { t } = useTranslation('project');
  return (
    <Center height={'100%'} padding={24}>
      <Empty
        description={t('artboard.error.desc')}
        icon={TriangleAlertIcon}
        title={t('artboard.error.title')}
        action={
          <Button icon={RotateCcwIcon} onClick={() => artboardActions.setPreviewState('normal')}>
            {t('artboard.error.retry')}
          </Button>
        }
      />
    </Center>
  );
};
