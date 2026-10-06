# SoftTissueMechaniX website — maintenance notes (Oct 2026 redesign)

## Global
- `resources/pages_style/styles.css`: all custom styles (home hero + carousel, research, funds, publications, news). Dark mode via `body.quarto-dark`.
- `resources/pages_style/site-scripts.html`: inlined on every page via `include-after-body` (_quarto.yml). Handles anti-spam e-mails, `.reveal` scroll animations, navbar height.
- Quarto's Bootstrap build does NOT include `.row/.col-*` nor carousel CSS → use Quarto `.grid` / `.g-col-*` and the custom carousel.

## Home (home.qmd)
- Hero: `<img srcset>` with LMS_Building_900/1600/2400.jpg; height follows the photo ratio (max 72vh, min 300px/240px mobile).
- Carousel: copy a `<div class="stm-slide">` block (image, title, text, link). Dots auto-generated. Placeholder: `resources/images/carousel_placeholder.jpg`.

## Members — e-mails
- In description: `<span class='stm-email' data-user='first.last' data-domain='polytechnique.edu'></span>`
- In about links: `href: "#email:first.last:polytechnique.edu"`
- Never write `name@domain` or `mailto:` in source.

## Research (research.qmd)
- Each project: `::::::: {#id .project-section}` (add `.flip` to swap image side).
- Related publications box: `.project-pubs data-tags="Cornea"` → filled from bibliography.yml `tags`.

## Publications
- Data: `resources/biblio/bibliography.yml` (header documents fields). Optional `image`, `abstract`, `keywords`; otherwise a coloured cover is generated per tag.
- Deep links: `publications.html?tag=Cornea`, `publications.html#<id>`.
- Logic: `resources/pages_style/publications.js` (needs js-yaml from cdnjs).

## News
- Template: `resources/templates/news-timeline.ejs`. Split Forthcoming/Past in the browser from `date` (and optional `end-date`, `location`) of each news/*.qmd → automatic, no re-render needed.
- EJS template lines must NOT be indented (Markdown turns them into code blocks).

## Funds
- Boxes use `.fund-card` for hover grow/colour.