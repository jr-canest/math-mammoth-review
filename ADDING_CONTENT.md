# Adding Content to Math Mammoth Review

## Quick Steps

1. **Prepare your PDFs** — have the workbook pages and the answer key pages ready
2. **Give them to Claude Code** — ask it to extract problems and create the JSON
3. **Deploy** — commit and push, the app updates automatically

---

## How to Ask Claude Code for New Content

Paste or attach the PDF pages and say something like:

> Here are the workbook pages (pp. 47-48) and answer key for "Equations" in Chapter 2.
> Create the section JSON file following the schema in `src/data/chapter-2/order-of-operations.json`
> and add it to `src/data/chapter-2/index.json`.

Claude Code will:
- Extract each problem into the JSON format
- Set the correct answer types (number, fraction, text)
- Add the section to the chapter index
- If it's a new chapter, add it to `chapters.json` too

---

## JSON Schema Reference

### chapters.json (master index)

```json
[
  {
    "id": "chapter-2",           // unique slug
    "title": "Chapter 2: Expressions and Equations",
    "folder": "chapter-2",       // matches the folder name in src/data/
    "order": 2                   // display order
  }
]
```

### chapter-X/index.json (section list for a chapter)

```json
[
  {
    "id": "order-of-operations",     // unique slug within the chapter
    "title": "The Order of Operations",
    "pages": "45-46",
    "file": "order-of-operations.json",
    "order": 1
  }
]
```

### Section JSON (the problems)

```json
{
  "chapter": "chapter-2",
  "section": "order-of-operations",
  "title": "The Order of Operations",
  "pages": "45-46",
  "problems": [
    {
      "id": "1a",
      "label": "1a",
      "display": "100 − (50 − 50)",
      "answer": { "type": "number", "value": 100 }
    },
    {
      "id": "3d",
      "label": "3d",
      "display": "(12 + 9) ÷ (4 + 1)",
      "answer": { "type": "fraction", "value": "4 1/5", "decimal": 4.2 }
    }
  ]
}
```

### Answer Types

| Type | Fields | Accepted Student Input |
|------|--------|----------------------|
| `number` | `value` (number) | "100", "16,500", "4 800 000" |
| `fraction` | `value` (string), `decimal` (number), optional `tolerance` | "4 1/5", "21/5", "4.2" |
| `text` | `value` (string) | Case-insensitive exact match |

### Display Text Conventions

- Use Unicode symbols: `÷` for division, `·` for multiplication, `−` for minus
- Use superscript Unicode for exponents: `²` `³` `⁴` `⁵` `⁶` `⁷` `⁸` `⁹` `⁰` `¹`
- Fractions in display: write as `(12 + 9) ÷ (4 + 1)` not as a visual fraction bar
- Parentheses for grouping as they appear in the workbook
- Commas or spaces for large numbers as they appear in the workbook

---

## Folder Structure

```
src/data/
├── chapters.json
├── chapter-2/
│   ├── index.json
│   ├── order-of-operations.json
│   ├── equations.json
│   └── ...
├── chapter-3/
│   ├── index.json
│   └── ...
```

## Adding a Brand New Chapter

1. Create the folder: `src/data/chapter-X/`
2. Create `index.json` with the section list
3. Create each section JSON file
4. Add the chapter entry to `chapters.json`
5. Commit and deploy
