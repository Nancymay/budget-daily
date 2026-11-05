/// <reference path="../pb_data/types.d.ts" />

// PocketBase's default rate limit allows 20 creates per 5 seconds, but the
// app's first sync sends its records in batches of up to 100, and every
// record in a batch counts. Signed-in users get a much higher limit for
// their own budget records; everything else keeps the defaults.
migrate(
  (app) => {
    const settings = app.settings();
    unmarshal(
      {
        rateLimits: {
          enabled: true,
          rules: [
            { label: "budget_records:create", audience: "@auth", duration: 10, maxRequests: 3000 },
            { label: "budget_records:update", audience: "@auth", duration: 10, maxRequests: 3000 },
            { label: "*:auth", audience: "", duration: 3, maxRequests: 2 },
            { label: "*:create", audience: "", duration: 5, maxRequests: 20 },
            { label: "/api/batch", audience: "", duration: 1, maxRequests: 3 },
            { label: "/api/", audience: "", duration: 10, maxRequests: 300 }
          ]
        }
      },
      settings
    );
    app.save(settings);
  },
  () => {}
);
