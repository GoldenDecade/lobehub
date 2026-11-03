import { Button, Flexbox, Icon, Segmented, Text } from '@lobehub/ui';
import * as stylex from '@stylexjs/stylex';
import { SparklesIcon, WandSparklesIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { floatStyles } from '../Canvas/Overlays';
import { artboardActions, useArtboardStore } from '../store';
import type { BoardPreviewState, VerifyView } from '../types';

const styles = stylex.create({
  center: {
    insetBlockStart: 12,
    insetInline: 12,
    marginInline: 'auto',
    width: 'fit-content',
  },
  preview: {
    insetBlockEnd: 'calc(12px + env(safe-area-inset-bottom, 0px))',
    insetInlineEnd: 12,
  },
});

export const VerifyBar = () => {
  const { t } = useTranslation('project');
  const { filled, showReal, typing, verifyView } = useArtboardStore((s) => ({
    filled: !!s.run,
    showReal: s.showReal,
    typing: s.typing,
    verifyView: s.verifyView,
  }));

  return (
    <Flexbox
      horizontal
      align="center"
      gap={8}
      justify="center"
      paddingInline={8}
      wrap="wrap"
      {...stylex.props(floatStyles.float, styles.center)}
    >
      <Segmented
        size={'small'}
        value={verifyView}
        options={[
          { label: t('artboard.verifyBar.flow'), value: 'flow' },
          { label: t('artboard.verifyBar.board'), value: 'board' },
        ]}
        onChange={(value) => artboardActions.setVerifyView(value as VerifyView)}
      />
      {filled ? (
        verifyView === 'board' && (
          <Segmented
            size={'small'}
            value={showReal ? 'real' : 'reference'}
            options={[
              { label: t('artboard.verifyBar.reference'), value: 'reference' },
              { label: t('artboard.verifyBar.real'), value: 'real' },
            ]}
            onChange={(value) => artboardActions.setShowReal(value === 'real')}
          />
        )
      ) : (
        <Button
          icon={WandSparklesIcon}
          loading={typing}
          size={'small'}
          onClick={artboardActions.fillResults}
        >
          {t('artboard.verifyBar.simulate')}
        </Button>
      )}
    </Flexbox>
  );
};

export const GeneratingBar = () => {
  const { t } = useTranslation('project');
  return (
    <Flexbox
      horizontal
      align="center"
      gap={8}
      paddingInline={8}
      {...stylex.props(floatStyles.float, styles.center)}
    >
      <Icon spin icon={SparklesIcon} size={14} />
      <Text style={{ fontSize: 12 }}>{t('artboard.generating')}</Text>
    </Flexbox>
  );
};

const PREVIEW_STATES: BoardPreviewState[] = ['normal', 'generating', 'empty', 'error'];

export const PreviewStateBar = () => {
  const { t } = useTranslation('project');
  const previewState = useArtboardStore((s) => s.previewState);
  return (
    <div {...stylex.props(floatStyles.float, styles.preview)}>
      <Segmented
        size={'small'}
        value={previewState}
        options={PREVIEW_STATES.map((value) => ({
          label: t(`artboard.preview.${value}`),
          value,
        }))}
        onChange={(value) => artboardActions.setPreviewState(value as BoardPreviewState)}
      />
    </div>
  );
};
