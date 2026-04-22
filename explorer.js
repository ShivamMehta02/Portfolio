/**
 * RAG Pipeline Explorer
 * Architecture: Data Layer → Component Renderers → State Manager → Event Handler
 * Modular, scalable — new nodes/pipelines can be added via pipelineData only.
 */

// ============================================================
// DATA LAYER — All node content lives here.
// To add a new node: push a new object to pipelineData.
// ============================================================

const pipelineData = [
  {
    id: "user-query",
    icon: "💬",
    name: "User Query",
    shortDesc: "Input processing & intent capture",
    tags: ["Input Layer", "NLP"],
    subtitle: "The entry point of the RAG system. Every downstream decision depends on how well we process and understand the incoming query.",
    subflow: [
      { title: "Raw Input Received", detail: "User submits a natural language query via the API endpoint (POST /query)." },
      { title: "Input Sanitization", detail: "Strip HTML, normalize whitespace, handle encoding edge cases. Reject empty or oversized inputs early." },
      { title: "Query Classification (Optional)", detail: "Classify intent: factual lookup, summarization, comparison. Routes to different retrieval strategies." },
      { title: "Query Expansion (Optional)", detail: "Generate query variants or keywords to improve sparse retrieval coverage." },
      { title: "Pass to Embedding Layer", detail: "Cleaned query forwarded to embedding generation for dense vector creation." }
    ],
    what: "The system receives a raw user query and prepares it for retrieval. This includes sanitization, optional intent classification, and forwarding to the embedding layer. The query is the seed — if it's mishandled here, every downstream component compensates for a bad start.",
    why: "Garbage in, garbage out. A query with encoding errors or ambiguous intent will produce poor embeddings, which produce poor retrieval, which produces a hallucinated or irrelevant LLM response. Input quality is the most underrated variable in RAG quality.",
    decisions: [
      "<strong>Async FastAPI endpoint</strong> — handles concurrent queries without blocking. Each request is stateless.",
      "<strong>Max token limit on input</strong> — prevents embedding models from truncating critical information silently.",
      "<strong>Query expansion via LLM</strong> — optional but effective for ambiguous or short queries. Adds ~80ms latency.",
      "<strong>Intent routing</strong> — factual vs. analytical queries can be sent to different retrieval paths."
    ],
    tradeoffs: [
      { type: "positive", label: "With Query Expansion", text: "Higher recall — more query variants hit more relevant documents. Better for short or vague inputs." },
      { type: "negative", label: "Cost of Expansion", text: "Adds 1 extra LLM call per query → ~80–120ms additional latency. Not worth it for specific, well-formed queries." },
      { type: "positive", label: "Intent Classification", text: "Routes queries to specialized retrieval strategies — better precision for known query types." },
      { type: "negative", label: "Classification Overhead", text: "Adds complexity. If classifier fails, query lands in wrong retrieval path — silent quality degradation." }
    ],
    failures: [
      { title: "Oversized input silently truncated", detail: "If the embedding model's max tokens is exceeded without a guard, the end of the query is silently dropped. Fix: enforce max length at input layer." },
      { title: "Special characters corrupt embeddings", detail: "Non-ASCII or malformed Unicode can shift the embedding vector unexpectedly. Fix: normalize inputs before embedding." },
      { title: "Ambiguous short queries", detail: "'What is the policy?' — for what? Short queries without context produce broad, noisy retrieval. Fix: query expansion or session context injection." }
    ],
    metrics: [
      { val: "<5ms", label: "Avg processing time" },
      { val: "512", label: "Max token limit" },
      { val: "POST /query", label: "API endpoint" }
    ]
  },
  {
    id: "embedding",
    icon: "🔢",
    name: "Embedding Generation",
    shortDesc: "Query → dense vector representation",
    tags: ["Semantic Layer", "Transformer", "Dense Vectors"],
    subtitle: "Converts the user query into a high-dimensional dense vector that captures semantic meaning — the foundation of semantic search.",
    subflow: [
      { title: "Tokenization", detail: "Query tokenized using the embedding model's vocabulary (e.g., WordPiece for BERT-based models)." },
      { title: "Transformer Encoding", detail: "Tokens passed through encoder layers. Attention mechanisms capture contextual relationships between words." },
      { title: "Pooling Strategy Applied", detail: "CLS token pooling or mean pooling applied to produce a single fixed-size vector from token embeddings." },
      { title: "L2 Normalization", detail: "Vector normalized to unit length. Enables cosine similarity to be computed as a dot product — faster at scale." },
      { title: "Vector Ready for Retrieval", detail: "Final vector (e.g., 768d or 1536d) passed to the hybrid retrieval layer." }
    ],
    what: "The query string is encoded into a dense vector using a pre-trained sentence transformer or OpenAI embedding model. This vector captures the semantic meaning of the query, not just its keywords. Two queries that mean the same thing but use different words will produce similar vectors.",
    why: "Pure keyword search (BM25) fails when users paraphrase. Dense embeddings enable semantic matching — 'What is the refund timeline?' and 'How long does it take to get my money back?' will retrieve the same relevant documents.",
    decisions: [
      "<strong>Model choice: sentence-transformers/all-MiniLM-L6-v2</strong> — 384d, fast (6x smaller than large models), good quality for English. Used for local/low-latency setups.",
      "<strong>OpenAI text-embedding-ada-002</strong> — 1536d, higher quality, best for critical production use. Tradeoff: API call cost + latency.",
      "<strong>L2 normalization</strong> — mandatory for cosine similarity via dot product. Without it, vector magnitudes corrupt similarity scores.",
      "<strong>Batch embedding at index time</strong> — documents embedded in batches of 32-64. Query embedded individually at query time."
    ],
    tradeoffs: [
      { type: "positive", label: "Large model (1536d)", text: "Higher semantic fidelity. Better cross-lingual support. Best for complex domain-specific content." },
      { type: "negative", label: "Large model cost", text: "~$0.0001/1K tokens (OpenAI). For 10M queries/month → $1000+. Local models avoid this entirely." },
      { type: "positive", label: "Small model (384d)", text: "~6x faster. Runs locally. Zero API cost. Sufficient for most English-language RAG systems." },
      { type: "negative", label: "Small model limits", text: "Lower accuracy on highly technical or multilingual content. May miss subtle semantic distinctions." }
    ],
    failures: [
      { title: "Domain mismatch", detail: "General-purpose embeddings fail on specialized domains (legal, medical, code). A query about 'pleadings' in legal context gets confused with 'begging'. Fix: fine-tune embeddings on domain data." },
      { title: "Embedding model version change", detail: "Switching models without re-indexing all documents creates a vector space mismatch. Query vector and document vectors become incomparable. Fix: always re-index after model changes." },
      { title: "Long query truncation", detail: "Most embedding models cap at 512 tokens. Long queries are silently truncated, losing critical context. Fix: enforce max query length upstream or use chunk-and-pool strategy." }
    ],
    metrics: [
      { val: "384d", label: "MiniLM vector size" },
      { val: "1536d", label: "OpenAI ada-002 size" },
      { val: "~15ms", label: "Local embedding latency" }
    ]
  },
  {
    id: "hybrid-retrieval",
    icon: "🔍",
    name: "Hybrid Retrieval",
    shortDesc: "BM25 (sparse) + Vector Search (dense)",
    tags: ["BM25", "Vector Search", "Qdrant", "FAISS", "RRF Fusion"],
    subtitle: "The most critical component of the RAG pipeline. Runs sparse and dense retrieval in parallel and fuses results using Reciprocal Rank Fusion.",
    subflow: [
      { title: "Parallel Retrieval Triggered", detail: "Both BM25 and dense vector search execute simultaneously (async) against their respective indexes." },
      { title: "BM25 Sparse Search", detail: "Query terms matched against inverted index. TF-IDF scoring rewards rare, specific terms. Returns top-N documents with keyword scores." },
      { title: "Dense Vector Search", detail: "Query vector compared against all document vectors in Qdrant/FAISS using ANN (Approximate Nearest Neighbor). Returns top-N by cosine similarity." },
      { title: "Result Deduplication", detail: "Documents appearing in both result sets are identified. Duplicate references unified before fusion." },
      { title: "Reciprocal Rank Fusion (RRF)", detail: "Combined score = 1/(k+rank_bm25) + 1/(k+rank_dense), k=60. Documents ranked high in both lists score highest." },
      { title: "Unified Candidate Set", detail: "Top-20 documents from fused ranking passed to the re-ranking stage." }
    ],
    what: "Hybrid retrieval runs two fundamentally different search strategies in parallel: BM25 catches exact keyword matches (critical for codes, IDs, technical terms) while dense vector search captures semantic similarity. RRF combines both rankings without needing score normalization.",
    why: "Neither approach alone is sufficient. BM25 fails on paraphrased queries. Dense search fails on exact-match queries like 'Invoice #INV-20231104'. Hybrid search consistently outperforms either method alone, typically by 8-15% on recall@10.",
    decisions: [
      "<strong>Qdrant for production</strong> — supports filtering, payload storage, and HNSW indexing. Can run as a persistent service.",
      "<strong>FAISS for development</strong> — in-memory, fast to iterate. No persistence by default. Used for local testing.",
      "<strong>RRF over score normalization</strong> — BM25 and cosine scores are in incompatible ranges. RRF uses only ranks, making it score-agnostic and robust.",
      "<strong>Async parallel execution</strong> — BM25 and dense search run concurrently. Total latency = max(BM25, dense), not BM25 + dense.",
      "<strong>Top-20 candidates to re-ranker</strong> — not top-5. Re-ranker is more accurate at re-ordering a larger candidate set."
    ],
    tradeoffs: [
      { type: "positive", label: "Hybrid vs Dense only", text: "Recall improves significantly on keyword-heavy queries. 'Policy ID: A-2024-01' is retrieved correctly." },
      { type: "negative", label: "Index complexity", text: "Maintaining two indexes (BM25 + vector) doubles index update complexity and storage overhead." },
      { type: "positive", label: "RRF fusion", text: "Score-agnostic. Works without normalizing BM25 and cosine scores, which are inherently incomparable." },
      { type: "negative", label: "Async overhead", text: "Parallel execution needs proper async handling. Bugs here cause race conditions or partial result sets." }
    ],
    failures: [
      { title: "Index staleness", detail: "Document added to vector index but not BM25 index (or vice versa). Creates invisible retrieval gaps. Fix: atomic index updates — both indexes update in the same transaction." },
      { title: "HNSW parameter misconfiguration", detail: "Low ef_construction → faster indexing but poor recall. High ef_search → better recall but slower queries. Fix: benchmark recall@10 vs latency for your dataset size." },
      { title: "BM25 index not pre-loaded", detail: "If BM25 index is rebuilt per-request, latency explodes to seconds. Fix: load BM25 index into memory at server startup." }
    ],
    metrics: [
      { val: "~60ms", label: "Hybrid retrieval latency" },
      { val: "Top-20", label: "Candidates to re-ranker" },
      { val: "RRF k=60", label: "Fusion parameter" }
    ]
  },
  {
    id: "top-k",
    icon: "🎯",
    name: "Top-K Filtering",
    shortDesc: "Candidate selection before re-ranking",
    tags: ["Filtering", "Candidate Selection", "Threshold"],
    subtitle: "Selects the most promising candidates from hybrid retrieval before sending to the expensive re-ranking step.",
    subflow: [
      { title: "Receive Fused Candidates", detail: "Top-N candidates received from RRF fusion — typically top-20 to top-30." },
      { title: "Score Threshold Check (Optional)", detail: "Filter out candidates below a minimum relevance score. Prevents garbage from reaching the re-ranker." },
      { title: "Metadata Filtering", detail: "Apply hard filters: date range, document type, access permissions. Qdrant supports payload-based pre-filtering." },
      { title: "K Selection", detail: "Select top-K candidates (typically K=20) to pass to re-ranking. K is a tunable hyperparameter." }
    ],
    what: "Not all hybrid retrieval results are worth re-ranking. Top-K filtering removes low-relevance candidates and applies metadata constraints before the expensive cross-encoder re-ranking step runs. This is a gating mechanism — it controls what the re-ranker sees.",
    why: "Cross-encoder re-ranking is expensive — it scores each candidate individually. Running it on 50 candidates vs 20 candidates is 2.5x slower. Top-K filtering ensures the re-ranker only touches high-probability candidates, optimizing the accuracy-latency trade-off.",
    decisions: [
      "<strong>K=20 default</strong> — empirically validated: re-ranker recall@3 improves as K grows up to ~20, then plateaus.",
      "<strong>Metadata pre-filtering in Qdrant</strong> — applied before ANN search using payload filters. More efficient than post-filtering.",
      "<strong>Score threshold optional</strong> — useful when retrieval quality is high. Can be skipped in low-recall scenarios to avoid cutting good candidates."
    ],
    tradeoffs: [
      { type: "positive", label: "Smaller K (e.g., 10)", text: "Re-ranker runs faster. Lower latency. Works well when retrieval precision is already high." },
      { type: "negative", label: "Smaller K risk", text: "If the best document is ranked 12th by hybrid retrieval, it never reaches the re-ranker. Recall ceiling drops." },
      { type: "positive", label: "Larger K (e.g., 30)", text: "Higher recall. Re-ranker has more candidates to work with. Better for noisy datasets." },
      { type: "negative", label: "Larger K cost", text: "Re-ranking 30 documents vs 20 is 50% more compute. Latency increases proportionally." }
    ],
    failures: [
      { title: "K too small on low-recall corpus", detail: "For large, noisy corpora, the correct answer may rank outside top-10 in raw retrieval. Setting K=10 guarantees it's excluded. Fix: evaluate retrieval recall@K on a held-out test set." },
      { title: "Hard metadata filter too strict", detail: "Filtering by exact date match removes documents that are semantically relevant but slightly outside the window. Fix: use range filters with appropriate margins." }
    ],
    metrics: [
      { val: "K=20", label: "Default candidates" },
      { val: "<2ms", label: "Filtering overhead" },
      { val: "Payload", label: "Qdrant filter type" }
    ]
  },
  {
    id: "reranking",
    icon: "📊",
    name: "Re-ranking (Cross Encoder)",
    shortDesc: "Precision scoring via cross-encoder",
    tags: ["Cross-Encoder", "BERT", "Precision", "Re-ranking"],
    subtitle: "The accuracy powerhouse. Cross-encoder scores each candidate by jointly processing the query and document — far more accurate than bi-encoder similarity.",
    subflow: [
      { title: "Receive Top-K Candidates", detail: "Top-K documents (query + document text pairs) prepared for cross-encoder scoring." },
      { title: "Pair Construction", detail: "Each candidate formatted as: [CLS] query [SEP] document [SEP]. Cross-encoder processes both together." },
      { title: "Cross-Encoder Scoring", detail: "BERT-based model computes a relevance score for each query-document pair. Attention attends across both query and document tokens jointly." },
      { title: "Sort by Relevance Score", detail: "All candidates re-sorted by cross-encoder score. The ranking may differ significantly from retrieval ranking." },
      { title: "Top-3 Selected", detail: "Final top-3 chunks selected as context for LLM generation." }
    ],
    what: "The cross-encoder is the most accurate but most compute-intensive component. Unlike the bi-encoder used during embedding (which encodes query and document separately), the cross-encoder sees both at the same time — allowing its attention mechanism to model fine-grained relevance signals between the query and each document.",
    why: "Bi-encoder retrieval is fast but approximate. It encodes query and documents independently, so it can't model interactions between them. The cross-encoder fixes this — it's essentially asking 'given this exact query AND this exact document, how relevant is the document?' It's slower but significantly more precise.",
    decisions: [
      "<strong>cross-encoder/ms-marco-MiniLM-L-6-v2</strong> — small, fast, trained on MS-MARCO passage ranking. Good balance of quality and speed.",
      "<strong>Run only on top-20</strong> — not on full index. This is the critical design decision that keeps re-ranking feasible at low latency.",
      "<strong>Batched scoring</strong> — all 20 query-document pairs scored in a single forward pass batch where possible.",
      "<strong>Top-3 output</strong> — 3 chunks provide enough context without overwhelming the LLM's context window."
    ],
    tradeoffs: [
      { type: "positive", label: "Cross-encoder accuracy", text: "Joint attention across query + document captures fine-grained relevance. Significantly better than cosine similarity ranking." },
      { type: "negative", label: "Cross-encoder latency", text: "Cannot be pre-computed (depends on the query). Adds ~40–80ms per inference. Must run at query time." },
      { type: "positive", label: "Re-ranking on top-20", text: "Gives re-ranker enough candidates to work with while keeping latency predictable." },
      { type: "negative", label: "Re-ranking ceiling", text: "Re-ranker can only promote documents already in the top-20 from retrieval. If retrieval missed the best doc, re-ranking can't save it." }
    ],
    failures: [
      { title: "Re-ranking a truncated document", detail: "If document chunks are too long, the cross-encoder truncates them at 512 tokens. Critical information at the end is lost. Fix: ensure chunk sizes are compatible with cross-encoder max length." },
      { title: "Wrong cross-encoder domain", detail: "Cross-encoders trained on web passages (MS-MARCO) may underperform on legal/medical text. Fix: fine-tune on domain data or use domain-specific re-rankers." },
      { title: "Batch size too large → OOM", detail: "Scoring 20 long documents simultaneously can exceed GPU memory. Fix: limit batch size or use CPU inference for re-ranking." }
    ],
    metrics: [
      { val: "~40ms", label: "Re-ranking latency (20 docs)" },
      { val: "Top-3", label: "Context chunks selected" },
      { val: "↑ Precision", label: "vs bi-encoder alone" }
    ]
  },
  {
    id: "llm-generation",
    icon: "🤖",
    name: "LLM Response Generation",
    shortDesc: "Context injection → grounded answer",
    tags: ["LLM", "OpenAI", "Prompt Engineering", "Grounding"],
    subtitle: "The final stage. Retrieved context is injected into a carefully engineered prompt, and the LLM generates a grounded, accurate response.",
    subflow: [
      { title: "Context Assembly", detail: "Top-3 re-ranked chunks assembled into a structured context block with source references." },
      { title: "Prompt Construction", detail: "System prompt + context block + user query composed into the final prompt. System prompt constrains behavior." },
      { title: "LLM Inference", detail: "Prompt sent to LLM (GPT-4, Claude, Llama, etc.). Temperature set low (0.1–0.3) for factual consistency." },
      { title: "Response Validation (Optional)", detail: "Response checked for minimum length, refusal detection, or hallucination flags." },
      { title: "Response Returned via API", detail: "Final answer returned to the user via the FastAPI endpoint with optional source citations." }
    ],
    what: "The LLM receives a carefully structured prompt containing the retrieved context and the original user query. Its job is not to generate from memory — it's to synthesize an answer grounded in the provided documents. The quality of the prompt and the quality of the retrieved context are the two primary determinants of output quality.",
    why: "Without retrieval grounding, LLMs hallucinate — they generate plausible-sounding but fabricated answers. By injecting retrieved context, we constrain the LLM to reason over verified documents. The system prompt explicitly instructs the model to cite sources and refuse if the answer isn't in context.",
    decisions: [
      "<strong>Low temperature (0.1–0.2)</strong> — reduces randomness for factual Q&A. Higher temperatures are appropriate for creative or analytical tasks.",
      "<strong>System prompt engineering</strong> — explicit instruction: 'Answer only from the provided context. If the answer is not in the context, say so.' This is the hallucination guard.",
      "<strong>Source citation in prompt</strong> — instruct the LLM to reference which document it used. Enables downstream verification.",
      "<strong>Context window management</strong> — monitor token count of context + query + expected response. Stay within model limits."
    ],
    tradeoffs: [
      { type: "positive", label: "Low temperature", text: "Consistent, deterministic answers. Better for enterprise Q&A where accuracy is critical." },
      { type: "negative", label: "Low temperature", text: "Less flexible for open-ended or analytical queries that benefit from synthesis and reasoning." },
      { type: "positive", label: "Strict system prompt", text: "Forces grounded answers. Significantly reduces hallucination. Fails gracefully when context is insufficient." },
      { type: "negative", label: "Strict system prompt", text: "May refuse to answer when context partially supports the answer. Requires prompt tuning per use case." }
    ],
    failures: [
      { title: "Context window overflow", detail: "If top-3 chunks + query + system prompt exceed the model's context limit, the input is silently truncated. Fix: track token counts explicitly and truncate context chunks, not the system prompt." },
      { title: "LLM ignores the context", detail: "Without explicit grounding instructions, LLMs default to their training data and hallucinate. Fix: strong system prompt + few-shot examples of correct grounded behavior." },
      { title: "Retrieved context is irrelevant", detail: "If retrieval failed, the LLM gets irrelevant context and either generates a wrong answer or hallucinates. Fix: add a retrieval quality check before LLM call. If no high-scoring candidates → return 'no relevant documents found'." }
    ],
    metrics: [
      { val: "~0.5–2s", label: "LLM generation time" },
      { val: "0.1", label: "Temperature (factual)" },
      { val: "Top-3", label: "Context chunks injected" }
    ]
  }
];

