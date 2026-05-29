CREATE POLICY "Users can upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'receipts'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can read receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'receipts'
  AND auth.uid() IS NOT NULL
);
