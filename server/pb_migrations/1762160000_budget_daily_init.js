/// <reference path="../pb_data/types.d.ts" />

// Budget Daily schema. Applied automatically when the server starts
// (or explicitly with `./pocketbase migrate up`).
//
// Every operation and the settings are separate records of one collection,
// the same shape the app's sync already uses: kind + rid identify a record
// within a user. Each user can only read and write their own records, and
// deleting a user deletes all of their records.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // Users may delete their own account (required by the App Store and 152-FZ).
    users.deleteRule = "id = @request.auth.id";
    app.save(users);

    const records = new Collection({
      type: "base",
      name: "budget_records",
      listRule: "user = @request.auth.id",
      viewRule: "user = @request.auth.id",
      createRule: '@request.auth.id != "" && user = @request.auth.id',
      updateRule: "user = @request.auth.id && @request.body.user:changed = false",
      // Deletions travel as `deleted = true` so other devices learn about them.
      deleteRule: null,
      fields: [
        {
          name: "user",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true
        },
        { name: "kind", type: "text", required: true, max: 32 },
        { name: "rid", type: "text", required: true, max: 64 },
        { name: "data", type: "json", maxSize: 1000000 },
        { name: "deleted", type: "bool" },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_budget_records_key ON budget_records (user, kind, rid)",
        "CREATE INDEX idx_budget_records_updated ON budget_records (user, updated)"
      ]
    });
    app.save(records);

    // The app sends its changes in batches (one transaction per sync).
    const settings = app.settings();
    settings.meta.appName = "Budget Daily";
    settings.batch.enabled = true;
    settings.batch.maxRequests = 100;
    settings.batch.timeout = 10;
    app.save(settings);
  },
  (app) => {
    const records = app.findCollectionByNameOrId("budget_records");
    app.delete(records);

    const users = app.findCollectionByNameOrId("users");
    users.deleteRule = null;
    app.save(users);
  }
);
