UPDATE "Entry" AS entry
SET "documentText" = COALESCE(
    (
        SELECT string_agg(text_value #>> '{}', ' ')
        FROM jsonb_path_query(entry."document", 'strict $.**.text') AS text_value
    ),
    ''
);

