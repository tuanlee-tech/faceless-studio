const fs = require('fs');
const code = fs.readFileSync('apps/web/src/components/TTSGenerator.tsx', 'utf-8');

const target = `<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor Area */}
        <div className="space-y-4">
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            className="w-full h-[200px] bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 placeholder-slate-700 focus:outline-none focus:border-brand-500/50 leading-relaxed resize-none"
            placeholder="Nhập nội dung lời thoại..."
          />
          
          <div className="flex flex-wrap gap-2 -mt-2">
            <span className="text-[11px] text-slate-500 py-1">Chèn nhanh:</span>
            {activeTags.map(({tag, desc}) => (
              <button
                key={tag}
                type="button"
                title={desc}
                onClick={() => setTtsText(prev => prev + " " + tag)}
                className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-brand-500/20 hover:text-brand-300 text-slate-300 rounded border border-slate-700 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Preview Area */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl h-[200px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-slate-500" />
                  Nghe thử giọng (Preview)
                </h4>
              </div>
              <textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                maxLength={100}
                className="w-full h-16 bg-transparent border-none p-0 text-sm text-slate-400 focus:outline-none focus:ring-0 resize-none"
                placeholder="Nhập câu ngắn (dưới 100 ký tự) để nghe thử..."
              />
            </div>
            
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={handlePreviewTts}
                disabled={isPreviewing || previewText.length === 0 || previewText.length > 100}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Nghe thử</span>}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs text-slate-500 py-1">Chèn cảm xúc:</span>
              {activeTags.map(({tag, desc}) => (
                <button
                  key={tag}
                  type="button"
                  title={desc}
                  onClick={() => setPreviewText(prev => (prev + " " + tag).substring(0, 100))}
                  className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-brand-500/20 hover:text-brand-300 text-slate-300 rounded border border-slate-700 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800/50">
              <span className="text-xs text-slate-500">{previewText.length}/100</span>
              {previewAudioUrl && (
                <audio controls src={previewAudioUrl} className="h-8 outline-none" autoPlay />
              )}
            </div>
          </div>
        </div>
      </div>`;

const replacement = `<div className={\`grid grid-cols-1 \${showPreview ? "lg:grid-cols-2" : ""} gap-4\`}>
        {/* Editor Area */}
        <div className="space-y-4">
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            className="w-full h-[200px] bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 placeholder-slate-700 focus:outline-none focus:border-brand-500/50 leading-relaxed resize-none"
            placeholder="Nhập nội dung lời thoại..."
          />
          
          <div className="flex flex-wrap items-center justify-between gap-2 -mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-500 py-1">Chèn nhanh:</span>
              {activeTags.map(({tag, desc}) => (
                <button
                  key={tag}
                  type="button"
                  title={desc}
                  onClick={() => setTtsText(prev => prev + " " + tag)}
                  className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-brand-500/20 hover:text-brand-300 text-slate-300 rounded border border-slate-700 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-brand-400 bg-brand-900/20 hover:bg-brand-900/40 rounded-lg transition-colors border border-brand-800/30"
            >
              <Volume2 className="w-3.5 h-3.5" />
              {showPreview ? "Ẩn Nghe thử" : "Mở Nghe thử (Preview)"}
              {showPreview ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Preview Area */}
        {showPreview && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl h-[200px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-slate-500" />
                    Nghe thử giọng (Preview)
                  </h4>
                </div>
                <textarea
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  maxLength={100}
                  className="w-full h-16 bg-transparent border-none p-0 text-sm text-slate-400 focus:outline-none focus:ring-0 resize-none"
                  placeholder="Nhập câu ngắn (dưới 100 ký tự) để nghe thử..."
                />
              </div>
              
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={handlePreviewTts}
                  disabled={isPreviewing || previewText.length === 0 || previewText.length > 100}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Nghe thử</span>}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs text-slate-500 py-1">Chèn cảm xúc:</span>
                {activeTags.map(({tag, desc}) => (
                  <button
                    key={tag}
                    type="button"
                    title={desc}
                    onClick={() => setPreviewText(prev => (prev + " " + tag).substring(0, 100))}
                    className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-brand-500/20 hover:text-brand-300 text-slate-300 rounded border border-slate-700 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800/50">
                <span className="text-xs text-slate-500">{previewText.length}/100</span>
                {previewAudioUrl && (
                  <audio controls src={previewAudioUrl} className="h-8 outline-none" autoPlay />
                )}
              </div>
            </div>
          </div>
        )}
      </div>`;

if (!code.includes(target)) {
  console.error("Target not found!");
  process.exit(1);
}
fs.writeFileSync('apps/web/src/components/TTSGenerator.tsx', code.replace(target, replacement));
console.log("Patched TTSGenerator.tsx");
