import { apiClient } from './client';
import { AssetNode, FlattenedAsset } from '../types/asset';

export async function getAssetTree(): Promise<AssetNode[]> {
  return (await apiClient.get('/core/assets/tree')) as unknown as AssetNode[];
}

export function getLevelName(levelId: number): string {
  switch (levelId) {
    case 50:
      return 'Company';
    case 40:
      return 'Plant';
    case 30:
      return 'Shop';
    case 20:
      return 'Line';
    case 10:
      return 'Machine';
    default:
      return `Level ${levelId}`;
  }
}

/**
 * Helper to flatten the nested asset tree into selectable items with path and level info.
 */
export function flattenAssetTree(
  nodes: AssetNode[],
  parentPath = '',
  parentId: string | null = null
): FlattenedAsset[] {
  const result: FlattenedAsset[] = [];

  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
    result.push({
      id: node.id,
      name: node.name,
      codename: node.codename,
      assetlevel_id: node.assetlevel_id,
      levelName: getLevelName(node.assetlevel_id),
      path: currentPath,
      parentId,
    });

    if (node.children && node.children.length > 0) {
      result.push(...flattenAssetTree(node.children, currentPath, node.id));
    }
  }

  return result;
}
