/**
 * Asset management and appreciation functions
 */

import { Asset } from './types';

/**
 * Apply annual appreciation to all assets
 * Returns new array with cloned assets to avoid reference issues
 */
export function appreciateAssets(assets: Asset[]): Asset[] {
  return assets.map((asset) => ({
    ...asset,
    currentValue: asset.currentValue * (1 + asset.appreciationRate / 100),
  }));
}

/**
 * Find asset by ID
 */
export function findAssetById(
  assets: Asset[],
  assetId: string
): Asset | undefined {
  return assets.find((a) => a.id === assetId);
}

/**
 * Calculate total value of all assets
 */
export function calculateTotalAssetsValue(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + a.currentValue, 0);
}
