/**
 * @faceless/media — Asset Provider interface
 *
 * Interface cho các provider sinh asset (ảnh/video).
 * Implementation thực tế sẽ gọi API AI (Midjourney, Runway, v.v.) hoặc local model.
 */

import type { AssetProvider, AssetRequest, AssetResult } from "@faceless/core";

/**
 * Base class cho AssetProvider.
 * Provider thực tế extend class này và implement method request().
 */
export abstract class BaseAssetProvider implements AssetProvider {
  abstract name: string;
  abstract kinds: Array<"image" | "video">;

  abstract request(req: AssetRequest): Promise<AssetResult | { status: "needs-manual"; packPath: string }>;
}

/**
 * Mock asset provider cho testing.
 * Trả về kết quả giả lập.
 */
export class MockAssetProvider extends BaseAssetProvider {
  name = "mock";
  kinds: Array<"image" | "video"> = ["image", "video"];

  async request(req: AssetRequest): Promise<AssetResult | { status: "needs-manual"; packPath: string }> {
    // Trả về mock asset
    return {
      status: "ok",
      assetId: req.id,
      filePath: `assets/incoming/mock-${req.id}.png`,
      license: "CC0",
    };
  }
}