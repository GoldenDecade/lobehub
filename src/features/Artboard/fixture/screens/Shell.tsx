import { Text } from '@lobehub/ui';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

import { screenStyles } from './styles';

interface ShellProps {
  children: ReactNode;
  title?: string;
}

const Shell = ({ children, title = 'LobeHub Docs' }: ShellProps) => (
  <div {...stylex.props(screenStyles.screen)}>
    <div {...stylex.props(screenStyles.topbar)}>
      <div {...stylex.props(screenStyles.dot)} />
      {title}
      <Text style={{ fontSize: 12, marginInlineStart: 'auto' }} type="secondary">
        项目首页
      </Text>
    </div>
    <div {...stylex.props(screenStyles.body)}>{children}</div>
  </div>
);

export default Shell;
