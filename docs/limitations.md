# Known Limitations

## Evaluation Reliability
- LLM-as-judge has known biases: verbosity bias, position bias, self-enhancement bias
- Using the same model family (Gemini) for generation and evaluation creates self-enhancement risk
- Evaluation scores are proxies for quality, not validated against real ad performance (CTR, conversions)
- Image evaluation is less reliable than copy evaluation — higher score variance across runs

## Competitive Intelligence
- Competitor patterns are from research, not live Meta Ad Library data
- No programmatic access to Meta Ad Library API
- Patterns may become stale over time
- Limited to 4 competitors (Princeton Review, Kaplan, Khan Academy, Chegg)

## Scale
- 50 ads is a proof of concept, not production scale
- Sequential processing limits throughput
- Rate limits restrict concurrent API calls
- Cost estimates depend on pricing accuracy at time of run

## Image Generation
- Imagen availability and quality may vary
- Placeholder images generated if Imagen API fails
- Image refinement prompts are less precise than copy refinement
- 3-iteration cap limits exploration space

## Cost Tracking
- Token counts depend on LangChain response metadata accuracy
- Cost-per-token rates are approximate and may change
- Image generation costs are per-image estimates
- Does not account for retry costs on API failures

## Reproducibility
- LLM outputs are stochastic even with temperature=0.1
- Seed support varies by model/API version
- Image generation is inherently non-deterministic
- Results will differ between runs
