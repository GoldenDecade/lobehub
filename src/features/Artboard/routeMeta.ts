import { PresentationIcon } from 'lucide-react';

import { createSurfaceSkeleton } from '@/components/Skeleton/Surface';
import { routeMeta } from '@/spa/router/routeMeta';

export const artboardRouteMeta = routeMeta({
  icon: PresentationIcon,
  Skeleton: createSurfaceSkeleton('detail'),
  titleKey: 'project:artboard.title',
});
