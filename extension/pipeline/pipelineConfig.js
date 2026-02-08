(() => {
  const DEFAULTS = Object.freeze({
    actionWindowMs: Object.freeze({ pre: 250, post: 3000 }),
    dedupeWindowMs: 1000,
    slowThresholdMs: 2000,
    maxRequestsStored: 2000,
    maxBodyBytes: 204800,
    burstCollapse: Object.freeze({ windowMs: 5000, minCount: 10 }),
    topSlowRequestsLimit: 10,
  });

  const PipelineConfig = Object.freeze({ DEFAULTS });

  self.PipelineConfig = PipelineConfig;
})();
