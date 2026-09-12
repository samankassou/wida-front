# Documentation screenshots

Captured on 12 September 2026 from the running local Wida frontend at `/demo`, using the Codex in-app browser, French interface, and light theme. These are unretouched browser captures of the current working interface, not generated mockups.

| File | View | Size |
| --- | --- | --- |
| [workspace-inbox.png](workspace-inbox.png) | Document inbox, scrolled to show all eight sample documents | 1016 × 923 |
| [workspace-review.png](workspace-review.png) | Atelier North original and invoice form, scrolled to show the uncertain invoice number | 1016 × 923 |
| [workspace-review-mobile.png](workspace-review-mobile.png) | Atelier North review with the invoice-details panel selected | 390 × 844 |

All suppliers, documents, amounts, and extraction results are fictional demo data. The invoice number intentionally differs between the sample original and extracted form to demonstrate human verification. No invoice was changed or saved while taking these screenshots. The mobile viewport override was reset after capture.

These images demonstrate the interface only. They do not establish successful Google sign-in, PostgreSQL persistence, RabbitMQ recovery, or Azure extraction in a live environment.

To refresh them, open `/demo` with the eight initial sample records, use French and the light theme, capture the inbox and Atelier North review, then capture the mobile invoice-details panel at 390 × 844. Verify that no personal data or browser errors appear, replace the corresponding files, and update this date and the actual image dimensions. Use the current browser's desktop viewport and record its dimensions rather than stretching the images.
