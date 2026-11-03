'use client';

import { Navigate, Outlet } from 'react-router';

import { useArtboardFeature } from './useArtboardFeature';

export const ArtboardRouteGate = () => {
  const { enabled, ready } = useArtboardFeature();
  if (!ready) return null;
  if (!enabled) return <Navigate replace to={'..'} />;
  return <Outlet />;
};

export default ArtboardRouteGate;
