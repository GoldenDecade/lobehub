import type { ComponentType } from 'react';

import type { ScreenKey, ScreenProps } from '../../types';
import { ScreenDone, ScreenEmpty, ScreenFailed, ScreenReading, ScreenSources } from './Journey';
import { OptionCards, OptionChat, OptionWizard, RefCurrent, RefSketch } from './Options';

export const SCREENS: Record<ScreenKey, ComponentType<ScreenProps>> = {
  OptionCards,
  OptionChat,
  OptionWizard,
  RefCurrent,
  RefSketch,
  ScreenDone,
  ScreenEmpty,
  ScreenFailed,
  ScreenReading,
  ScreenSources,
};
