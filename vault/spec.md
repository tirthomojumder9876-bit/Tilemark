# Author Note
Goal of the project: List out favorite sites with a nice icon so like a grid square. 
CRUD -> ability to add new favorites, edit their title/description, and the selected photo. Have a default photo so not required. have a square at the end with a + to add in a new bookmark (within a modal). all a SPA, mobile first design. two bookmarks per row on small devices, so not huge squares. on desktop, maybe 4-6 idk. ability to create sections and drag and drop from one section to another. button to open all from a certain section always.
extract any pure logic in to functions that we could easily test.
try to keep visual components as dumb as possible.
spec will have two checkboxes per thing, one for initial implementation , one for separate verification.
dark mode plz

Database: postgres container, published on 127.0.0.1:5436 for host tools; psql
can also be run inside the container.

## Subagents

### verifier

Checks every capability against this spec, however it sees fit. Ticks the
verification checkbox only when the behavior is actually observed. Reports each
failure with the smallest step that reproduces it.

### mobile verifier

Uses Chromium (Playwright) to confirm what a user would see, not what the code
claims. At 390x844 and 360x800: two per row, tap targets, spacing, dark mode.
Walks the UX end to end — add, edit, delete, drag between sections, open all —
and reports defects with screenshots.

# spec
