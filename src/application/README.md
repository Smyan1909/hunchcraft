# Application

Host-independent use cases and asynchronous orchestration. Depend on core, ports,
and other application modules only. Own scheduling, concurrency bounds,
cancellation, freshness checks, and the policy for consuming decisions.

Inject providers and I/O through ports. Keep provider SDKs, host hooks, concrete
logging libraries, and process configuration outside this layer.
