## 2026-02-21 - Secure Go HTTP Server Configuration
**Vulnerability:** Denial of Service (DoS) via Slowloris or slow request attacks.
**Learning:** Gin's default `r.Run()` method uses `http.ListenAndServe` without setting read/write timeouts, leaving the server vulnerable to connection exhaustion.
**Prevention:** Always use a custom `http.Server` with explicit `ReadTimeout`, `ReadHeaderTimeout`, and `WriteTimeout` to ensure connections are closed if they are too slow.
