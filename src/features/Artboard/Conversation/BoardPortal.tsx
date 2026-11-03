import { Flexbox, Icon, Text } from '@lobehub/ui';
import { PresentationIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import BoardView from '../Board';

const BoardPortal = () => (
  // The tool panel pads its body for reading; the board runs edge to edge.
  <Flexbox flex={1} height={'100%'} style={{ marginInline: -12, minHeight: 0 }}>
    <BoardView />
  </Flexbox>
);

export const BoardPortalTitle = () => {
  const { t } = useTranslation('project');
  return (
    <Flexbox horizontal align={'center'} gap={8} style={{ minWidth: 0 }}>
      <Icon icon={PresentationIcon} size={18} />
      <Text ellipsis weight={500}>
        {t('artboard.header.title')}
      </Text>
    </Flexbox>
  );
};

export default BoardPortal;
