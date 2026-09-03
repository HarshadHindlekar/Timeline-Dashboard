export interface AssetNode {
  id: string;
  name: string;
  codename: string | null;
  assetlevel_id: number;
  hierarchy: string | null;
  children: AssetNode[];
}

export interface FlattenedAsset {
  id: string;
  name: string;
  codename: string | null;
  assetlevel_id: number;
  levelName?: string;
  path: string;
  parentId?: string | null;
}

export interface AssetLevelOption {
  id: number | 'all';
  label: string;
}

