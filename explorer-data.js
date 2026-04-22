// ============================================================
// explorer-data.js — All pipeline node data
// ============================================================

const PIPELINE = [
  {
    id: "user-query", icon: "💬", name: "User Query",
    sub: "Input processing & intent capture",
    tags: ["Input Layer", "FastAPI", "NLP"],
    desc: "Entry point of the RAG system. Every downstream decision depends on how well the query is processed.",
    categories: [
      {
        type: "flow", label: "Internal Workflow",
        items: [
          { title: "POST /query received", detail: "User submits natural language query to the FastAPI async endpoint.", subs: [] },
          { title: "Input sanitization", detail: "Strip HTML, normalize whitespace, handle encoding edge cases. Reject empty or oversized inputs early.", subs: [] },
          { title: "Token length check", detail: "Enforce max 512 tokens before embedding. Prevents silent truncation downstream.", subs: [] },
          { title: "Query expansion (optional)", detail: "LLM generates 2–3 query variants to improve sparse retrieval coverage on ambiguous inputs.", subs: [] },
          { title: "Forward to embedding layer", detail: "Cleaned query passed to embedding generation. Session context optionally prepended.", subs: [] }
        ]
      },
      {
        type: "problem", label: "Problems Faced",
        items: [
          { title: "Ambiguous short queries", detail: "'What is the policy?' — for which policy? Short queries produce broad, noisy retrieval.", subs: [
            { icon: "⚠️", title: "Root cause", body: "No context attached. Query too general for vector search to distinguish intent." }
          ]},
          { title: "Silent truncation on long queries", detail: "Embedding models cap at 512 tokens. Long queries silently cut — losing critical context.", subs: [
            { icon: "⚠️", title: "Root cause", body: "No upstream length guard. Embedding model truncates without error." }
          ]},
          { title: "Special character corruption", detail: "Non-ASCII or malformed Unicode shifts embedding vectors unexpectedly.", subs: [] }
        ]
      },
      {
        type: "solution", label: "Solutions Implemented",
        items: [
          { title: "Max length enforced at API layer", detail: "FastAPI middleware rejects queries > 512 tokens with a clear error. No silent truncation.", subs: [] },
          { title: "Query expansion for short inputs", detail: "If query < 10 words, LLM generates variants. Costs ~80ms but significantly improves recall.", subs: [] },
          { title: "Unicode normalization (NFKC)", detail: "Applied before tokenization. Eliminates encoding-based vector corruption.", subs: [] }
        ]
      },
      {
        type: "insight", label: "Engineering Insights & Trade-offs",
        items: [
          { title: "Query expansion vs latency", detail: "Expansion adds ~80ms. Worth it for ambiguous queries, unnecessary for specific ones. Solution: only expand when query length < 10 tokens.", subs: [] },
          { title: "Stateless endpoint design", detail: "Each request is fully stateless. No server-side session = easy horizontal scaling. Tradeoff: context must be passed in every request.", subs: [] }
        ]
      },
      {
        type: "failure", label: "Failure Cases",
        items: [
          { title: "Query expansion LLM call fails", detail: "If expansion LLM is down, pipeline falls back to raw query. Retrieval quality degrades but system stays live.", subs: [] },
          { title: "User sends binary or code input", detail: "Non-natural-language input produces garbage embeddings. Fix: content-type validation + language detection at input layer.", subs: [] }
        ]
      }
    ]
  },
  {
    id: "embedding", icon: "🔢", name: "Embedding Generation",
    sub: "Query → dense vector representation",
    tags: ["Sentence-Transformers", "OpenAI", "Dense Vectors"],
    desc: "Converts the user query into a high-dimensional dense vector capturing semantic meaning — the foundation of semantic search.",
    categories: [
      {
        type: "flow", label: "Internal Workflow",
        items: [
          { title: "Tokenization", detail: "Query split into subword tokens using model vocabulary (WordPiece for BERT-based models).", subs: [] },
          { title: "Transformer encoding", detail: "Tokens pass through N encoder layers. Attention captures contextual relationships between all token pairs.", subs: [] },
          { title: "Pooling strategy applied", detail: "CLS token pooling or mean pooling collapses token embeddings into a single fixed-size vector.", subs: [] },
          { title: "L2 normalization", detail: "Vector normalized to unit length. Enables cosine similarity = dot product. Critical for Qdrant ANN performance.", subs: [] },
          { title: "Vector forwarded to retrieval", detail: "384d or 1536d vector passed to hybrid retrieval layer.", subs: [] }
        ]
      },
      {
        type: "problem", label: "Problems Faced",
        items: [
          { title: "Poor semantic matching on domain queries", detail: "General-purpose embeddings confused 'pleadings' (legal) with common usage. Retrieval failed on technical terms.", subs: [
            { icon: "⚠️", title: "Impact", body: "Top-5 retrieved chunks were irrelevant. Re-ranker had no good candidates to promote." }
          ]},
          { title: "Vector space mismatch after model upgrade", detail: "Switched embedding model without re-indexing. Query vectors and document vectors in incompatible spaces.", subs: [
            { icon: "⚠️", title: "Impact", body: "All retrieval results were wrong. System appeared to work but returned garbage silently." }
          ]},
          { title: "High-dimensional vectors slowing ANN search", detail: "1536d OpenAI vectors made HNSW indexing and search significantly slower than 384d local models.", subs: [] }
        ]
      },
      {
        type: "solution", label: "Solutions Implemented",
        items: [
          { title: "Domain-appropriate model selection", detail: "Switched to sentence-transformers/all-MiniLM-L6-v2 for general use. Domain fine-tuning explored for specialized corpora.", subs: [] },
          { title: "Atomic model + index versioning", detail: "Model version tracked alongside index. Any model change triggers full re-index automatically.", subs: [] },
          { title: "Dimensionality trade-off benchmarked", detail: "Benchmarked recall@10 for 384d vs 1536d on our corpus. 384d was within 3% of 1536d — chose speed.", subs: [] }
        ]
      },
      {
        type: "insight", label: "Engineering Insights & Trade-offs",
        items: [
          { title: "384d vs 1536d — speed vs quality", detail: "384d (MiniLM): ~15ms local, zero API cost. 1536d (OpenAI): ~80ms + API cost. For most English corpora, 384d is sufficient.", subs: [] },
          { title: "Normalization is non-negotiable", detail: "Without L2 normalization, cosine similarity scores are corrupted by vector magnitude differences. Always normalize.", subs: [] },
          { title: "Batch at index time, single at query time", detail: "Documents embedded in batches of 32–64 offline. Queries embedded one at a time. Different optimization strategies apply.", subs: [] }
        ]
      },
      {
        type: "failure", label: "Failure Cases",
        items: [
          { title: "Embedding model API timeout", detail: "OpenAI embedding API goes down → full system halt. Fix: local fallback model (MiniLM) with automatic failover.", subs: [] },
          { title: "Long query silently truncated by model", detail: "Embedding model truncates at 512 tokens without error. Critical tail of query lost. Fix: pre-truncate with warning log.", subs: [] }
        ]
      }
    ]
  },
  {
    id: "hybrid-retrieval", icon: "🔍", name: "Hybrid Retrieval",
    sub: "BM25 (sparse) + Vector Search (dense) → RRF fusion",
    tags: ["BM25", "Qdrant", "FAISS", "RRF Fusion"],
    desc: "Most critical component. Runs sparse and dense retrieval in parallel, fuses results via Reciprocal Rank Fusion for maximum coverage.",
    categories: [
      {
        type: "flow", label: "Internal Workflow",
        items: [
          { title: "Async parallel retrieval triggered", detail: "BM25 and dense vector search execute simultaneously via asyncio. Total latency = max(BM25, dense), not sum.", subs: [] },
          { title: "BM25 sparse search", detail: "Query terms matched against inverted index. TF-IDF rewards rare, specific terms. Returns top-30 with keyword scores.", subs: [] },
          { title: "Dense ANN search (Qdrant/FAISS)", detail: "Query vector compared against all document vectors using HNSW. Returns top-30 by cosine similarity.", subs: [] },
          { title: "Result deduplication", detail: "Documents appearing in both result sets unified. Score references merged before fusion.", subs: [] },
          { title: "Reciprocal Rank Fusion (RRF)", detail: "Score = 1/(k+rank_bm25) + 1/(k+rank_dense), k=60. Documents ranked high in both lists score highest.", subs: [] },
          { title: "Top-20 candidates forwarded", detail: "Top-20 documents from fused ranking passed to re-ranking stage.", subs: [] }
        ]
      },
      {
        type: "problem", label: "Problems Faced",
        items: [
          { title: "Pure dense search failed on exact-match queries", detail: "'Invoice #INV-20231104' returned semantically similar invoices, not the exact one. Dense search cannot do exact match.", subs: [
            { icon: "⚠️", title: "Impact", body: "Critical for enterprise use cases where exact document IDs, codes, or identifiers must be matched precisely." }
          ]},
          { title: "BM25 index not pre-loaded — latency spike", detail: "Initial implementation rebuilt BM25 index per request. Latency jumped from 60ms to 4 seconds.", subs: [
            { icon: "⚠️", title: "Impact", body: "System was unusable in production until fixed." }
          ]},
          { title: "Score normalization incompatibility", detail: "Tried to combine BM25 scores (unbounded) with cosine similarity (0–1). Score range mismatch corrupted fusion.", subs: [] }
        ]
      },
      {
        type: "solution", label: "Solutions Implemented",
        items: [
          { title: "Hybrid search (BM25 + dense) deployed", detail: "BM25 handles exact match. Dense handles semantic. Together they cover all query types.", subs: [] },
          { title: "BM25 index pre-loaded at server startup", detail: "rank_bm25 index loaded into memory on FastAPI startup event. Per-request rebuild eliminated.", subs: [] },
          { title: "RRF replaced score-based fusion", detail: "RRF only uses ranks — not scores. Completely avoids score normalization problem.", subs: [] }
        ]
      },
      {
        type: "insight", label: "Engineering Insights & Trade-offs",
        items: [
          { title: "RRF k=60 is empirically optimal", detail: "k controls how much top-ranked documents dominate. k=60 is the standard value from the original RRF paper. Rarely needs tuning.", subs: [] },
          { title: "Async parallel saves ~60ms", detail: "Running BM25 and dense search sequentially: ~120ms. In parallel: ~65ms. Always parallelize independent retrieval paths.", subs: [] },
          { title: "Qdrant vs FAISS trade-off", detail: "FAISS: in-memory, fast, no persistence. Qdrant: persistent, filterable, production-ready. FAISS for dev, Qdrant for production.", subs: [] }
        ]
      },
      {
        type: "failure", label: "Failure Cases",
        items: [
          { title: "Index staleness (partial update)", detail: "Document added to vector index but BM25 index not updated. Retrieval gap invisible in logs. Fix: atomic dual-index update.", subs: [] },
          { title: "HNSW misconfiguration → poor recall", detail: "Low ef_construction → fast indexing but HNSW graph quality drops → ANN misses relevant docs. Fix: benchmark recall@10 during index build.", subs: [] }
        ]
      }
    ]
  },
  {
    id: "topk", icon: "🎯", name: "Top-K Filtering",
    sub: "Candidate selection before expensive re-ranking",
    tags: ["Filtering", "Qdrant Payload", "Threshold"],
    desc: "Gates the re-ranker — removes low-relevance candidates and applies metadata constraints before cross-encoder scoring.",
    categories: [
      {
        type: "flow", label: "Internal Workflow",
        items: [
          { title: "Receive fused candidates (top-30)", detail: "Top-30 candidates from RRF fusion received as input.", subs: [] },
          { title: "Metadata hard filtering", detail: "Apply constraints: document type, date range, access permissions. Done via Qdrant payload filters — no post-filtering overhead.", subs: [] },
          { title: "Score threshold check (optional)", detail: "Candidates below minimum RRF score dropped. Prevents garbage from entering re-ranker.", subs: [] },
          { title: "K selection → top-20 forwarded", detail: "Final top-20 candidates selected for cross-encoder re-ranking.", subs: [] }
        ]
      },
      {
        type: "problem", label: "Problems Faced",
        items: [
          { title: "K too small — correct answer excluded", detail: "Set K=10 initially. Correct document ranked 13th in retrieval. Re-ranker never saw it. Answer was always wrong.", subs: [
            { icon: "⚠️", title: "Impact", body: "Re-ranking cannot promote documents it never receives. Retrieval recall@K is the hard ceiling." }
          ]},
          { title: "Post-filtering vs pre-filtering", detail: "Applying metadata filters after ANN search wasted time scoring irrelevant documents. Needed pre-filtering in the vector index.", subs: [] }
        ]
      },
      {
        type: "solution", label: "Solutions Implemented",
        items: [
          { title: "K tuned via recall@K evaluation", detail: "Ran recall@K benchmark on held-out test set. K=20 gave 94% recall — K=30 only added 1%. Chose K=20.", subs: [] },
          { title: "Pre-filtering moved into Qdrant", detail: "Qdrant payload filters applied before HNSW search. Only relevant documents enter ANN — faster and cleaner.", subs: [] }
        ]
      },
      {
        type: "insight", label: "Engineering Insights & Trade-offs",
        items: [
          { title: "K=20 is the empirical sweet spot", detail: "Re-ranker recall@3 improves as K grows up to ~20, then plateaus. Beyond 20, extra latency isn't justified.", subs: [] },
          { title: "Hard metadata filters change recall ceiling", detail: "Strict date filters can exclude the most relevant document. Always validate filters against ground truth before deploying.", subs: [] }
        ]
      },
      {
        type: "failure", label: "Failure Cases",
        items: [
          { title: "Threshold too aggressive", detail: "Score threshold set too high — filtered out all candidates on rare queries. LLM received empty context. Fix: minimum 3 candidates always passed through.", subs: [] }
        ]
      }
    ]
  },
  {
    id: "reranking", icon: "📊", name: "Re-ranking",
    sub: "Cross-encoder precision scoring on top-K candidates",
    tags: ["Cross-Encoder", "BERT", "ms-marco", "Precision"],
    desc: "The accuracy powerhouse. Cross-encoder jointly processes query + document to score fine-grained relevance — far superior to bi-encoder similarity.",
    categories: [
      {
        type: "flow", label: "Internal Workflow",
        items: [
          { title: "Query-document pair construction", detail: "Each candidate formatted as: [CLS] query [SEP] document [SEP]. Cross-encoder sees both simultaneously.", subs: [] },
          { title: "Cross-encoder forward pass", detail: "BERT-based model computes relevance score for each pair. Attention spans both query and document tokens jointly.", subs: [] },
          { title: "Batch scoring", detail: "All 20 pairs scored in a single batched forward pass where GPU memory allows.", subs: [] },
          { title: "Sort by cross-encoder score", detail: "All candidates re-sorted. Final ranking may differ significantly from retrieval ranking.", subs: [] },
          { title: "Top-3 selected as LLM context", detail: "Top-3 chunks forwarded to LLM generation stage.", subs: [] }
        ]
      },
      {
        type: "problem", label: "Problems Faced",
        items: [
          { title: "Latency too high with large K", detail: "Running cross-encoder on K=50 candidates: ~200ms. Unacceptable for real-time system.", subs: [
            { icon: "⚠️", title: "Root cause", body: "Cross-encoder cannot be pre-computed. Must run at query time per-candidate. O(K) complexity." }
          ]},
          { title: "Cross-encoder truncating long chunks", detail: "Chunks > 512 tokens silently truncated by cross-encoder. Critical information at chunk end dropped.", subs: [] },
          { title: "Domain mismatch on technical corpus", detail: "ms-marco-trained cross-encoder underperformed on legal and medical text. Trained on web passages.", subs: [] }
        ]
      },
      {
        type: "solution", label: "Solutions Implemented",
        items: [
          { title: "K reduced to 20 + batched inference", detail: "K=20 + GPU batching brought re-ranking latency to ~40ms. Acceptable for the precision gain.", subs: [] },
          { title: "Chunk size capped at 400 tokens", detail: "Ensured chunks stay within cross-encoder max length. 100-token buffer prevents truncation.", subs: [] },
          { title: "Model: cross-encoder/ms-marco-MiniLM-L-6-v2", detail: "Smallest fast cross-encoder. 6-layer BERT. 40ms for 20 docs on CPU. Quality sufficient for general corpora.", subs: [] }
        ]
      },
      {
        type: "insight", label: "Engineering Insights & Trade-offs",
        items: [
          { title: "Cross vs bi-encoder: why it matters", detail: "Bi-encoder: query and doc encoded separately → no interaction modeling. Cross-encoder: sees both → models token-level interactions → far more accurate.", subs: [] },
          { title: "Re-ranking ceiling = retrieval recall", detail: "If the correct document isn't in the top-20 from retrieval, re-ranking cannot help. Retrieval recall is always the bottleneck.", subs: [] },
          { title: "+40ms for significant precision gain", detail: "Trade-off: 40ms extra latency → substantially better answer quality. In document Q&A, accuracy > latency. Kept re-ranking in.", subs: [] }
        ]
      },
      {
        type: "failure", label: "Failure Cases",
        items: [
          { title: "GPU OOM on large batch", detail: "Scoring 20 long documents simultaneously exceeded GPU memory. Fix: reduce batch size to 5 or use CPU inference for re-ranking.", subs: [] },
          { title: "Re-ranker promotes confident-sounding wrong doc", detail: "Cross-encoder confident about a doc that overlaps in keywords but not meaning. Fix: minimum relevance threshold below which LLM is told context may be insufficient.", subs: [] }
        ]
      }
    ]
  },
  {
    id: "llm-generation", icon: "🤖", name: "LLM Response Generation",
    sub: "Context injection → grounded answer generation",
    tags: ["OpenAI", "Prompt Engineering", "Grounding", "FastAPI"],
    desc: "Final stage. Top-3 re-ranked chunks injected into a carefully engineered prompt. LLM synthesizes a grounded answer — not a hallucination.",
    categories: [
      {
        type: "flow", label: "Internal Workflow",
        items: [
          { title: "Context assembly", detail: "Top-3 chunks assembled with source metadata. Token count tracked to stay within model context window.", subs: [] },
          { title: "Prompt construction", detail: "System prompt + context block + user query composed. System prompt constrains to provided context only.", subs: [] },
          { title: "Token budget check", detail: "Total tokens (system + context + query + expected response) validated against model limit before API call.", subs: [] },
          { title: "LLM inference", detail: "Prompt sent to LLM with temperature=0.1 for factual consistency. Streaming response supported.", subs: [] },
          { title: "Response validation", detail: "Check for refusal patterns, minimum length, hallucination flags before returning.", subs: [] },
          { title: "Response returned with source citations", detail: "Final answer + source document references returned via FastAPI endpoint.", subs: [] }
        ]
      },
      {
        type: "problem", label: "Problems Faced",
        items: [
          { title: "LLM ignoring retrieved context", detail: "Without explicit grounding instruction, LLM defaulted to training data. Confidently wrong answers.", subs: [
            { icon: "⚠️", title: "Impact", body: "High-confidence hallucinations worse than low-confidence ones. User trusts wrong answer." }
          ]},
          { title: "Context window overflow", detail: "3 long chunks + system prompt + query exceeded model context limit. End of context silently truncated.", subs: [] },
          { title: "Irrelevant context → confident hallucination", detail: "When retrieval failed, LLM received irrelevant context but generated a confident-sounding wrong answer anyway.", subs: [] }
        ]
      },
      {
        type: "solution", label: "Solutions Implemented",
        items: [
          { title: "Strong grounding system prompt", detail: "'Answer ONLY from the provided context. If the answer is not in the context, explicitly say so.' Drastically reduced hallucination.", subs: [] },
          { title: "Token budget enforced pre-call", detail: "Token counter validates total prompt length before LLM call. Chunks truncated symmetrically if budget exceeded.", subs: [] },
          { title: "Retrieval quality gate", detail: "If max re-ranker score < threshold → return 'No relevant documents found' instead of calling LLM on bad context.", subs: [] }
        ]
      },
      {
        type: "insight", label: "Engineering Insights & Trade-offs",
        items: [
          { title: "Temperature 0.1 for factual Q&A", detail: "Low temperature = consistent, deterministic answers. High temperature for creative tasks. For enterprise Q&A, determinism is critical.", subs: [] },
          { title: "System prompt is the hallucination guard", detail: "The system prompt is the most important engineering decision in the LLM layer. Poorly written = high hallucination rate regardless of retrieval quality.", subs: [] },
          { title: "Streaming vs batch response", detail: "Streaming: better UX for long responses, complex to implement. Batch: simpler, enables full response validation before returning. Chose batch + validation.", subs: [] }
        ]
      },
      {
        type: "failure", label: "Failure Cases",
        items: [
          { title: "LLM API rate limit hit", detail: "High concurrent usage → 429 from OpenAI. Fix: request queue with exponential backoff + local LLM fallback (Llama via Ollama).", subs: [] },
          { title: "LLM generates citation not in context", detail: "LLM fabricates document name that sounds plausible. Fix: citations must be extracted from provided metadata, not LLM-generated.", subs: [] }
        ]
      }
    ]
  }
];
