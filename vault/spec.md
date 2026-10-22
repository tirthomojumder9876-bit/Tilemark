# Author Note
Goal of the project: List out favorite sites with a nice icon so like a grid square. 
CRUD -> ability to add new favorites, edit their title/description, and the selected photo. Have a default photo so not required. have a square at the end with a + to add in a new bookmark (within a modal). all a SPA, mobile first design. two bookmarks per row on small devices, so not huge squares. on desktop, maybe 4-6 idk. ability to create sections and drag and drop from one section to another. button to open all from a certain section always.
extract any pure logic in to functions that we could easily test.
try to keep visual components as dumb as possible.
spec will have two checkboxes per thing, one for initial implementation , one for separate verification.
dark mode plz

Database: postgres container. access through docker psql.

subagents ->
mobile verifier, use  chromium or whatever to actually confirm visuals, as well as UX, etc.
verifier-> checks each capability however seems fit.

# spec
