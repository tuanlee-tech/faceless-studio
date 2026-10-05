import { describe, it, expect } from "vitest";
import { MockTtsEngine } from "../tts-client.js";
import { MockAligner } from "../align-client.js";
import { MockAssetProvider } from "../asset-provider.js";

describe("MockTtsEngine", () => {
  it("yields results for each job", async () => {
    const engine = new MockTtsEngine();
    const results: any[] = [];
    for await (const r of engine.synthesizeBatch([
      { id: "j1", text: "Xin chào", voice: "default" },
      { id: "j2", text: "thế giới", voice: "default" },
    ])) {
      results.push(r);
    }
    expect(results).toHaveLength(2);
    expect(results[0].jobId).toBe("j1");
    expect(results[0].durationSec).toBeGreaterThan(0);
  });
});

describe("MockAligner", () => {
  it("produces words with sequential IDs", async () => {
    const aligner = new MockAligner();
    const words = await aligner.align("fake.wav", "Xin chào thế giới", "vi");
    expect(words).toHaveLength(4);
    expect(words[0].id).toBe("w001");
    expect(words[3].id).toBe("w004");
    expect(words[0].startSec).toBe(0);
  });
});

describe("MockAssetProvider", () => {
  it("returns mock asset result", async () => {
    const provider = new MockAssetProvider();
    const result = await provider.request({
      id: "test-asset",
      kind: "image",
      prompt: "test prompt",
      width: 1920,
      height: 1080,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.assetId).toBe("test-asset");
      expect(result.license).toBe("CC0");
    }
  });
});