// ============================================================
// STATE MANAGER
// ============================================================
const state = {
  selectedId: null,
  select(id) {
    this.selectedId = id;
    render();
  }
};

// ============================================================
// COMPONENT RENDERERS
// ============================================================

function renderPipelineNodes() {
  const container = document.getElementById('pipelineNodes');
  container.innerHTML = '';
  pipelineData.forEach((node, i) => {
    // Node element
    const el = document.createElement('div');
    el.className = 'pipeline-node' + (state.selectedId === node.id ? ' active' : '');
    el.setAttribute('data-id', node.id);
    el.setAttribute('id', 'node-' + node.id);
    el.innerHTML = `
      <span class="node-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="node-icon">${node.icon}</span>
      <div class="node-info">
        <div class="node-name">${node.name}</div>
        <div class="node-desc">${node.shortDesc}</div>
      </div>
      <span class="node-arrow">›</span>
    `;
    el.addEventListener('click', () => state.select(node.id));
    container.appendChild(el);
    // Connector between nodes
    if (i < pipelineData.length - 1) {
      const conn = document.createElement('div');
      conn.className = 'node-connector';
      container.appendChild(conn);
    }
  });
}

function renderSubflow(steps) {
  return `
    <div class="subflow">
      ${steps.map((step, i) => `
        <div class="sf-step">
          <div class="sf-num">${i + 1}</div>
          <div class="sf-body">
            <strong>${step.title}</strong>
            <p>${step.detail}</p>
          </div>
        </div>
        ${i < steps.length - 1 ? '<div class="sf-connector"></div>' : ''}
      `).join('')}
    </div>
  `;
}

