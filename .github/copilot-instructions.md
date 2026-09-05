When extracting rules content from `/Sourcebooks/The Severance PHB.pdf`, prefer text-first extraction (for example `pdftotext` or direct PDF text extraction libraries).

Avoid OCR/image rendering workflows that require reading generated `/tmp/*.png` files unless text extraction is impossible, because those image attachments can fail to re-download in the Copilot Actions runtime.
