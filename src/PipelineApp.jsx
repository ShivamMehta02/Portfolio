import React, { useState } from 'react';
import { 
  Play, RefreshCw, Cpu, Database, Network, ShieldCheck, 
  Terminal, Layers, Sliders, CheckCircle2, ArrowRight, Sparkles, 
  ChevronRight, ChevronDown, Compass, Home, BookOpen, User, ExternalLink, Info
} from 'lucide-react';

const PIPELINE_TREE = [
  {
    id: 'stage-ingest',
    stageNumber: '01',
    name: 'Ingestion & Query Intelligence',
    subtitle: 'Entry point of incoming request',
    summary: 'Sanitizes the natural language input, verifies tokens, and classifies intent before passing down the tree.',
    icon: Terminal,
    color: 'from-sky-500/20 to-sky-500/5 text-sky-400 border-sky-500/30',
    nodes: [
      {
        id: 'user-input',
        title: 'User Input Sanitizer',
        type: 'NLP Guard',
        latency: '3ms',
        desc: 'Strips unsafe characters, normalizes whitespace, rejects prompt injection patterns.',
        details: 'Enforces 512 max token boundary to prevent silent vector truncation in downstream transformer models.'
      },
      {
        id: 'query-classifier',
        title: 'Intent & Routing Classifier',
        type: 'Router',
        latency: '6ms',
        desc: 'Distinguishes between factual retrieval, multi-hop reasoning, and direct FAQ routing.',
        details: 'Decides whether to trigger full hybrid search or return pre-cached grounded responses.'
      }
    ]
  },
  {
    id: 'stage-retrieval',
    stageNumber: '02',
    name: 'Dual Retrieval Branch (Hybrid Search)',
    subtitle: 'Parallel dense vector + sparse keyword retrieval',
    summary: 'Splits execution into two branches to maximize both semantic understanding and exact keyword precision.',
    icon: Network,
    color: 'from-indigo-500/20 to-indigo-500/5 text-indigo-400 border-indigo-500/30',
    isBranch: true,
    branches: [
      {
        branchName: 'Branch A: Semantic Dense Vector Search',
        nodes: [
          {
            id: 'dense-embed',
            title: 'Dense Embedding Generator',
            type: 'Transformer',
            latency: '42ms',
            desc: 'Embeds query with text-embedding-004 into 768-dimensional space.',
            details: 'Captures contextual meaning and synonyms that keyword searches miss.'
          },
          {
            id: 'vector-db',
            title: 'Qdrant HNSW Vector Index',
            type: 'ANN Search',
            latency: '24ms',
            desc: 'Performs Approximate Nearest Neighbor search across 500k+ embedded chunks.',
            details: 'Returns top 50 semantically relevant candidate passages with cosine distance score.'
          }
        ]
      },
      {
        branchName: 'Branch B: Exact Sparse Keyword Search',
        nodes: [
          {
            id: 'bm25-search',
            title: 'BM25 Inverted Lexical Index',
            type: 'Sparse Index',
            latency: '15ms',
            desc: 'Scores exact keyword matches, domain codes, identifiers, and acronyms.',
            details: 'Guarantees that rare terms and exact technical identifiers are never lost.'
          }
        ]
      }
    ]
  },
  {
    id: 'stage-fusion',
    stageNumber: '03',
    name: 'Ranking & Context Optimization',
    subtitle: 'Merging and re-scoring candidate passages',
    summary: 'Combines the outputs of both retrieval branches into an optimal, non-redundant context window.',
    icon: Sliders,
    color: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30',
    nodes: [
      {
        id: 'rrf-fusion',
        title: 'Reciprocal Rank Fusion (RRF)',
        type: 'Rank Merge',
        latency: '8ms',
        desc: 'Blends rank positions with formula: Score = Σ 1 / (60 + rank).',
        details: 'Eliminates score scale mismatch between vector cosine similarity and BM25 scores.'
      },
      {
        id: 'cross-encoder',
        title: 'Cross-Encoder Re-Ranker',
        type: 'Full-Attention',
        latency: '78ms',
        desc: 'Re-scores query-passage pairs jointly using deep cross-attention.',
        details: 'Filters 50 candidates down to top 5 verified high-relevance chunks.'
      }
    ]
  },
  {
    id: 'stage-generation',
    stageNumber: '04',
    name: 'Validation & LLM Generation',
    subtitle: 'Guarded response synthesis',
    summary: 'Asserts schema compliance, checks hallucination score, and generates the final grounded answer.',
    icon: Sparkles,
    color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30',
    nodes: [
      {
        id: 'schema-guard',
        title: 'Schema & Hallucination Guard',
        type: 'Validator',
        latency: '12ms',
        desc: 'Checks citations against retrieved facts and enforces structured JSON output schema.',
        details: 'Halts generation or flags warnings if an ungrounded claim is detected.'
      },
      {
        id: 'llm-synthesis',
        title: 'Gemini 2.0 Flash Generation',
        type: 'LLM Synthesis',
        latency: '115ms',
        desc: 'Generates final concise, highly technical answer with citations.',
        details: 'Delivered via async streaming or typed JSON response to client.'
      }
    ]
  }
];

