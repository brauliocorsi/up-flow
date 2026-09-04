CREATE POLICY "qualidade_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'qualidade');
CREATE POLICY "qualidade_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'qualidade' AND owner = auth.uid());
CREATE POLICY "qualidade_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'qualidade' AND owner = auth.uid());
CREATE POLICY "qualidade_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'qualidade' AND owner = auth.uid());