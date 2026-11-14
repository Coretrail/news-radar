CREATE TABLE story_translations(
 story_id bigint PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','translated','original','failed')),
 title_pt text,summary_pt text,source_language text,target_language text NOT NULL DEFAULT 'pt-PT',
 model_version text,attempts int NOT NULL DEFAULT 0,retry_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz,lease_token text,error text,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX translation_queue_idx ON story_translations(status,retry_at,story_id);
CREATE INDEX translation_search_idx ON story_translations USING gin(to_tsvector('simple',coalesce(title_pt,'')||' '||coalesce(summary_pt,'')));
CREATE TABLE translation_cache(cache_key text PRIMARY KEY,source_language text NOT NULL,target_language text NOT NULL DEFAULT 'pt-PT',model_version text NOT NULL,translated_text text NOT NULL,last_used timestamptz NOT NULL DEFAULT now());
CREATE INDEX translation_cache_retention_idx ON translation_cache(last_used);
CREATE FUNCTION newsradar_enqueue_translation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO story_translations(story_id) VALUES(NEW.id) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
CREATE TRIGGER enqueue_story_translation AFTER INSERT ON stories FOR EACH ROW EXECUTE FUNCTION newsradar_enqueue_translation();
INSERT INTO story_translations(story_id) SELECT id FROM stories ON CONFLICT DO NOTHING;
INSERT INTO settings(key,value) VALUES('translation','{"enabled":true,"target":"pt-PT","local_only":true}') ON CONFLICT DO NOTHING;