function renderTradeoffs(tradeoffs) {
  return `
    <div class="tradeoffs">
      ${tradeoffs.map(t => `
        <div class="tradeoff-item ${t.type}">
          <div class="t-label">${t.label}</div>
          <p>${t.text}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderFailures(failures) {
  return `
    <div class="failures">
      ${failures.map(f => `
        <div class="failure-item">
          <div class="failure-dot"></div>
          <p><strong>${f.title}</strong> — ${f.detail}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderEngDecisions(decisions) {
  return `
    <div class="eng-decisions">
      ${decisions.map(d => `
        <div class="eng-item">
          <div class="eng-bullet"></div>
          <p>${d}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderMetrics(metrics) {
  return `
    <div class="metrics-row">
      ${metrics.map(m => `
        <div class="metric-pill">
          <span class="metric-val">${m.val}</span>
          <span class="metric-label">${m.label}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDetailPanel(node) {
  return `
    <div class="dc-header">
      <div class="dc-node-icon">${node.icon}</div>
      <div class="dc-title">${node.name}</div>
      <div class="dc-subtitle">${node.subtitle}</div>
      <div>${node.tags.map(t => `<span class="dc-tag">${t}</span>`).join('')}</div>
    </div>

    <div class="dc-section">
      <div class="dc-section-title">Key Metrics</div>
      ${renderMetrics(node.metrics)}
    </div>

    <div class="dc-section">
      <div class="dc-section-title">Sub-Workflow</div>
      ${renderSubflow(node.subflow)}
    </div>

    <div class="dc-section">
      <div class="dc-section-title">What Is Happening</div>
      <div class="info-card"><p>${node.what}</p></div>
    </div>

    <div class="dc-section">
      <div class="dc-section-title">Why It Matters</div>
      <div class="info-card"><p>${node.why}</p></div>
    </div>

    <div class="dc-section">
      <div class="dc-section-title">Engineering Decisions</div>
      ${renderEngDecisions(node.decisions)}
    </div>

    <div class="dc-section">
      <div class="dc-section-title">Trade-offs</div>
      ${renderTradeoffs(node.tradeoffs)}
    </div>

    <div class="dc-section">
      <div class="dc-section-title">Failure Cases & Fixes</div>
      ${renderFailures(node.failures)}
    </div>
  `;
}

// ============================================================
// MAIN RENDER FUNCTION
// ============================================================
function render() {
  renderPipelineNodes();
  const emptyEl = document.getElementById('detailEmpty');
  const contentEl = document.getElementById('detailContent');

  if (!state.selectedId) {
    emptyEl.style.display = 'flex';
    contentEl.style.display = 'none';
    return;
  }

  const node = pipelineData.find(n => n.id === state.selectedId);
  if (!node) return;

  emptyEl.style.display = 'none';
  contentEl.style.display = 'block';
  contentEl.innerHTML = renderDetailPanel(node);
  // Scroll detail panel to top on new selection
  document.querySelector('.detail-panel').scrollTop = 0;
}

// ============================================================
// KEYBOARD NAVIGATION
// ============================================================
document.addEventListener('keydown', (e) => {
  const currentIndex = pipelineData.findIndex(n => n.id === state.selectedId);
  if (e.key === 'ArrowDown' || e.key === 'j') {
    const next = pipelineData[Math.min(currentIndex + 1, pipelineData.length - 1)];
    if (next) state.select(next.id);
  }
  if (e.key === 'ArrowUp' || e.key === 'k') {
    const prev = pipelineData[Math.max(currentIndex - 1, 0)];
    if (prev) state.select(prev.id);
  }
  if (e.key === 'Escape') {
    state.selectedId = null;
    render();
  }
});

// ============================================================
// INIT
// ============================================================
render();
// Auto-select first node for immediate engagement
setTimeout(() => state.select('user-query'), 300);
