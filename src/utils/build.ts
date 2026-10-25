import { BuildService } from '../core/vitrinCore.js';

export {
  BuildService,
  THEME_ZIP_EXCLUDES,
  PackageTooLargeError,
  assertPackageSize,
  type AssetBuildProgress,
  type AssetBuildResult,
} from '../core/vitrinCore.js';

export default BuildService.getInstance();