export default function PipelineApp() {
  const [selectedNode, setSelectedNode] = useState(PIPELINE_TREE[0].nodes[0]);
  const [activeStepId, setActiveStepId] = useState(null);
  const [queryInput, setQueryInput] = useState('How does Reciprocal Rank Fusion balance dense vs sparse retrieval?');
  const [isRunning, setIsRunning] = useState(false);
  const [executionOutput, setExecutionOutput] = useState(null);
  const [expandedStages, setExpandedStages] = useState({
    'stage-ingest': true,
    'stage-retrieval': true,
    'stage-fusion': true,
    'stage-generation': true
  });

  const toggleStage = (stageId) => {
    setExpandedStages(prev => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const runPipeline = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setExecutionOutput(null);

    // Collect all step IDs in workflow sequence
    const allStepIds = [
      'user-input', 'query-classifier',
      'dense-embed', 'vector-db', 'bm25-search',
      'rrf-fusion', 'cross-encoder',
      'schema-guard', 'llm-synthesis'
    ];

    for (const stepId of allStepIds) {
      setActiveStepId(stepId);
      await new Promise(r => setTimeout(r, 260));
    }

    try {
      const res = await fetch('/api/execute-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId: 'tree-rag-v2',
          inputQuery: queryInput
        })
      });
      const data = await res.json();
      setExecutionOutput(data);
    } catch (err) {
      setExecutionOutput({
        totalLatencyMs: 288,
        result: {
          answer: 'Pipeline executed in local demonstration mode. Reciprocal Rank Fusion successfully merged BM25 lexical candidates with Qdrant dense vector matches.',
          retrievalMetrics: {
            denseVectorScore: 0.941,
            sparseRank: 1,
            rrfScore: 0.032,
            rerankConfidence: 0.965
          }
        }
      });
    } finally {
      setIsRunning(false);
      setActiveStepId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-[#f1f5f9] font-sans flex flex-col selection:bg-cyan-400 selection:text-black antialiased">
      
      {/* Minimal Universal Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-[#0c0f17]/90 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <a href="/index.html" className="flex items-center gap-2.5 text-slate-400 hover:text-white transition-colors group">
            <img 
              src="/profile.jpg" 
              alt="Shivam Mehta" 
              className="w-8 h-8 rounded-full object-cover ring-2 ring-cyan-500/30 group-hover:ring-cyan-400 transition-all" 
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">Shivam Mehta</span>
              <span className="text-[10px] text-slate-400">AI Systems Engineer</span>
            </div>
          </a>

          <div className="hidden md:flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg p-1 text-xs">
            <a href="/index.html" className="px-3 py-1 text-slate-400 hover:text-white rounded-md transition-colors flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5" /> Overview
            </a>
            <span className="px-3 py-1 bg-slate-800 text-cyan-400 font-medium rounded-md shadow-sm flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" /> Interactive Pipeline Tree
            </span>
            <a href="/rag-explorer.html" className="px-3 py-1 text-slate-400 hover:text-white rounded-md transition-colors flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Deep RAG Breakdown
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={runPipeline}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-md ${
              isRunning 
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold active:scale-95 shadow-cyan-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Simulating Workflow...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                Run Pipeline Workflow
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Studio Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Side: Pipeline Workflow Tree */}
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
          
          {/* Query Formulation Box */}
          <div className="mb-8 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" /> Pipeline Input
              </span>
              <span className="text-xs text-slate-400">Click Run to trigger active tree propagation</span>
            </div>
            <div className="flex gap-2.5">
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Enter query to trace across the pipeline tree..."
                className="flex-1 bg-slate-950/80 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <button 
                onClick={runPipeline}
                disabled={isRunning}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 rounded-xl border border-slate-700 transition-all"
              >
                Execute
              </button>
            </div>
          </div>

          {/* Workflow Tree Visualizer */}
          <div className="space-y-6 relative">
            {/* Tree Branch Vertical Spine */}
            <div className="absolute left-6 top-8 bottom-8 w-[2px] bg-slate-800/80 hidden md:block" />

            {PIPELINE_TREE.map((stage, sIdx) => {
              const StageIcon = stage.icon;
              const isExpanded = expandedStages[stage.id];

              return (
                <div key={stage.id} className="relative md:pl-14">
                  
                  {/* Stage Node Icon Anchor */}
                  <div className="hidden md:flex absolute left-3 top-4 -translate-x-1/2 w-7 h-7 rounded-full bg-slate-900 border-2 border-slate-700 items-center justify-center text-[11px] font-mono text-cyan-400 z-10 shadow-sm">
                    {stage.stageNumber}
                  </div>

                  {/* Stage Header Card */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden transition-all shadow-sm">
                    <div 
                      onClick={() => toggleStage(stage.id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl border bg-gradient-to-br ${stage.color}`}>
                          <StageIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-100">{stage.name}</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                              Stage {stage.stageNumber}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{stage.subtitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-slate-400">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* Stage Internal Nodes Tree */}
                    {isExpanded && (
                      <div className="p-4 pt-1 border-t border-slate-800/50 bg-slate-950/30 space-y-4">
                        <p className="text-xs text-slate-400 leading-relaxed px-1">
                          {stage.summary}
                        </p>

                        {/* Branching vs Linear Display */}
                        {stage.isBranch ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            {stage.branches.map((b, bIdx) => (
                              <div key={bIdx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 space-y-3">
                                <span className="text-[11px] font-mono text-cyan-400 font-semibold block uppercase tracking-wider">
                                  {b.branchName}
                                </span>
                                <div className="space-y-2.5">
                                  {b.nodes.map(node => (
                                    <NodeCard 
                                      key={node.id} 
                                      node={node} 
                                      isSelected={selectedNode?.id === node.id}
                                      isExecuting={activeStepId === node.id}
                                      onSelect={() => setSelectedNode(node)} 
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            {stage.nodes.map(node => (
                              <NodeCard 
                                key={node.id} 
                                node={node} 
                                isSelected={selectedNode?.id === node.id}
                                isExecuting={activeStepId === node.id}
                                onSelect={() => setSelectedNode(node)} 
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* Right Side: Interactive Node Inspector & Output */}
        <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#0c0f17]/95 p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            
            {/* Header Inspector */}
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                Component Inspector
              </span>
              <h4 className="text-base font-bold text-white mt-1">{selectedNode?.title}</h4>
              <span className="inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 mt-1.5">
                {selectedNode?.type} · Latency: ~{selectedNode?.latency}
              </span>
              <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                {selectedNode?.desc}
              </p>
            </div>

            {/* Engineering Trade-off & Why this matters */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-2">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" /> Under the Hood
              </span>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                {selectedNode?.details}
              </p>
            </div>

            {/* Live Execution Output Box */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">Execution Telemetry</span>
                {executionOutput && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                    {executionOutput.totalLatencyMs}ms Total
                  </span>
                )}
              </div>

              {executionOutput ? (
                <div className="space-y-3 pt-1">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed">
                    {executionOutput.result?.answer}
                  </div>
                  {executionOutput.result?.retrievalMetrics && (
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2 bg-slate-950/60 rounded border border-slate-800/60">
                        <span className="text-slate-400 block">Dense Sim</span>
                        <span className="text-cyan-400 font-bold">{executionOutput.result.retrievalMetrics.denseVectorScore}</span>
                      </div>
                      <div className="p-2 bg-slate-950/60 rounded border border-slate-800/60">
                        <span className="text-slate-400 block">Rerank Conf.</span>
                        <span className="text-emerald-400 font-bold">{executionOutput.result.retrievalMetrics.rerankConfidence}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">
                  Press <strong>Run Pipeline Workflow</strong> to execute the full tree pipeline.
                </p>
              )}
            </div>

          </div>

          {/* Quick Footer Links */}
          <div className="pt-6 border-t border-slate-800/80 mt-6 flex items-center justify-between text-xs text-slate-400">
            <a href="/index.html" className="hover:text-cyan-400 transition-colors">
              ← Main Portfolio
            </a>
            <a href="https://github.com/ShivamMehta02" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              ShivamMehta02
            </a>
          </div>

        </aside>

      </div>

    </div>
  );
}

function NodeCard({ node, isSelected, isExecuting, onSelect }) {
  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
        isExecuting
          ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.25)] scale-[1.02]'
          : isSelected
          ? 'border-cyan-500/70 bg-slate-900 shadow-sm'
          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
      }`}
    >
      {isExecuting && (
        <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-400 text-slate-950 uppercase tracking-wider">
          Active Trace
        </span>
      )}
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold text-slate-100">{node.title}</h5>
        <span className="text-[10px] font-mono text-cyan-400 bg-slate-800 px-1.5 py-0.5 rounded">
          {node.latency}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
        {node.desc}
      </p>
    </div>
  );
}
