import { apiClient } from './client';
import { AssetNode, FlattenedAsset } from '../types/asset';

export async function getAssetTree(): Promise<AssetNode[]> {
  return (await apiClient.get('/core/assets/tree')) as unknown as AssetNode[];
}

/**
 * Helper to flatten the nested asset tree into selectable items with path.
 */
export function flattenAssetTree(nodes: AssetNode[], parentPath = ''): FlattenedAsset[] {
  const result: FlattenedAsset[] = [];

  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
    result.push({
      id: node.id,
      name: node.name,
      codename: node.codename,
      assetlevel_id: node.assetlevel_id,
      path: currentPath,
    });

    if (node.children && node.children.length > 0) {
      result.push(...flattenAssetTree(node.children, currentPath));
    }
  }

  return result;
}
